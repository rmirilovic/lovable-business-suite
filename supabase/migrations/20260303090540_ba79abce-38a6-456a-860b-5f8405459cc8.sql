
-- Replace post_advance_invoice with correct accounting
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
  _receivable_account text;
  _item_order int := 0;
  _org_unit_code text;
  _is_foreign boolean := false;
  _vat_rec RECORD;
  _popdv_report RECORD;
  _popdv_next_order int;
  _popdv_base_20 numeric := 0;
  _popdv_vat_20 numeric := 0;
  _popdv_base_10 numeric := 0;
  _popdv_vat_10 numeric := 0;
BEGIN
  SELECT * INTO _doc FROM advance_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Avansni račun nije pronađen'; END IF;
  IF _doc.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;
  IF _doc.total_amount <= 0 THEN RAISE EXCEPTION 'Dokument mora imati pozitivan iznos'; END IF;

  SELECT * INTO _partner FROM partners WHERE id = _doc.partner_id;

  -- Determine if foreign partner
  _is_foreign := (_partner.country IS NOT NULL AND _partner.country != 'Srbija');

  -- Determine receivable account
  IF _is_foreign THEN
    _receivable_account := '2050';
  ELSIF _partner.legal_status = 2 THEN
    _receivable_account := '2041';
  ELSE
    _receivable_account := '2040';
  END IF;

  -- Get OJ code for analytics
  IF _doc.org_unit_id IS NOT NULL THEN
    SELECT code INTO _org_unit_code FROM organizational_units WHERE id = _doc.org_unit_id;
  END IF;

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
    'posted', _doc.total_amount, _doc.total_amount,
    now(), _user_id, 'advance_invoice', _invoice_id, _user_id
  ) RETURNING id INTO _journal_entry_id;

  -- 1. Debit: Kupci (receivable) - full amount with partner analytics
  _item_order := _item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id
  ) VALUES (
    _journal_entry_id, _doc.company_id, _receivable_account, _item_order,
    'Potraživanje po avansu - ' || _partner.name,
    _doc.total_amount, 0, _doc.partner_id
  );

  -- 2. Credit: Primljeni avansi (430) - subtotal (bez PDV)
  _item_order := _item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id, cost_center_code
  ) VALUES (
    _journal_entry_id, _doc.company_id, '430', _item_order,
    'Primljeni avans - ' || _doc.advance_number,
    0, _doc.subtotal, _doc.partner_id, _org_unit_code
  );

  -- 3. Credit: PDV po primljenim avansima - split by VAT rate (472 for 20%, 472 for 10%)
  FOR _vat_rec IN
    SELECT
      vat_rate,
      SUM(line_vat) as total_vat,
      SUM(line_subtotal) as total_base
    FROM advance_invoice_items
    WHERE advance_invoice_id = _invoice_id
    GROUP BY vat_rate
    HAVING SUM(line_vat) != 0
  LOOP
    _item_order := _item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount
    ) VALUES (
      _journal_entry_id, _doc.company_id,
      CASE WHEN _vat_rec.vat_rate = 10 THEN '4721' ELSE '4720' END,
      _item_order,
      'PDV na avans ' || _vat_rec.vat_rate || '% - ' || _doc.advance_number,
      0, _vat_rec.total_vat
    );

    -- Accumulate for POPDV
    IF _vat_rec.vat_rate = 20 THEN
      _popdv_base_20 := _popdv_base_20 + _vat_rec.total_base;
      _popdv_vat_20 := _popdv_vat_20 + _vat_rec.total_vat;
    ELSIF _vat_rec.vat_rate = 10 THEN
      _popdv_base_10 := _popdv_base_10 + _vat_rec.total_base;
      _popdv_vat_10 := _popdv_vat_10 + _vat_rec.total_vat;
    END IF;
  END LOOP;

  -- Update advance invoice status
  UPDATE advance_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = _journal_entry_id
  WHERE id = _invoice_id;

  -- POPDV: Add analytical row for domestic partners only
  IF NOT _is_foreign AND (_popdv_base_20 > 0 OR _popdv_base_10 > 0) THEN
    -- Find active POPDV report for the period
    SELECT pr.* INTO _popdv_report
    FROM popdv_reports pr
    WHERE pr.company_id = _doc.company_id
      AND pr.status = 'draft'
      AND _doc.advance_date::date >= pr.period_from
      AND _doc.advance_date::date <= pr.period_to
    ORDER BY pr.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      -- Get next order
      SELECT COALESCE(MAX(item_order), -1) + 1 INTO _popdv_next_order
      FROM popdv_report_detail_rows
      WHERE report_id = _popdv_report.id AND row_code = '1.7';

      -- Row 1.7 for general rate advances (section 1)
      IF _popdv_base_20 > 0 THEN
        INSERT INTO popdv_report_detail_rows (
          report_id, company_id, section, row_code,
          document_date, document_type_number, partner_info,
          values, item_order, source_document_id
        ) VALUES (
          _popdv_report.id, _doc.company_id, '1', '1.7',
          _doc.advance_date::date,
          'AVR ' || _doc.advance_number,
          _partner.name || COALESCE(' (PIB: ' || _partner.pib || ')', ''),
          jsonb_build_object(
            'opsta_osnov', _popdv_base_20,
            'opsta_pdv', _popdv_vat_20
          ),
          _popdv_next_order,
          _invoice_id
        );
      END IF;

      -- Row 2.7 for reduced rate advances (section 2)
      IF _popdv_base_10 > 0 THEN
        SELECT COALESCE(MAX(item_order), -1) + 1 INTO _popdv_next_order
        FROM popdv_report_detail_rows
        WHERE report_id = _popdv_report.id AND row_code = '2.7';

        INSERT INTO popdv_report_detail_rows (
          report_id, company_id, section, row_code,
          document_date, document_type_number, partner_info,
          values, item_order, source_document_id
        ) VALUES (
          _popdv_report.id, _doc.company_id, '2', '2.7',
          _doc.advance_date::date,
          'AVR ' || _doc.advance_number,
          _partner.name || COALESCE(' (PIB: ' || _partner.pib || ')', ''),
          jsonb_build_object(
            'posebna_osnov', _popdv_base_10,
            'posebna_pdv', _popdv_vat_10
          ),
          _popdv_next_order,
          _invoice_id
        );
      END IF;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

-- Replace unpost_advance_invoice with POPDV cleanup
CREATE OR REPLACE FUNCTION public.unpost_advance_invoice(_invoice_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc advance_invoices%ROWTYPE;
  _je_id uuid;
BEGIN
  SELECT * INTO _doc FROM advance_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Avansni račun nije pronađen'; END IF;
  IF _doc.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjiženi dokumenti mogu biti poništeni'; END IF;

  _je_id := _doc.journal_entry_id;

  -- Reset advance invoice status first (to clear FK)
  UPDATE advance_invoices
  SET status = 'draft', posted_at = NULL, posted_by = NULL, journal_entry_id = NULL
  WHERE id = _invoice_id;

  -- Delete journal entry
  IF _je_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = _je_id;
    DELETE FROM journal_entries WHERE id = _je_id;
  END IF;

  -- Delete associated POPDV analytical rows
  DELETE FROM popdv_report_detail_rows
  WHERE source_document_id = _invoice_id;

  RETURN TRUE;
END;
$$;
