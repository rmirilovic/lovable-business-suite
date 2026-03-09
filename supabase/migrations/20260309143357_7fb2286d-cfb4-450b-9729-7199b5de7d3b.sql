
CREATE OR REPLACE FUNCTION post_received_credit_note(_doc_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _doc received_credit_notes%ROWTYPE;
  _partner partners%ROWTYPE;
  _je_id uuid;
  _item RECORD;
  _order int := 1;
  _supplier_account text;
  _vat_account text;
  _total_subtotal numeric := 0;
  _total_vat numeric := 0;
  _total_amount numeric := 0;
  _popdv_report_id uuid;
  _period_start date;
  _period_end date;
  _is_foreign boolean;
BEGIN
  SELECT * INTO _doc FROM received_credit_notes WHERE id = _doc_id;
  IF _doc IS NULL THEN RAISE EXCEPTION 'Dokument nije pronađen'; END IF;
  IF _doc.status != 'draft' THEN RAISE EXCEPTION 'Dokument nije u statusu Nacrt'; END IF;

  SELECT * INTO _partner FROM partners WHERE id = _doc.partner_id;
  _is_foreign := (_partner.legal_status = '4');
  _supplier_account := CASE WHEN _is_foreign THEN '4360' ELSE '4350' END;

  SELECT COALESCE(SUM(line_subtotal), 0), COALESCE(SUM(line_vat), 0), COALESCE(SUM(line_total), 0)
  INTO _total_subtotal, _total_vat, _total_amount
  FROM received_credit_note_items WHERE received_credit_note_id = _doc_id;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit, posted_at, posted_by, created_by,
    source_type, source_id
  ) VALUES (
    _doc.company_id, _doc.business_year_id,
    (SELECT get_next_journal_entry_number(_doc.company_id, _doc.business_year_id)),
    _doc.receipt_date, _doc.document_date, _doc.supplier_document_number,
    'Primljeno knjižno odobrenje ' || _doc.internal_number,
    'posted', _total_amount, _total_amount,
    now(), _user_id, _user_id,
    'received_credit_note', _doc_id
  ) RETURNING id INTO _je_id;

  -- Duguje: konto dobavljača (smanjenje obaveze)
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order,
    description, debit_amount, credit_amount, partner_id, document_date
  ) VALUES (
    _je_id, _doc.company_id, _supplier_account, _order,
    'Primljeno KO - ' || COALESCE(_doc.supplier_name, _partner.name),
    _total_amount, 0, _doc.partner_id, _doc.due_date
  );
  _order := _order + 1;

  -- Potražuje: konta troškova i PDV
  FOR _item IN
    SELECT rci.*, ic.account_code as cost_account_code, ou.code as ou_code
    FROM received_credit_note_items rci
    LEFT JOIN input_costs ic ON ic.id = rci.input_cost_id
    LEFT JOIN organizational_units ou ON ou.id = rci.org_unit_id
    WHERE rci.received_credit_note_id = _doc_id ORDER BY rci.item_order
  LOOP
    IF _item.cost_account_code IS NOT NULL THEN
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount, cost_center_code, document_date
      ) VALUES (
        _je_id, _doc.company_id, _item.cost_account_code, _order,
        _item.item_name, 0, _item.line_subtotal, _item.ou_code, _doc.document_date
      );
      _order := _order + 1;
    END IF;

    IF _item.line_vat > 0 AND _item.is_vat_deductible THEN
      IF _doc.has_internal_vat_calculation THEN
        _vat_account := CASE WHEN _item.vat_rate = 10 THEN '2730' ELSE '2720' END;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order,
          description, debit_amount, credit_amount, document_date
        ) VALUES (
          _je_id, _doc.company_id, _vat_account, _order,
          'Interni obračun PDV - storno ulaznog', 0, _item.line_vat, _doc.document_date
        );
        _order := _order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order,
          description, debit_amount, credit_amount, document_date
        ) VALUES (
          _je_id, _doc.company_id,
          CASE WHEN _item.vat_rate = 10 THEN '4730' ELSE '4720' END, _order,
          'Interni obračun PDV - storno izlaznog', 0, _item.line_vat, _doc.document_date
        );
        _order := _order + 1;
      ELSE
        _vat_account := CASE WHEN _item.vat_rate = 10 THEN '2730' ELSE '2720' END;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order,
          description, debit_amount, credit_amount, document_date
        ) VALUES (
          _je_id, _doc.company_id, _vat_account, _order,
          'Storno prethodnog PDV', 0, _item.line_vat, _doc.document_date
        );
        _order := _order + 1;
      END IF;
    END IF;
  END LOOP;

  -- POPDV section 8a field 005
  SELECT vat_period_type INTO _period_start FROM companies WHERE id = _doc.company_id;
  
  IF (SELECT vat_period_type FROM companies WHERE id = _doc.company_id) = 'monthly' THEN
    _period_start := date_trunc('month', _doc.document_date)::date;
    _period_end := (date_trunc('month', _doc.document_date) + interval '1 month' - interval '1 day')::date;
  ELSE
    _period_start := date_trunc('quarter', _doc.document_date)::date;
    _period_end := (date_trunc('quarter', _doc.document_date) + interval '3 months' - interval '1 day')::date;
  END IF;

  SELECT id INTO _popdv_report_id FROM popdv_reports
  WHERE company_id = _doc.company_id AND period_start = _period_start AND period_end = _period_end;

  IF _popdv_report_id IS NOT NULL AND _total_subtotal > 0 THEN
    INSERT INTO popdv_report_detail_rows (
      report_id, company_id, section, row_code,
      document_date, document_type_number, partner_info,
      values, item_order, source_document_id
    ) VALUES (
      _popdv_report_id, _doc.company_id, '8a', '8a.5',
      _doc.document_date,
      'PKO ' || _doc.internal_number,
      COALESCE(_doc.supplier_name, _partner.name),
      jsonb_build_object('005', _total_subtotal),
      COALESCE((SELECT MAX(item_order) + 1 FROM popdv_report_detail_rows WHERE report_id = _popdv_report_id AND row_code = '8a.5'), 0),
      _doc_id
    );
  END IF;

  UPDATE received_credit_notes
  SET status = 'posted', posted_at = now(), posted_by = _user_id, journal_entry_id = _je_id
  WHERE id = _doc_id;
END;
$$;

CREATE OR REPLACE FUNCTION unpost_received_credit_note(_doc_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _doc received_credit_notes%ROWTYPE;
  _je_id uuid;
BEGIN
  SELECT * INTO _doc FROM received_credit_notes WHERE id = _doc_id;
  IF _doc IS NULL THEN RAISE EXCEPTION 'Dokument nije pronađen'; END IF;
  IF _doc.status != 'posted' THEN RAISE EXCEPTION 'Dokument nije proknjižen'; END IF;

  _je_id := _doc.journal_entry_id;

  UPDATE received_credit_notes
  SET status = 'draft', posted_at = NULL, posted_by = NULL, journal_entry_id = NULL
  WHERE id = _doc_id;

  IF _je_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = _je_id;
    DELETE FROM journal_entries WHERE id = _je_id;
  END IF;

  DELETE FROM popdv_report_detail_rows WHERE source_document_id = _doc_id;
END;
$$;
