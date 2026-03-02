
CREATE OR REPLACE FUNCTION public.post_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice invoices%ROWTYPE;
  _journal_entry_id uuid;
  _journal_entry_number text;
  _partner partners%ROWTYPE;
  _receivable_account text;
  _item_order int := 0;
  _svk_rec RECORD;
  _vat_rec RECORD;
  _total_debit numeric := 0;
  _total_credit numeric := 0;
  _popdv_report RECORD;
  _popdv_next_order int;
  _popdv_base_20 numeric := 0;
  _popdv_vat_20 numeric := 0;
  _popdv_base_10 numeric := 0;
  _popdv_vat_10 numeric := 0;
BEGIN
  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF _invoice.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;
  IF _invoice.total_amount <= 0 THEN RAISE EXCEPTION 'Faktura mora imati pozitivan iznos'; END IF;

  SELECT * INTO _partner FROM partners WHERE id = _invoice.partner_id;

  IF _partner.country IS NOT NULL AND _partner.country != 'Srbija' THEN
    _receivable_account := '2050';
  ELSIF _partner.legal_status = 2 THEN
    _receivable_account := '2041';
  ELSE
    _receivable_account := '2040';
  END IF;

  _journal_entry_number := 'FAK' || _invoice.invoice_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, org_unit_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit, posted_at, posted_by,
    source_document_type, source_document_id, created_by
  ) VALUES (
    _invoice.company_id, _invoice.business_year_id, _invoice.org_unit_id,
    _journal_entry_number, _invoice.invoice_date, _invoice.invoice_date,
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

  FOR _svk_rec IN
    SELECT COALESCE(a.svk, '1') as svk_code, SUM(ii.line_subtotal) as subtotal
    FROM invoice_items ii LEFT JOIN articles a ON a.id = ii.article_id
    WHERE ii.invoice_id = _invoice_id
    GROUP BY COALESCE(a.svk, '1') HAVING SUM(ii.line_subtotal) != 0
  LOOP
    IF _svk_rec.svk_code = '9' THEN
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (_journal_entry_id, _invoice.company_id, '6141', _item_order, 'Prihod od prodaje GP - faktura ' || _invoice.invoice_number, 0, _svk_rec.subtotal);
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (_journal_entry_id, _invoice.company_id, '9800', _item_order, 'Cena koštanja GP - faktura ' || _invoice.invoice_number, _svk_rec.subtotal, 0);
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (_journal_entry_id, _invoice.company_id, '9600', _item_order, 'Gotovi proizvodi - faktura ' || _invoice.invoice_number, 0, _svk_rec.subtotal);
    ELSE
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (_journal_entry_id, _invoice.company_id, '6100', _item_order, 'Prihod od prodaje - faktura ' || _invoice.invoice_number, 0, _svk_rec.subtotal);
    END IF;
  END LOOP;

  FOR _vat_rec IN
    SELECT ii.vat_rate, SUM(ii.line_vat) as vat_total
    FROM invoice_items ii WHERE ii.invoice_id = _invoice_id
    GROUP BY ii.vat_rate HAVING SUM(ii.line_vat) != 0 ORDER BY ii.vat_rate DESC
  LOOP
    _item_order := _item_order + 1;
    INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
    VALUES (_journal_entry_id, _invoice.company_id,
      CASE WHEN _vat_rec.vat_rate = 20 THEN '4700' WHEN _vat_rec.vat_rate = 10 THEN '4710' ELSE '4700' END,
      _item_order, 'PDV ' || _vat_rec.vat_rate || '% - faktura ' || _invoice.invoice_number, 0, _vat_rec.vat_total);
  END LOOP;

  SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
  INTO _total_debit, _total_credit
  FROM journal_entry_items WHERE journal_entry_id = _journal_entry_id;

  UPDATE journal_entries SET total_debit = _total_debit, total_credit = _total_credit WHERE id = _journal_entry_id;

  UPDATE invoices SET status = 'posted', posted_at = now(), posted_by = _user_id, journal_entry_id = _journal_entry_id WHERE id = _invoice_id;

  -- POPDV: Auto-add to section 3.2
  SELECT pr.* INTO _popdv_report FROM popdv_reports pr
  WHERE pr.company_id = _invoice.company_id
    AND pr.period_start <= _invoice.invoice_date::date
    AND pr.period_end >= _invoice.invoice_date::date
  LIMIT 1;

  IF FOUND THEN
    SELECT COALESCE(SUM(CASE WHEN ii.vat_rate = 20 THEN ii.line_subtotal ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN ii.vat_rate = 20 THEN ii.line_vat ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN ii.vat_rate = 10 THEN ii.line_subtotal ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN ii.vat_rate = 10 THEN ii.line_vat ELSE 0 END), 0)
    INTO _popdv_base_20, _popdv_vat_20, _popdv_base_10, _popdv_vat_10
    FROM invoice_items ii WHERE ii.invoice_id = _invoice_id;

    SELECT COALESCE(MAX(item_order), 0) + 1 INTO _popdv_next_order
    FROM popdv_report_detail_rows WHERE report_id = _popdv_report.id AND section = '3' AND row_code = '3.2';

    -- document_date is TEXT column, store formatted
    INSERT INTO popdv_report_detail_rows (
      report_id, company_id, section, row_code,
      document_date, document_type_number, partner_info,
      values, item_order
    ) VALUES (
      _popdv_report.id, _invoice.company_id, '3', '3.2',
      to_char(_invoice.invoice_date::date, 'DD.MM.YYYY'),
      'Faktura ' || _invoice.invoice_number,
      COALESCE(_partner.pib, '') || ' / ' || _partner.name,
      jsonb_build_object('opsta_osnov', _popdv_base_20, 'opsta_pdv', _popdv_vat_20, 'posebna_osnov', _popdv_base_10, 'posebna_pdv', _popdv_vat_10),
      _popdv_next_order
    );
  END IF;

  RETURN TRUE;
END;
$$;
