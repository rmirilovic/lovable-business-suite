
-- Update post_invoice to set supplier_document_number (for sales, it's our invoice number)
CREATE OR REPLACE FUNCTION public.post_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice invoices%ROWTYPE;
  _partner partners%ROWTYPE;
  _journal_entry_id uuid;
  _journal_entry_number text;
  _item_order int := 0;
  _receivable_account text;
  _is_foreign boolean := false;
  _org_unit_code text;
  _vat_rec RECORD;
  _popdv_report_id uuid;
  _popdv_next_order int;
  _popdv_base_20 numeric := 0;
  _popdv_vat_20 numeric := 0;
  _popdv_base_10 numeric := 0;
  _popdv_vat_10 numeric := 0;
  _advance_doc advance_invoices%ROWTYPE;
  _adv_popdv_base_20 numeric := 0;
  _adv_popdv_vat_20 numeric := 0;
  _adv_popdv_base_10 numeric := 0;
  _adv_popdv_vat_10 numeric := 0;
  _popdv_partner_info text;
BEGIN
  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF _invoice.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;
  IF _invoice.total_amount <= 0 THEN RAISE EXCEPTION 'Faktura mora imati pozitivan iznos'; END IF;

  SELECT * INTO _partner FROM partners WHERE id = _invoice.partner_id;
  _is_foreign := (_partner.country IS NOT NULL AND _partner.country != 'Srbija');

  IF _invoice.org_unit_id IS NOT NULL THEN
    SELECT code INTO _org_unit_code FROM organizational_units WHERE id = _invoice.org_unit_id;
  END IF;

  _receivable_account := '2040';
  _journal_entry_number := 'FAK' || _invoice.invoice_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, org_unit_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit, posted_at, posted_by,
    source_document_type, source_document_id, created_by
  ) VALUES (
    _invoice.company_id, _invoice.business_year_id, _invoice.org_unit_id,
    _journal_entry_number, _invoice.invoice_date::date, _invoice.invoice_date::date,
    _invoice.invoice_number,
    'Faktura ' || _invoice.invoice_number || ' - ' || _partner.name,
    'posted', _invoice.total_amount, _invoice.total_amount,
    now(), _user_id, 'invoice', _invoice_id, _user_id
  ) RETURNING id INTO _journal_entry_id;

  _item_order := _item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id
  ) VALUES (
    _journal_entry_id, _invoice.company_id, _receivable_account, _item_order,
    'Potraživanje od kupca - ' || _partner.name,
    _invoice.total_amount, 0, _invoice.partner_id
  );

  FOR _vat_rec IN
    SELECT vat_rate, SUM(line_subtotal) as total_base, SUM(line_vat) as total_vat, SUM(line_total) as total_amount
    FROM invoice_items WHERE invoice_id = _invoice_id GROUP BY vat_rate ORDER BY vat_rate DESC
  LOOP
    _item_order := _item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount
    ) VALUES (
      _journal_entry_id, _invoice.company_id, '6100', _item_order,
      'Prihod od prodaje - PDV ' || _vat_rec.vat_rate || '%',
      0, _vat_rec.total_base
    );

    IF _vat_rec.total_vat > 0 THEN
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount
      ) VALUES (
        _journal_entry_id, _invoice.company_id,
        CASE WHEN _vat_rec.vat_rate = 10 THEN '4701' ELSE '4700' END,
        _item_order,
        'PDV ' || _vat_rec.vat_rate || '% - faktura ' || _invoice.invoice_number,
        0, _vat_rec.total_vat
      );
    END IF;

    IF _vat_rec.vat_rate = 20 THEN
      _popdv_base_20 := _popdv_base_20 + _vat_rec.total_base;
      _popdv_vat_20 := _popdv_vat_20 + _vat_rec.total_vat;
    ELSIF _vat_rec.vat_rate = 10 THEN
      _popdv_base_10 := _popdv_base_10 + _vat_rec.total_base;
      _popdv_vat_10 := _popdv_vat_10 + _vat_rec.total_vat;
    END IF;
  END LOOP;

  IF _invoice.advance_invoice_id IS NOT NULL THEN
    SELECT * INTO _advance_doc FROM advance_invoices WHERE id = _invoice.advance_invoice_id;
    IF FOUND AND _advance_doc.status = 'posted' THEN
      SELECT
        COALESCE(SUM(CASE WHEN aii.vat_rate = 20 THEN aii.line_subtotal ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN aii.vat_rate = 20 THEN aii.line_vat ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN aii.vat_rate = 10 THEN aii.line_subtotal ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN aii.vat_rate = 10 THEN aii.line_vat ELSE 0 END), 0)
      INTO _adv_popdv_base_20, _adv_popdv_vat_20, _adv_popdv_base_10, _adv_popdv_vat_10
      FROM advance_invoice_items aii WHERE aii.advance_invoice_id = _invoice.advance_invoice_id;

      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, partner_id
      ) VALUES (
        _journal_entry_id, _invoice.company_id, _receivable_account, _item_order,
        'Zatvaranje avansa ' || _advance_doc.advance_number || ' - ' || _partner.name,
        0, _advance_doc.total_amount, _invoice.partner_id
      );

      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, partner_id
      ) VALUES (
        _journal_entry_id, _invoice.company_id, '4300', _item_order,
        'Storno PDV avansa ' || _advance_doc.advance_number,
        0, _advance_doc.vat_amount, _invoice.partner_id
      );

      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, partner_id
      ) VALUES (
        _journal_entry_id, _invoice.company_id, '2300', _item_order,
        'Zatvaranje primljenog avansa ' || _advance_doc.advance_number,
        _advance_doc.total_amount, 0, _invoice.partner_id
      );

      FOR _vat_rec IN
        SELECT vat_rate, SUM(line_vat) as total_vat
        FROM advance_invoice_items
        WHERE advance_invoice_id = _invoice.advance_invoice_id
        GROUP BY vat_rate HAVING SUM(line_vat) != 0
      LOOP
        _item_order := _item_order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order, description,
          debit_amount, credit_amount
        ) VALUES (
          _journal_entry_id, _invoice.company_id,
          CASE WHEN _vat_rec.vat_rate = 10 THEN '4730' ELSE '4720' END,
          _item_order,
          'Storno PDV na avans ' || _vat_rec.vat_rate || '% - ' || _advance_doc.advance_number,
          _vat_rec.total_vat, 0
        );
      END LOOP;
    END IF;
  END IF;

  UPDATE invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = _journal_entry_id
  WHERE id = _invoice_id;

  -- POPDV
  _popdv_report_id := public.ensure_popdv_report(
    _invoice.company_id, _invoice.business_year_id, _invoice.invoice_date::date, _user_id
  );
  _popdv_partner_info := _partner.code || ' - ' || _partner.name || COALESCE(' (PIB: ' || _partner.pib || ')', '');

  SELECT COALESCE(SUM(CASE WHEN ii.vat_rate = 20 THEN ii.line_subtotal ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ii.vat_rate = 20 THEN ii.line_vat ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ii.vat_rate = 10 THEN ii.line_subtotal ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ii.vat_rate = 10 THEN ii.line_vat ELSE 0 END), 0)
  INTO _popdv_base_20, _popdv_vat_20, _popdv_base_10, _popdv_vat_10
  FROM invoice_items ii WHERE ii.invoice_id = _invoice_id;

  SELECT COALESCE(MAX(item_order), 0) + 1 INTO _popdv_next_order
  FROM popdv_report_detail_rows WHERE report_id = _popdv_report_id AND section = '3' AND row_code = '3.2';

  INSERT INTO popdv_report_detail_rows (
    report_id, company_id, section, row_code,
    document_date, document_type_number, partner_info, supplier_document_number,
    values, item_order, source_document_id
  ) VALUES (
    _popdv_report_id, _invoice.company_id, '3', '3.2',
    _invoice.invoice_date::date,
    'Faktura ' || _invoice.invoice_number,
    _popdv_partner_info,
    NULL,
    jsonb_build_object('opsta_osnov', _popdv_base_20, 'opsta_pdv', _popdv_vat_20, 'posebna_osnov', _popdv_base_10, 'posebna_pdv', _popdv_vat_10),
    _popdv_next_order, _invoice_id
  );

  IF _invoice.advance_invoice_id IS NOT NULL AND (_adv_popdv_base_20 > 0 OR _adv_popdv_vat_20 > 0 OR _adv_popdv_base_10 > 0 OR _adv_popdv_vat_10 > 0) THEN
    SELECT COALESCE(MAX(item_order), 0) + 1 INTO _popdv_next_order
    FROM popdv_report_detail_rows WHERE report_id = _popdv_report_id AND section = '3' AND row_code = '3.9';

    INSERT INTO popdv_report_detail_rows (
      report_id, company_id, section, row_code,
      document_date, document_type_number, partner_info, supplier_document_number,
      values, item_order, source_document_id
    ) VALUES (
      _popdv_report_id, _invoice.company_id, '3', '3.9',
      _invoice.invoice_date::date,
      'Storno avansa AF ' || _advance_doc.advance_number || ' po FAK ' || _invoice.invoice_number,
      _popdv_partner_info,
      NULL,
      jsonb_build_object('opsta_osnov', -_adv_popdv_base_20, 'opsta_pdv', -_adv_popdv_vat_20, 'posebna_osnov', -_adv_popdv_base_10, 'posebna_pdv', -_adv_popdv_vat_10),
      _popdv_next_order, _invoice_id
    );
  END IF;

  RETURN TRUE;
END;
$$;

-- Update post_advance_invoice to set supplier_document_number
CREATE OR REPLACE FUNCTION public.post_advance_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc advance_invoices%ROWTYPE;
  _journal_entry_id uuid;
  _journal_entry_number text;
  _partner partners%ROWTYPE;
  _item_order int := 0;
  _org_unit_code text;
  _is_foreign boolean := false;
  _vat_rec RECORD;
  _popdv_report_id uuid;
  _popdv_next_order int;
  _popdv_base_20 numeric := 0;
  _popdv_vat_20 numeric := 0;
  _popdv_base_10 numeric := 0;
  _popdv_vat_10 numeric := 0;
  _total_vat numeric := 0;
  _popdv_partner_info text;
BEGIN
  SELECT * INTO _doc FROM advance_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Avansni račun nije pronađen'; END IF;
  IF _doc.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;
  IF _doc.total_amount <= 0 THEN RAISE EXCEPTION 'Dokument mora imati pozitivan iznos'; END IF;

  SELECT * INTO _partner FROM partners WHERE id = _doc.partner_id;
  _is_foreign := (_partner.country IS NOT NULL AND _partner.country != 'Srbija');

  IF _doc.org_unit_id IS NOT NULL THEN
    SELECT code INTO _org_unit_code FROM organizational_units WHERE id = _doc.org_unit_id;
  END IF;

  _total_vat := _doc.vat_amount;
  _journal_entry_number := 'AVR' || _doc.advance_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, org_unit_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit, posted_at, posted_by,
    source_document_type, source_document_id, created_by
  ) VALUES (
    _doc.company_id, _doc.business_year_id, _doc.org_unit_id,
    _journal_entry_number, _doc.advance_date::date, _doc.advance_date::date,
    _doc.advance_number,
    'Avansni račun ' || _doc.advance_number || ' - ' || _partner.name,
    'posted', _total_vat, _total_vat,
    now(), _user_id, 'advance_invoice', _invoice_id, _user_id
  ) RETURNING id INTO _journal_entry_id;

  _item_order := _item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id, cost_center_code
  ) VALUES (
    _journal_entry_id, _doc.company_id, '4300', _item_order,
    'PDV po avansu - ' || _doc.advance_number || ' - ' || _partner.name,
    _total_vat, 0, _doc.partner_id, _org_unit_code
  );

  FOR _vat_rec IN
    SELECT vat_rate, SUM(line_vat) as total_vat, SUM(line_subtotal) as total_base
    FROM advance_invoice_items WHERE advance_invoice_id = _invoice_id
    GROUP BY vat_rate HAVING SUM(line_vat) != 0
  LOOP
    _item_order := _item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount
    ) VALUES (
      _journal_entry_id, _doc.company_id,
      CASE WHEN _vat_rec.vat_rate = 10 THEN '4730' ELSE '4720' END,
      _item_order,
      'PDV na avans ' || _vat_rec.vat_rate || '% - ' || _doc.advance_number,
      0, _vat_rec.total_vat
    );

    IF _vat_rec.vat_rate = 20 THEN
      _popdv_base_20 := _popdv_base_20 + _vat_rec.total_base;
      _popdv_vat_20 := _popdv_vat_20 + _vat_rec.total_vat;
    ELSIF _vat_rec.vat_rate = 10 THEN
      _popdv_base_10 := _popdv_base_10 + _vat_rec.total_base;
      _popdv_vat_10 := _popdv_vat_10 + _vat_rec.total_vat;
    END IF;
  END LOOP;

  UPDATE advance_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = _journal_entry_id
  WHERE id = _invoice_id;

  _popdv_partner_info := _partner.code || ' - ' || _partner.name || COALESCE(' (PIB: ' || _partner.pib || ')', '');

  IF NOT _is_foreign AND (_popdv_base_20 > 0 OR _popdv_vat_20 > 0 OR _popdv_base_10 > 0 OR _popdv_vat_10 > 0) THEN
    _popdv_report_id := public.ensure_popdv_report(
      _doc.company_id, _doc.business_year_id, _doc.advance_date::date, _user_id
    );

    SELECT COALESCE(MAX(item_order), 0) + 1 INTO _popdv_next_order
    FROM popdv_report_detail_rows WHERE report_id = _popdv_report_id AND section = '3' AND row_code = '3.9';

    INSERT INTO popdv_report_detail_rows (
      report_id, company_id, section, row_code, item_order,
      document_date, document_type_number, partner_info, supplier_document_number,
      values, source_document_id
    ) VALUES (
      _popdv_report_id, _doc.company_id, '3', '3.9', _popdv_next_order,
      _doc.advance_date::date,
      'AF ' || _doc.advance_number,
      _popdv_partner_info,
      NULL,
      jsonb_build_object('opsta_osnov', _popdv_base_20, 'opsta_pdv', _popdv_vat_20, 'posebna_osnov', _popdv_base_10, 'posebna_pdv', _popdv_vat_10),
      _invoice_id
    );
  END IF;

  RETURN TRUE;
END;
$$;

-- Update post_advance_purchase_invoice to set supplier_document_number
CREATE OR REPLACE FUNCTION public.post_advance_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc advance_purchase_invoices%ROWTYPE;
  _journal_entry_id uuid;
  _journal_entry_number text;
  _partner partners%ROWTYPE;
  _item_order int := 0;
  _org_unit_code text;
  _is_foreign boolean := false;
  _vat_rec RECORD;
  _supplier_account text;
  _advance_account text;
  _total_debit numeric := 0;
  _total_credit numeric := 0;
  _popdv_report_id uuid;
  _popdv_next_order int;
  _popdv_base_20 numeric := 0;
  _popdv_vat_20 numeric := 0;
  _popdv_base_10 numeric := 0;
  _popdv_vat_10 numeric := 0;
  _popdv_partner_info text;
BEGIN
  SELECT * INTO _doc FROM advance_purchase_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'UFA nije pronađena'; END IF;
  IF _doc.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;
  IF _doc.total_amount <= 0 THEN RAISE EXCEPTION 'Dokument mora imati pozitivan iznos'; END IF;

  SELECT * INTO _partner FROM partners WHERE id = _doc.partner_id;
  _is_foreign := (_partner.legal_status = 4);

  IF _is_foreign THEN _supplier_account := '4360'; _advance_account := '1510';
  ELSE _supplier_account := '4350'; _advance_account := '1500'; END IF;

  IF _doc.org_unit_id IS NOT NULL THEN
    SELECT code INTO _org_unit_code FROM organizational_units WHERE id = _doc.org_unit_id;
  END IF;

  _journal_entry_number := 'UFA' || _doc.internal_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, org_unit_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit, posted_at, posted_by,
    source_document_type, source_document_id, created_by
  ) VALUES (
    _doc.company_id, _doc.business_year_id, _doc.org_unit_id,
    _journal_entry_number, _doc.receipt_date, _doc.due_date,
    _doc.supplier_invoice_number,
    'UFA: ' || _doc.internal_number || ' - ' || COALESCE(_doc.supplier_name, _partner.name),
    'posted', 0, 0, now(), _user_id, 'advance_purchase_invoice', _invoice_id, _user_id
  ) RETURNING id INTO _journal_entry_id;

  _item_order := _item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id, document_date
  ) VALUES (
    _journal_entry_id, _doc.company_id, _supplier_account, _item_order,
    'Obaveza po avansu ' || _doc.supplier_invoice_number || ' - ' || COALESCE(_doc.supplier_name, _partner.name),
    0, _doc.total_amount, _doc.partner_id, _doc.due_date
  );
  _total_credit := _total_credit + _doc.total_amount;

  _item_order := _item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id, cost_center_code, document_date
  ) VALUES (
    _journal_entry_id, _doc.company_id, _advance_account, _item_order,
    'Dati avans ' || COALESCE(_doc.supplier_name, _partner.name),
    _doc.subtotal, 0, _doc.partner_id, _org_unit_code, _doc.receipt_date
  );
  _total_debit := _total_debit + _doc.subtotal;

  IF _doc.supplier_is_in_pdv AND NOT _is_foreign THEN
    FOR _vat_rec IN
      SELECT vat_rate, SUM(line_vat) as total_vat, SUM(line_subtotal) as total_base
      FROM advance_purchase_invoice_items WHERE advance_purchase_invoice_id = _invoice_id
      GROUP BY vat_rate HAVING SUM(line_vat) > 0
    LOOP
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, cost_center_code, document_date
      ) VALUES (
        _journal_entry_id, _doc.company_id,
        CASE WHEN _vat_rec.vat_rate = 10 THEN '2730' ELSE '2720' END, _item_order,
        'Prethodni PDV iz avansa ' || _vat_rec.vat_rate || '% - ' || _doc.internal_number,
        _vat_rec.total_vat, 0, _org_unit_code, _doc.receipt_date
      );
      _total_debit := _total_debit + _vat_rec.total_vat;

      IF _vat_rec.vat_rate = 20 THEN
        _popdv_base_20 := _popdv_base_20 + _vat_rec.total_base; _popdv_vat_20 := _popdv_vat_20 + _vat_rec.total_vat;
      ELSIF _vat_rec.vat_rate = 10 THEN
        _popdv_base_10 := _popdv_base_10 + _vat_rec.total_base; _popdv_vat_10 := _popdv_vat_10 + _vat_rec.total_vat;
      END IF;
    END LOOP;
  END IF;

  IF NOT _doc.supplier_is_in_pdv OR _is_foreign THEN
    UPDATE journal_entry_items SET debit_amount = _doc.total_amount
    WHERE journal_entry_id = _journal_entry_id AND account_code = _advance_account;
    _total_debit := _doc.total_amount;
  END IF;

  UPDATE journal_entries SET total_debit = _total_debit, total_credit = _total_credit WHERE id = _journal_entry_id;

  UPDATE advance_purchase_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = _journal_entry_id, updated_at = now()
  WHERE id = _invoice_id;

  _popdv_partner_info := _partner.code || ' - ' || COALESCE(_doc.supplier_name, _partner.name) || COALESCE(' (PIB: ' || _partner.pib || ')', '');

  IF NOT _is_foreign AND _doc.supplier_is_in_pdv AND (_popdv_base_20 > 0 OR _popdv_vat_20 > 0 OR _popdv_base_10 > 0 OR _popdv_vat_10 > 0) THEN
    _popdv_report_id := public.ensure_popdv_report(
      _doc.company_id, _doc.business_year_id, _doc.invoice_date::date, _user_id
    );
    SELECT COALESCE(MAX(item_order), 0) + 1 INTO _popdv_next_order
    FROM popdv_report_detail_rows WHERE report_id = _popdv_report_id AND section = '8' AND row_code = '8a.7';

    INSERT INTO popdv_report_detail_rows (
      report_id, company_id, section, row_code, item_order,
      document_date, document_type_number, partner_info, supplier_document_number,
      values, source_document_id
    ) VALUES (
      _popdv_report_id, _doc.company_id, '8', '8a.7', _popdv_next_order,
      _doc.invoice_date, 'UFA ' || _doc.internal_number,
      _popdv_partner_info, _doc.supplier_invoice_number,
      jsonb_build_object('opsta_osnov', _popdv_base_20, 'opsta_pdv', _popdv_vat_20, 'posebna_osnov', _popdv_base_10, 'posebna_pdv', _popdv_vat_10),
      _invoice_id
    );
  END IF;

  RETURN true;
END;
$$;
