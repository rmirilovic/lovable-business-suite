CREATE OR REPLACE FUNCTION public.post_invoice(_invoice_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _invoice invoices%ROWTYPE;
  _partner partners%ROWTYPE;
  _journal_entry_id uuid;
  _journal_entry_number text;
  _item_order int := 0;
  _receivable_account text;
  _income_account text;
  _is_foreign boolean := false;
  _fx numeric := 1;
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
  _total_debit_rsd numeric;
  _total_credit_rsd numeric;
BEGIN
  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF _invoice.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;
  IF _invoice.total_amount <= 0 THEN RAISE EXCEPTION 'Faktura mora imati pozitivan iznos'; END IF;

  SELECT * INTO _partner FROM partners WHERE id = _invoice.partner_id;

  -- Ino partner: legal_status = 4
  _is_foreign := (_partner.legal_status = 4);

  IF _is_foreign THEN
    _receivable_account := '2050';
    _income_account := '6200';
    _fx := COALESCE(NULLIF(_invoice.exchange_rate, 0), 1);
    IF COALESCE(_invoice.currency, 'RSD') = 'RSD' THEN
      _fx := 1;
    END IF;
  ELSE
    _receivable_account := '2040';
    _income_account := '6100';
    _fx := 1;
  END IF;

  IF _invoice.org_unit_id IS NOT NULL THEN
    SELECT code INTO _org_unit_code FROM organizational_units WHERE id = _invoice.org_unit_id;
  END IF;

  _journal_entry_number := 'FAK' || _invoice.invoice_number;
  _total_debit_rsd := round(_invoice.total_amount * _fx, 2);
  _total_credit_rsd := _total_debit_rsd;

  INSERT INTO journal_entries (
    company_id, business_year_id, org_unit_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit, posted_at, posted_by,
    source_document_type, source_document_id, created_by
  ) VALUES (
    _invoice.company_id, _invoice.business_year_id, _invoice.org_unit_id,
    _journal_entry_number, _invoice.invoice_date::date, _invoice.invoice_date::date,
    _invoice.invoice_number,
    'Faktura ' || _invoice.invoice_number || ' - ' || _partner.name
      || CASE WHEN _is_foreign AND COALESCE(_invoice.currency,'RSD') != 'RSD'
              THEN ' (' || _invoice.currency || ' ' || _invoice.total_amount || ' @ ' || _fx || ')'
              ELSE '' END,
    'posted', _total_debit_rsd, _total_credit_rsd,
    now(), _user_id, 'invoice', _invoice_id, _user_id
  ) RETURNING id INTO _journal_entry_id;

  _item_order := _item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id
  ) VALUES (
    _journal_entry_id, _invoice.company_id, _receivable_account, _item_order,
    'Potraživanje od kupca - ' || _partner.name
      || CASE WHEN _is_foreign AND COALESCE(_invoice.currency,'RSD') != 'RSD'
              THEN ' (' || _invoice.currency || ' ' || _invoice.total_amount || ')' ELSE '' END,
    _total_debit_rsd, 0, _invoice.partner_id
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
      _journal_entry_id, _invoice.company_id, _income_account, _item_order,
      CASE WHEN _is_foreign THEN 'Prihod od prodaje u inostranstvu'
           ELSE 'Prihod od prodaje - PDV ' || _vat_rec.vat_rate || '%' END,
      0, round(_vat_rec.total_base * _fx, 2)
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
        0, round(_vat_rec.total_vat * _fx, 2)
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

  IF _is_foreign THEN
    -- Izvoz: POPDV polje 1.4 (oslobođenje sa pravom na odbitak prethodnog poreza)
    SELECT COALESCE(MAX(item_order), 0) + 1 INTO _popdv_next_order
    FROM popdv_report_detail_rows WHERE report_id = _popdv_report_id AND section = '1' AND row_code = '1.4';

    INSERT INTO popdv_report_detail_rows (
      report_id, company_id, section, row_code,
      document_date, document_type_number, partner_info, supplier_document_number,
      values, item_order, source_document_id
    ) VALUES (
      _popdv_report_id, _invoice.company_id, '1', '1.4',
      _invoice.invoice_date::date,
      'Izvozna faktura ' || _invoice.invoice_number
        || COALESCE(' / JCI ' || _invoice.jci_number, ''),
      _popdv_partner_info,
      _invoice.jci_number,
      jsonb_build_object('iznos', round(_invoice.total_amount * _fx, 2)),
      _popdv_next_order, _invoice_id
    );
  ELSE
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
  END IF;

  RETURN TRUE;
END;
$function$;