
-- Helper function: find or auto-create POPDV report for a given document date
CREATE OR REPLACE FUNCTION public.ensure_popdv_report(
  _company_id uuid,
  _business_year_id uuid,
  _document_date date,
  _user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _report_id uuid;
  _vat_period_type text;
  _period_start date;
  _period_end date;
  _period_label text;
  _period_type text;
  _month_names text[] := ARRAY['Januar','Februar','Mart','April','Maj','Jun','Jul','Avgust','Septembar','Oktobar','Novembar','Decembar'];
  _year int;
BEGIN
  -- Determine period boundaries based on company's VAT period type
  SELECT vat_period_type INTO _vat_period_type FROM companies WHERE id = _company_id;
  _vat_period_type := COALESCE(_vat_period_type, 'monthly');
  _year := EXTRACT(YEAR FROM _document_date)::int;

  IF _vat_period_type = 'monthly' THEN
    _period_start := date_trunc('month', _document_date)::date;
    _period_end := (date_trunc('month', _document_date) + interval '1 month' - interval '1 day')::date;
    _period_type := 'monthly';
    _period_label := _month_names[EXTRACT(MONTH FROM _document_date)::int] || ' ' || _year;
  ELSE
    _period_start := date_trunc('quarter', _document_date)::date;
    _period_end := (date_trunc('quarter', _document_date) + interval '3 months' - interval '1 day')::date;
    _period_type := 'quarterly';
    _period_label := 'Q' || EXTRACT(QUARTER FROM _document_date)::int || ' ' || _year;
  END IF;

  -- Try to find existing report
  SELECT id INTO _report_id FROM popdv_reports
  WHERE company_id = _company_id
    AND period_start = _period_start
    AND period_end = _period_end
  LIMIT 1;

  -- Auto-create if not found
  IF _report_id IS NULL THEN
    INSERT INTO popdv_reports (
      company_id, business_year_id, period_type, period_start, period_end,
      period_label, status, created_by
    ) VALUES (
      _company_id, _business_year_id, _period_type, _period_start, _period_end,
      _period_label, 'draft', _user_id
    ) RETURNING id INTO _report_id;
  END IF;

  RETURN _report_id;
END;
$$;

-- ============================================================
-- UPDATE post_invoice: replace POPDV lookup with ensure_popdv_report
-- ============================================================
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
  _org_unit_code text;
  _warehouse_code text;
  _warehouse_inventory_account text;
  _popdv_report_id uuid;
  _popdv_next_order int;
  _popdv_base_20 numeric := 0;
  _popdv_vat_20 numeric := 0;
  _popdv_base_10 numeric := 0;
  _popdv_vat_10 numeric := 0;
  _svk2_warehouse_value numeric := 0;
  _svk2_selling_value numeric := 0;
  _svk2_diff numeric := 0;
  _svk1_warehouse_value numeric := 0;
  _svk9_warehouse_value numeric := 0;
  _is_foreign boolean := false;
  _service_revenue_account text;
  _advance_doc advance_invoices%ROWTYPE;
  _adv_vat_rec RECORD;
  _adv_total_vat numeric := 0;
  _adv_popdv_base_20 numeric := 0;
  _adv_popdv_vat_20 numeric := 0;
  _adv_popdv_base_10 numeric := 0;
  _adv_popdv_vat_10 numeric := 0;
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

  IF _invoice.source_delivery_note_id IS NOT NULL THEN
    SELECT w.code, w.inventory_account INTO _warehouse_code, _warehouse_inventory_account
    FROM delivery_notes dn
    JOIN warehouses w ON w.id = dn.warehouse_id
    WHERE dn.id = _invoice.source_delivery_note_id;
  END IF;

  IF _is_foreign THEN
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
    _journal_entry_number, _invoice.invoice_date::date, _invoice.invoice_date::date,
    _invoice.invoice_number,
    'Faktura ' || _invoice.invoice_number || ' - ' || _partner.name,
    'posted', _invoice.total_amount, _invoice.total_amount,
    now(), _user_id, 'invoice', _invoice_id, _user_id
  ) RETURNING id INTO _journal_entry_id;

  -- 1. Receivable from customer
  _item_order := _item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id
  ) VALUES (
    _journal_entry_id, _invoice.company_id, _receivable_account, _item_order,
    'Potraživanje od kupca - ' || _partner.name,
    _invoice.total_amount, 0, _invoice.partner_id
  );

  -- 2. Revenue by SVK
  FOR _svk_rec IN
    SELECT 
      COALESCE(a.svk, '0') as svk_code,
      SUM(ii.line_subtotal) as subtotal
    FROM invoice_items ii
    LEFT JOIN articles a ON a.id = ii.article_id
    WHERE ii.invoice_id = _invoice_id
    GROUP BY COALESCE(a.svk, '0')
    HAVING SUM(ii.line_subtotal) != 0
  LOOP
    IF _svk_rec.svk_code = '9' THEN
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, cost_center_code
      ) VALUES (
        _journal_entry_id, _invoice.company_id, '6141', _item_order,
        'Prihod od prodaje GP - faktura ' || _invoice.invoice_number,
        0, _svk_rec.subtotal, _org_unit_code
      );

      SELECT COALESCE(SUM(ii.quantity * COALESCE(a.purchase_price, 0)), 0)
      INTO _svk9_warehouse_value
      FROM invoice_items ii
      JOIN articles a ON a.id = ii.article_id
      WHERE ii.invoice_id = _invoice_id
        AND COALESCE(a.svk, '0') = '9';

      IF _svk9_warehouse_value != 0 THEN
        _item_order := _item_order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order, description,
          debit_amount, credit_amount, cost_center_code
        ) VALUES (
          _journal_entry_id, _invoice.company_id, '9800', _item_order,
          'Cena koštanja GP - faktura ' || _invoice.invoice_number,
          _svk9_warehouse_value, 0, _warehouse_code
        );
        _item_order := _item_order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order, description,
          debit_amount, credit_amount, cost_center_code
        ) VALUES (
          _journal_entry_id, _invoice.company_id, '9600', _item_order,
          'Gotovi proizvodi - faktura ' || _invoice.invoice_number,
          0, _svk9_warehouse_value, _warehouse_code
        );
      END IF;

    ELSIF _svk_rec.svk_code = '1' THEN
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount
      ) VALUES (
        _journal_entry_id, _invoice.company_id, '6100', _item_order,
        'Prihod od prodaje robe - faktura ' || _invoice.invoice_number,
        0, _svk_rec.subtotal
      );

      SELECT COALESCE(SUM(ii.quantity * COALESCE(a.purchase_price, 0)), 0)
      INTO _svk1_warehouse_value
      FROM invoice_items ii
      JOIN articles a ON a.id = ii.article_id
      WHERE ii.invoice_id = _invoice_id
        AND COALESCE(a.svk, '1') = '1';

      IF _svk1_warehouse_value != 0 THEN
        _item_order := _item_order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order, description,
          debit_amount, credit_amount, cost_center_code
        ) VALUES (
          _journal_entry_id, _invoice.company_id, 
          COALESCE(_warehouse_inventory_account, '1320'), _item_order,
          'Roba u magacinu - faktura ' || _invoice.invoice_number,
          0, _svk1_warehouse_value, _warehouse_code
        );

        _item_order := _item_order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order, description,
          debit_amount, credit_amount, cost_center_code
        ) VALUES (
          _journal_entry_id, _invoice.company_id, '6041', _item_order,
          'Nabavna vrednost prodate robe - faktura ' || _invoice.invoice_number,
          _svk1_warehouse_value, 0, _org_unit_code
        );
      END IF;

    ELSIF _svk_rec.svk_code = '2' THEN
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount
      ) VALUES (
        _journal_entry_id, _invoice.company_id, '6100', _item_order,
        'Prihod od prodaje - faktura ' || _invoice.invoice_number,
        0, _svk_rec.subtotal
      );

      SELECT COALESCE(SUM(ii.quantity * COALESCE(a.purchase_price, 0)), 0)
      INTO _svk2_warehouse_value
      FROM invoice_items ii
      JOIN articles a ON a.id = ii.article_id
      WHERE ii.invoice_id = _invoice_id
        AND COALESCE(a.svk, '1') = '2';

      _svk2_selling_value := _svk_rec.subtotal;
      _svk2_diff := _svk2_warehouse_value - _svk2_selling_value;

      IF _svk2_warehouse_value != 0 THEN
        _item_order := _item_order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order, description,
          debit_amount, credit_amount, cost_center_code
        ) VALUES (
          _journal_entry_id, _invoice.company_id, '1010', _item_order,
          'Materijal - prodaja faktura ' || _invoice.invoice_number,
          0, _svk2_warehouse_value, _warehouse_code
        );
      END IF;

      IF _svk2_diff > 0 THEN
        _item_order := _item_order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order, description,
          debit_amount, credit_amount, cost_center_code
        ) VALUES (
          _journal_entry_id, _invoice.company_id, '5730', _item_order,
          'Rashod materijala - faktura ' || _invoice.invoice_number,
          _svk2_diff, 0, _org_unit_code
        );
      END IF;

      IF _svk2_diff < 0 THEN
        _item_order := _item_order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order, description,
          debit_amount, credit_amount, cost_center_code
        ) VALUES (
          _journal_entry_id, _invoice.company_id, '6730', _item_order,
          'Prihod od prodaje materijala - faktura ' || _invoice.invoice_number,
          0, ABS(_svk2_diff), _org_unit_code
        );
      END IF;

    ELSIF _svk_rec.svk_code = '0' THEN
      IF _is_foreign THEN
        _service_revenue_account := '6152';
      ELSE
        _service_revenue_account := '6142';
      END IF;

      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, cost_center_code
      ) VALUES (
        _journal_entry_id, _invoice.company_id, _service_revenue_account, _item_order,
        'Prihod od usluga - faktura ' || _invoice.invoice_number,
        0, _svk_rec.subtotal, _org_unit_code
      );

    ELSE
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount
      ) VALUES (
        _journal_entry_id, _invoice.company_id, '6100', _item_order,
        'Prihod od prodaje - faktura ' || _invoice.invoice_number,
        0, _svk_rec.subtotal
      );
    END IF;
  END LOOP;

  -- 3. VAT entries
  FOR _vat_rec IN
    SELECT 
      ii.vat_rate,
      SUM(ii.line_vat) as vat_total
    FROM invoice_items ii
    WHERE ii.invoice_id = _invoice_id
    GROUP BY ii.vat_rate
    HAVING SUM(ii.line_vat) != 0
    ORDER BY ii.vat_rate DESC
  LOOP
    _item_order := _item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount
    ) VALUES (
      _journal_entry_id, _invoice.company_id,
      CASE WHEN _vat_rec.vat_rate = 20 THEN '4700'
           WHEN _vat_rec.vat_rate = 10 THEN '4710'
           ELSE '4700'
      END,
      _item_order,
      'PDV ' || _vat_rec.vat_rate || '% - faktura ' || _invoice.invoice_number,
      0, _vat_rec.vat_total
    );
  END LOOP;

  -- ADVANCE INVOICE DEDUCTION (if linked)
  IF _invoice.advance_invoice_id IS NOT NULL THEN
    SELECT * INTO _advance_doc FROM advance_invoices WHERE id = _invoice.advance_invoice_id;
    
    IF FOUND AND _advance_doc.status = 'posted' THEN
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, partner_id, cost_center_code
      ) VALUES (
        _journal_entry_id, _invoice.company_id, '4300', _item_order,
        'Preknjiženje avansa ' || _advance_doc.advance_number || ' - bruto uplata',
        _advance_doc.total_amount, 0, _invoice.partner_id, _org_unit_code
      );

      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, partner_id
      ) VALUES (
        _journal_entry_id, _invoice.company_id, _receivable_account, _item_order,
        'Zatvaranje avansa ' || _advance_doc.advance_number || ' - ' || _partner.name,
        0, _advance_doc.total_amount, _invoice.partner_id
      );

      FOR _adv_vat_rec IN
        SELECT vat_rate, SUM(line_vat) as total_vat, SUM(line_subtotal) as total_base
        FROM advance_invoice_items
        WHERE advance_invoice_id = _invoice.advance_invoice_id
        GROUP BY vat_rate
        HAVING SUM(line_vat) != 0
      LOOP
        _item_order := _item_order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order, description,
          debit_amount, credit_amount
        ) VALUES (
          _journal_entry_id, _invoice.company_id,
          CASE WHEN _adv_vat_rec.vat_rate = 10 THEN '4730' ELSE '4720' END,
          _item_order,
          'Storno PDV avansa ' || _adv_vat_rec.vat_rate || '% - AF ' || _advance_doc.advance_number,
          _adv_vat_rec.total_vat, 0
        );

        IF _adv_vat_rec.vat_rate = 20 THEN
          _adv_popdv_base_20 := _adv_popdv_base_20 + _adv_vat_rec.total_base;
          _adv_popdv_vat_20 := _adv_popdv_vat_20 + _adv_vat_rec.total_vat;
        ELSIF _adv_vat_rec.vat_rate = 10 THEN
          _adv_popdv_base_10 := _adv_popdv_base_10 + _adv_vat_rec.total_base;
          _adv_popdv_vat_10 := _adv_popdv_vat_10 + _adv_vat_rec.total_vat;
        END IF;
      END LOOP;

      _adv_total_vat := _advance_doc.vat_amount;
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, partner_id, cost_center_code
      ) VALUES (
        _journal_entry_id, _invoice.company_id, '4300', _item_order,
        'Storno PDV obaveze avansa - AF ' || _advance_doc.advance_number,
        0, _adv_total_vat, _invoice.partner_id, _org_unit_code
      );
    END IF;
  END IF;

  -- 4. Update totals
  SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
  INTO _total_debit, _total_credit
  FROM journal_entry_items WHERE journal_entry_id = _journal_entry_id;

  UPDATE journal_entries
  SET total_debit = _total_debit, total_credit = _total_credit
  WHERE id = _journal_entry_id;

  -- 5. Mark invoice as posted
  UPDATE invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = _journal_entry_id
  WHERE id = _invoice_id;

  -- 6. POPDV integration (auto-create report if needed)
  _popdv_report_id := public.ensure_popdv_report(
    _invoice.company_id, _invoice.business_year_id, _invoice.invoice_date::date, _user_id
  );

  SELECT 
    COALESCE(SUM(CASE WHEN ii.vat_rate = 20 THEN ii.line_subtotal ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ii.vat_rate = 20 THEN ii.line_vat ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ii.vat_rate = 10 THEN ii.line_subtotal ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ii.vat_rate = 10 THEN ii.line_vat ELSE 0 END), 0)
  INTO _popdv_base_20, _popdv_vat_20, _popdv_base_10, _popdv_vat_10
  FROM invoice_items ii
  WHERE ii.invoice_id = _invoice_id;

  SELECT COALESCE(MAX(item_order), 0) + 1 INTO _popdv_next_order
  FROM popdv_report_detail_rows
  WHERE report_id = _popdv_report_id AND section = '3' AND row_code = '3.2';

  INSERT INTO popdv_report_detail_rows (
    report_id, company_id, section, row_code,
    document_date, document_type_number, partner_info,
    values, item_order, source_document_id
  ) VALUES (
    _popdv_report_id, _invoice.company_id, '3', '3.2',
    _invoice.invoice_date::date,
    'Faktura ' || _invoice.invoice_number,
    COALESCE(_partner.pib, '') || ' / ' || _partner.name,
    jsonb_build_object(
      'opsta_osnov', _popdv_base_20,
      'opsta_pdv', _popdv_vat_20,
      'posebna_osnov', _popdv_base_10,
      'posebna_pdv', _popdv_vat_10
    ),
    _popdv_next_order,
    _invoice_id
  );

  IF _invoice.advance_invoice_id IS NOT NULL AND (_adv_popdv_base_20 > 0 OR _adv_popdv_vat_20 > 0 OR _adv_popdv_base_10 > 0 OR _adv_popdv_vat_10 > 0) THEN
    SELECT COALESCE(MAX(item_order), 0) + 1 INTO _popdv_next_order
    FROM popdv_report_detail_rows
    WHERE report_id = _popdv_report_id AND section = '3' AND row_code = '3.9';

    INSERT INTO popdv_report_detail_rows (
      report_id, company_id, section, row_code,
      document_date, document_type_number, partner_info,
      values, item_order, source_document_id
    ) VALUES (
      _popdv_report_id, _invoice.company_id, '3', '3.9',
      _invoice.invoice_date::date,
      'Storno avansa AF ' || _advance_doc.advance_number || ' po FAK ' || _invoice.invoice_number,
      COALESCE(_partner.pib, '') || ' / ' || _partner.name,
      jsonb_build_object(
        'opsta_osnov', -_adv_popdv_base_20,
        'opsta_pdv', -_adv_popdv_vat_20,
        'posebna_osnov', -_adv_popdv_base_10,
        'posebna_pdv', -_adv_popdv_vat_10
      ),
      _popdv_next_order,
      _invoice_id
    );
  END IF;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- UPDATE post_advance_invoice
-- ============================================================
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

  -- POPDV zapis u tačku 3.9 (auto-create report if needed)
  IF NOT _is_foreign AND (_popdv_base_20 > 0 OR _popdv_vat_20 > 0 OR _popdv_base_10 > 0 OR _popdv_vat_10 > 0) THEN
    _popdv_report_id := public.ensure_popdv_report(
      _doc.company_id, _doc.business_year_id, _doc.advance_date::date, _user_id
    );

    SELECT COALESCE(MAX(item_order), 0) + 1 INTO _popdv_next_order
    FROM popdv_report_detail_rows
    WHERE report_id = _popdv_report_id AND section = '3' AND row_code = '3.9';

    INSERT INTO popdv_report_detail_rows (
      report_id, company_id, section, row_code, item_order,
      document_date, document_type_number, partner_info,
      values, source_document_id
    ) VALUES (
      _popdv_report_id, _doc.company_id, '3', '3.9', _popdv_next_order,
      _doc.advance_date::date,
      'AF ' || _doc.advance_number,
      _partner.name || COALESCE(' (PIB: ' || _partner.pib || ')', ''),
      jsonb_build_object(
        'opsta_osnov', _popdv_base_20,
        'opsta_pdv', _popdv_vat_20,
        'posebna_osnov', _popdv_base_10,
        'posebna_pdv', _popdv_vat_10
      ),
      _invoice_id
    );
  END IF;

  RETURN true;
END;
$$;

-- ============================================================
-- UPDATE post_advance_purchase_invoice
-- ============================================================
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
BEGIN
  SELECT * INTO _doc FROM advance_purchase_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'UFA nije pronađena'; END IF;
  IF _doc.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;
  IF _doc.total_amount <= 0 THEN RAISE EXCEPTION 'Dokument mora imati pozitivan iznos'; END IF;

  SELECT * INTO _partner FROM partners WHERE id = _doc.partner_id;
  _is_foreign := (_partner.legal_status = 4);

  IF _is_foreign THEN
    _supplier_account := '4360';
    _advance_account := '1510';
  ELSE
    _supplier_account := '4350';
    _advance_account := '1500';
  END IF;

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
    'posted', 0, 0,
    now(), _user_id, 'advance_purchase_invoice', _invoice_id, _user_id
  ) RETURNING id INTO _journal_entry_id;

  -- 1. Credit supplier account for total amount
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

  -- 2. Debit advance account for subtotal
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

  -- 3. Debit input VAT accounts per rate (only for domestic PDV suppliers)
  IF _doc.supplier_is_in_pdv AND NOT _is_foreign THEN
    FOR _vat_rec IN
      SELECT vat_rate, SUM(line_vat) as total_vat, SUM(line_subtotal) as total_base
      FROM advance_purchase_invoice_items
      WHERE advance_purchase_invoice_id = _invoice_id
      GROUP BY vat_rate
      HAVING SUM(line_vat) > 0
    LOOP
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, cost_center_code, document_date
      ) VALUES (
        _journal_entry_id, _doc.company_id,
        CASE WHEN _vat_rec.vat_rate = 10 THEN '2730' ELSE '2720' END,
        _item_order,
        'Prethodni PDV iz avansa ' || _vat_rec.vat_rate || '% - ' || _doc.internal_number,
        _vat_rec.total_vat, 0, _org_unit_code, _doc.receipt_date
      );
      _total_debit := _total_debit + _vat_rec.total_vat;

      IF _vat_rec.vat_rate = 20 THEN
        _popdv_base_20 := _popdv_base_20 + _vat_rec.total_base;
        _popdv_vat_20 := _popdv_vat_20 + _vat_rec.total_vat;
      ELSIF _vat_rec.vat_rate = 10 THEN
        _popdv_base_10 := _popdv_base_10 + _vat_rec.total_base;
        _popdv_vat_10 := _popdv_vat_10 + _vat_rec.total_vat;
      END IF;
    END LOOP;
  END IF;

  -- If supplier not in PDV, subtotal = total, no VAT entries needed
  IF NOT _doc.supplier_is_in_pdv OR _is_foreign THEN
    UPDATE journal_entry_items
    SET debit_amount = _doc.total_amount
    WHERE journal_entry_id = _journal_entry_id AND account_code = _advance_account;
    _total_debit := _doc.total_amount;
  END IF;

  UPDATE journal_entries
  SET total_debit = _total_debit, total_credit = _total_credit
  WHERE id = _journal_entry_id;

  UPDATE advance_purchase_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = _journal_entry_id, updated_at = now()
  WHERE id = _invoice_id;

  -- POPDV: section 8a, row 8a.7 (auto-create report if needed)
  IF NOT _is_foreign AND _doc.supplier_is_in_pdv AND (_popdv_base_20 > 0 OR _popdv_vat_20 > 0 OR _popdv_base_10 > 0 OR _popdv_vat_10 > 0) THEN
    _popdv_report_id := public.ensure_popdv_report(
      _doc.company_id, _doc.business_year_id, _doc.invoice_date::date, _user_id
    );

    SELECT COALESCE(MAX(item_order), 0) + 1 INTO _popdv_next_order
    FROM popdv_report_detail_rows
    WHERE report_id = _popdv_report_id AND section = '8' AND row_code = '8a.7';

    INSERT INTO popdv_report_detail_rows (
      report_id, company_id, section, row_code, item_order,
      document_date, document_type_number, partner_info,
      values, source_document_id
    ) VALUES (
      _popdv_report_id, _doc.company_id, '8', '8a.7', _popdv_next_order,
      _doc.invoice_date,
      'UFA ' || _doc.internal_number,
      _partner.name || COALESCE(' (PIB: ' || _partner.pib || ')', ''),
      jsonb_build_object(
        'opsta_osnov', _popdv_base_20,
        'opsta_pdv', _popdv_vat_20,
        'posebna_osnov', _popdv_base_10,
        'posebna_pdv', _popdv_vat_10
      ),
      _invoice_id
    );
  END IF;

  RETURN true;
END;
$$;

-- ============================================================
-- UPDATE post_goods_purchase_invoice
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_goods_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice goods_purchase_invoices%ROWTYPE;
  v_partner partners%ROWTYPE;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_item_order int := 0;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_goods_receipt_id uuid;
  v_supplier_account_code text;
  v_input_vat_account_code text := '2700';
  v_inventory_account_code text;
  v_vat_deductible_amount numeric := 0;
  v_vat_non_deductible_amount numeric := 0;
  v_inventory_amount numeric := 0;
  -- POPDV
  v_is_domestic boolean;
  v_popdv_report_id uuid;
  v_popdv_next_order int;
  v_8a2_base_20 numeric := 0;
  v_8a2_pdv_20 numeric := 0;
  v_8a2_base_10 numeric := 0;
  v_8a2_pdv_10 numeric := 0;
  v_8e1_pdv numeric := 0;
  v_621_base_20 numeric := 0;
  v_621_base_10 numeric := 0;
  v_item record;
BEGIN
  SELECT * INTO v_invoice FROM goods_purchase_invoices WHERE id = _invoice_id;
  IF v_invoice IS NULL THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF v_invoice.status = 'posted' THEN RAISE EXCEPTION 'Faktura je već proknjižena'; END IF;

  SELECT * INTO v_partner FROM partners WHERE id = v_invoice.partner_id;
  IF v_partner.legal_status = 4 THEN v_supplier_account_code := '4360';
  ELSE v_supplier_account_code := '4350'; END IF;

  v_is_domestic := (v_partner.legal_status IS NULL OR v_partner.legal_status::int != 4);

  SELECT COALESCE(inventory_account, '1320') INTO v_inventory_account_code
  FROM warehouses WHERE id = v_invoice.warehouse_id;

  v_entry_number := 'UFR' || v_invoice.internal_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    document_number, description, status, created_by, source_document_type, source_document_id
  ) VALUES (
    v_invoice.company_id, v_invoice.business_year_id, v_entry_number, v_invoice.receipt_date,
    v_invoice.due_date, v_invoice.supplier_invoice_number,
    'UFR: ' || v_invoice.internal_number || ' - ' || COALESCE(v_invoice.supplier_name, ''),
    'posted', _user_id, 'goods_purchase_invoice', _invoice_id
  ) RETURNING id INTO v_journal_entry_id;

  SELECT
    COALESCE(SUM(CASE WHEN is_vat_deductible THEN line_vat ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN NOT is_vat_deductible THEN line_vat ELSE 0 END), 0),
    COALESCE(SUM(line_subtotal), 0)
  INTO v_vat_deductible_amount, v_vat_non_deductible_amount, v_inventory_amount
  FROM goods_purchase_invoice_items WHERE goods_purchase_invoice_id = _invoice_id;

  v_inventory_amount := v_inventory_amount + v_vat_non_deductible_amount;

  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id, document_date
  ) VALUES (
    v_journal_entry_id, v_invoice.company_id, v_supplier_account_code, v_item_order,
    'Obaveza po fakturi ' || v_invoice.supplier_invoice_number,
    0, v_invoice.total_amount, v_invoice.partner_id, v_invoice.due_date
  );
  v_total_credit := v_total_credit + v_invoice.total_amount;

  IF v_vat_deductible_amount > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, document_date
    ) VALUES (
      v_journal_entry_id, v_invoice.company_id, v_input_vat_account_code, v_item_order,
      'Ulazni PDV', v_vat_deductible_amount, 0, v_invoice.receipt_date
    );
    v_total_debit := v_total_debit + v_vat_deductible_amount;
  END IF;

  IF v_inventory_amount > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_journal_entry_id, v_invoice.company_id, v_inventory_account_code, v_item_order,
      'Nabavka robe', v_inventory_amount, 0,
      (SELECT code FROM warehouses WHERE id = v_invoice.warehouse_id),
      v_invoice.receipt_date
    );
    v_total_debit := v_total_debit + v_inventory_amount;
  END IF;

  UPDATE journal_entries
  SET total_debit = v_total_debit, total_credit = v_total_credit, posted_at = now(), posted_by = _user_id
  WHERE id = v_journal_entry_id;

  -- Goods receipt
  INSERT INTO goods_receipts (
    company_id, business_year_id, warehouse_id, partner_id, receipt_number,
    receipt_date, source_invoice_id, status, created_by
  ) VALUES (
    v_invoice.company_id, v_invoice.business_year_id, v_invoice.warehouse_id,
    v_invoice.partner_id, v_invoice.internal_number, v_invoice.receipt_date,
    _invoice_id, 'draft', _user_id
  ) RETURNING id INTO v_goods_receipt_id;

  INSERT INTO goods_receipt_items (
    goods_receipt_id, company_id, article_id, item_code, item_name, unit,
    quantity, unit_price, item_order
  )
  SELECT
    v_goods_receipt_id, v_invoice.company_id, article_id, item_code, item_name, unit,
    quantity,
    CASE WHEN quantity > 0 THEN ROUND(line_subtotal / quantity, 4) ELSE 0 END,
    item_order
  FROM goods_purchase_invoice_items
  WHERE goods_purchase_invoice_id = _invoice_id;

  PERFORM public.post_goods_receipt(v_goods_receipt_id, _user_id);

  UPDATE goods_purchase_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = v_journal_entry_id, goods_receipt_id = v_goods_receipt_id, updated_at = now()
  WHERE id = _invoice_id;

  -- POPDV integration (auto-create report if needed)
  FOR v_item IN
    SELECT vat_rate, is_vat_deductible, line_subtotal, line_vat, line_total
    FROM goods_purchase_invoice_items WHERE goods_purchase_invoice_id = _invoice_id
  LOOP
    IF v_is_domestic THEN
      IF v_item.vat_rate = 20 THEN
        v_8a2_base_20 := v_8a2_base_20 + v_item.line_subtotal;
        v_8a2_pdv_20 := v_8a2_pdv_20 + v_item.line_vat;
      ELSIF v_item.vat_rate = 10 THEN
        v_8a2_base_10 := v_8a2_base_10 + v_item.line_subtotal;
        v_8a2_pdv_10 := v_8a2_pdv_10 + v_item.line_vat;
      END IF;
      IF v_item.is_vat_deductible AND v_item.line_vat > 0 THEN
        v_8e1_pdv := v_8e1_pdv + v_item.line_vat;
      END IF;
    ELSE
      IF v_item.vat_rate = 20 THEN
        v_621_base_20 := v_621_base_20 + v_item.line_subtotal;
      ELSIF v_item.vat_rate = 10 THEN
        v_621_base_10 := v_621_base_10 + v_item.line_subtotal;
      END IF;
    END IF;
  END LOOP;

  IF (v_8a2_base_20 > 0 OR v_8a2_pdv_20 > 0 OR v_8a2_base_10 > 0 OR v_8a2_pdv_10 > 0 OR
      v_8e1_pdv > 0 OR v_621_base_20 > 0 OR v_621_base_10 > 0) THEN

    v_popdv_report_id := public.ensure_popdv_report(
      v_invoice.company_id, v_invoice.business_year_id, v_invoice.receipt_date::date, _user_id
    );

    IF v_8a2_base_20 > 0 OR v_8a2_pdv_20 > 0 OR v_8a2_base_10 > 0 OR v_8a2_pdv_10 > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order
      FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8a.2';

      INSERT INTO popdv_report_detail_rows (
        report_id, company_id, section, row_code,
        document_date, document_type_number, partner_info,
        values, item_order, source_document_id
      ) VALUES (
        v_popdv_report_id, v_invoice.company_id, '8a', '8a.2',
        v_invoice.receipt_date::date,
        'UFR ' || v_invoice.internal_number,
        COALESCE(v_invoice.supplier_pib, '') || ' / ' || COALESCE(v_invoice.supplier_name, ''),
        jsonb_build_object(
          'opsta_osnov', v_8a2_base_20, 'opsta_pdv', v_8a2_pdv_20,
          'posebna_osnov', v_8a2_base_10, 'posebna_pdv', v_8a2_pdv_10
        ),
        v_popdv_next_order, _invoice_id
      );
    END IF;

    IF v_8e1_pdv > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order
      FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8e.1';

      INSERT INTO popdv_report_detail_rows (
        report_id, company_id, section, row_code,
        document_date, document_type_number, partner_info,
        values, item_order, source_document_id
      ) VALUES (
        v_popdv_report_id, v_invoice.company_id, '8e', '8e.1',
        v_invoice.receipt_date::date,
        'UFR ' || v_invoice.internal_number,
        COALESCE(v_invoice.supplier_pib, '') || ' / ' || COALESCE(v_invoice.supplier_name, ''),
        jsonb_build_object('iznos', v_8e1_pdv),
        v_popdv_next_order, _invoice_id
      );
    END IF;

    IF v_621_base_20 > 0 OR v_621_base_10 > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order
      FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '6.2.1';

      INSERT INTO popdv_report_detail_rows (
        report_id, company_id, section, row_code,
        document_date, document_type_number, partner_info,
        values, item_order, source_document_id
      ) VALUES (
        v_popdv_report_id, v_invoice.company_id, '6', '6.2.1',
        v_invoice.receipt_date::date,
        'UFR ' || v_invoice.internal_number,
        COALESCE(v_invoice.supplier_pib, '') || ' / ' || COALESCE(v_invoice.supplier_name, ''),
        jsonb_build_object('opsta_osnov', v_621_base_20, 'posebna_osnov', v_621_base_10),
        v_popdv_next_order, _invoice_id
      );
    END IF;
  END IF;

  RETURN v_journal_entry_id;
END;
$$;

-- ============================================================
-- UPDATE post_received_credit_note
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_received_credit_note(_doc_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  _is_foreign boolean;
  _entry_number text;
  _year_short text;
  _next_num integer;
  _expense_amount numeric;
  _check_debit numeric;
  _check_credit numeric;
  _opsta_osnov numeric := 0;
  _opsta_pdv numeric := 0;
  _posebna_osnov numeric := 0;
  _posebna_pdv numeric := 0;
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

  SELECT RIGHT(year::text, 2) INTO _year_short FROM business_years WHERE id = _doc.business_year_id;
  SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
  FROM (
    SELECT CAST(SUBSTRING(entry_number FROM '^PKO' || _year_short || '(\d{4})$') AS INTEGER) as seq
    FROM journal_entries
    WHERE company_id = _doc.company_id AND business_year_id = _doc.business_year_id
      AND entry_number ~ ('^PKO' || _year_short || '\d{4}$')
  ) t;
  _entry_number := 'PKO' || _year_short || LPAD(_next_num::text, 4, '0');

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit, posted_at, posted_by, created_by,
    source_type, source_id
  ) VALUES (
    _doc.company_id, _doc.business_year_id, _entry_number,
    _doc.receipt_date, _doc.document_date, _doc.supplier_document_number,
    'Primljeno knjižno odobrenje ' || _doc.internal_number,
    'posted', 0, 0, now(), _user_id, _user_id,
    'received_credit_note', _doc_id
  ) RETURNING id INTO _je_id;

  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order,
    description, debit_amount, credit_amount, partner_id, document_date
  ) VALUES (
    _je_id, _doc.company_id, _supplier_account, _order,
    'Primljeno KO - ' || COALESCE(_doc.supplier_name, _partner.name),
    0, -_total_amount, _doc.partner_id, _doc.due_date
  );
  _order := _order + 1;

  FOR _item IN
    SELECT rci.*, ic.account_code as cost_account_code, ou.code as ou_code
    FROM received_credit_note_items rci
    LEFT JOIN input_costs ic ON ic.id = rci.input_cost_id
    LEFT JOIN organizational_units ou ON ou.id = rci.org_unit_id
    WHERE rci.received_credit_note_id = _doc_id ORDER BY rci.item_order
  LOOP
    IF _item.is_vat_deductible THEN
      _expense_amount := _item.line_subtotal;
    ELSE
      _expense_amount := _item.line_total;
    END IF;

    IF _item.cost_account_code IS NOT NULL THEN
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount, cost_center_code, document_date
      ) VALUES (
        _je_id, _doc.company_id, _item.cost_account_code, _order,
        _item.item_name, -_expense_amount, 0, _item.ou_code, _doc.document_date
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
          'Interni obračun PDV - storno ulaznog', -_item.line_vat, 0, _doc.document_date
        );
        _order := _order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order,
          description, debit_amount, credit_amount, document_date
        ) VALUES (
          _je_id, _doc.company_id,
          CASE WHEN _item.vat_rate = 10 THEN '4730' ELSE '4720' END, _order,
          'Interni obračun PDV - storno izlaznog', 0, -_item.line_vat, _doc.document_date
        );
        _order := _order + 1;
      ELSE
        _vat_account := CASE WHEN _item.vat_rate = 10 THEN '2730' ELSE '2720' END;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order,
          description, debit_amount, credit_amount, document_date
        ) VALUES (
          _je_id, _doc.company_id, _vat_account, _order,
          'Storno prethodnog PDV', -_item.line_vat, 0, _doc.document_date
        );
        _order := _order + 1;
      END IF;
    END IF;

    -- Aggregate POPDV values by VAT rate
    IF _item.vat_rate = 10 THEN
      _posebna_osnov := _posebna_osnov + _item.line_subtotal;
      _posebna_pdv := _posebna_pdv + _item.line_vat;
    ELSE
      _opsta_osnov := _opsta_osnov + _item.line_subtotal;
      _opsta_pdv := _opsta_pdv + _item.line_vat;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
  INTO _check_debit, _check_credit
  FROM journal_entry_items WHERE journal_entry_id = _je_id;

  IF _check_debit != _check_credit THEN
    RAISE EXCEPTION 'Nalog za knjiženje nije uravnotežen! Duguje: %, Potražuje: %. Knjiženje nije moguće.', _check_debit, _check_credit;
  END IF;

  UPDATE journal_entries SET total_debit = _check_debit, total_credit = _check_credit WHERE id = _je_id;

  -- POPDV section 8a.5 (auto-create report if needed)
  IF _total_amount > 0 THEN
    _popdv_report_id := public.ensure_popdv_report(
      _doc.company_id, _doc.business_year_id, _doc.document_date::date, _user_id
    );

    INSERT INTO popdv_report_detail_rows (
      report_id, company_id, section, row_code,
      document_date, document_type_number, partner_info,
      values, item_order, source_document_id
    ) VALUES (
      _popdv_report_id, _doc.company_id, '8a', '8a.5',
      _doc.document_date,
      'PKO ' || _doc.internal_number,
      COALESCE(_doc.supplier_name, _partner.name),
      jsonb_build_object(
        'opsta_osnov', -_opsta_osnov,
        'opsta_pdv', -_opsta_pdv,
        'posebna_osnov', -_posebna_osnov,
        'posebna_pdv', -_posebna_pdv
      ),
      COALESCE((SELECT MAX(item_order) + 1 FROM popdv_report_detail_rows WHERE report_id = _popdv_report_id AND row_code = '8a.5'), 0),
      _doc_id
    );
  END IF;

  UPDATE received_credit_notes
  SET status = 'posted', posted_at = now(), posted_by = _user_id, journal_entry_id = _je_id
  WHERE id = _doc_id;
END;
$$;

-- ============================================================
-- UPDATE post_service_purchase_invoice
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_service_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice service_purchase_invoices%ROWTYPE;
  v_partner partners%ROWTYPE;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_item_order int := 0;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_supplier_account_code text;
  v_input_vat_account_code text := '2700';
  v_item record;
  v_cost record;
  v_line_amount numeric;
  v_cost_center_code text;
  -- POPDV variables
  v_is_domestic boolean;
  v_popdv_report_id uuid;
  v_popdv_next_order int;
  -- POPDV accumulators
  v_8a2_base_20 numeric := 0;
  v_8a2_pdv_20 numeric := 0;
  v_8a2_base_10 numeric := 0;
  v_8a2_pdv_10 numeric := 0;
  v_8e1_pdv numeric := 0;
  v_8d2_value numeric := 0;
  v_8v2_value numeric := 0;
  v_3a3_pdv_20 numeric := 0;
  v_3a3_pdv_10 numeric := 0;
  v_8b2_base_20 numeric := 0;
  v_8b2_base_10 numeric := 0;
  v_8e2_pdv numeric := 0;
  v_6_4_pdv numeric := 0;
BEGIN
  SELECT * INTO v_invoice FROM service_purchase_invoices WHERE id = _invoice_id;
  IF v_invoice IS NULL THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF v_invoice.status = 'posted' THEN RAISE EXCEPTION 'Faktura je već proknjižena'; END IF;

  SELECT * INTO v_partner FROM partners WHERE id = v_invoice.partner_id;
  IF v_partner.legal_status = 4 THEN v_supplier_account_code := '4360';
  ELSE v_supplier_account_code := '4350'; END IF;

  v_is_domestic := (v_partner.legal_status IS NULL OR v_partner.legal_status::int != 4);

  v_entry_number := 'UFU' || v_invoice.internal_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    document_number, description, status, created_by, source_document_type, source_document_id
  ) VALUES (
    v_invoice.company_id, v_invoice.business_year_id, v_entry_number, v_invoice.receipt_date,
    v_invoice.due_date, v_invoice.supplier_invoice_number,
    'UFU: ' || v_invoice.internal_number || ' - ' || COALESCE(v_invoice.supplier_name, ''),
    'posted', _user_id, 'service_purchase_invoice', _invoice_id
  ) RETURNING id INTO v_journal_entry_id;

  -- Supplier liability (credit)
  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id, document_date
  ) VALUES (
    v_journal_entry_id, v_invoice.company_id, v_supplier_account_code, v_item_order,
    'Obaveza po fakturi ' || v_invoice.supplier_invoice_number,
    0, v_invoice.total_amount, v_invoice.partner_id, v_invoice.due_date
  );
  v_total_credit := v_total_credit + v_invoice.total_amount;

  -- Process items
  FOR v_item IN
    SELECT * FROM service_purchase_invoice_items WHERE service_purchase_invoice_id = _invoice_id ORDER BY item_order
  LOOP
    SELECT * INTO v_cost FROM input_costs WHERE id = v_item.input_cost_id;
    IF v_cost IS NULL THEN RAISE EXCEPTION 'Ulazni trošak nije pronađen za stavku'; END IF;

    IF v_item.is_vat_deductible THEN
      v_line_amount := v_item.line_subtotal;
    ELSE
      v_line_amount := v_item.line_subtotal + v_item.line_vat;
    END IF;

    v_cost_center_code := NULL;
    IF v_item.org_unit_id IS NOT NULL THEN
      SELECT code INTO v_cost_center_code FROM organizational_units WHERE id = v_item.org_unit_id;
    ELSIF v_invoice.org_unit_id IS NOT NULL THEN
      SELECT code INTO v_cost_center_code FROM organizational_units WHERE id = v_invoice.org_unit_id;
    END IF;

    -- Expense debit
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_journal_entry_id, v_invoice.company_id, v_cost.account_code, v_item_order,
      v_item.item_name, v_line_amount, 0, v_cost_center_code, v_invoice.receipt_date
    );
    v_total_debit := v_total_debit + v_line_amount;

    -- Deductible VAT debit
    IF v_item.is_vat_deductible AND v_item.line_vat > 0 THEN
      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, cost_center_code, document_date
      ) VALUES (
        v_journal_entry_id, v_invoice.company_id, v_input_vat_account_code, v_item_order,
        'Ulazni PDV - ' || v_item.item_name, v_item.line_vat, 0,
        v_cost_center_code, v_invoice.receipt_date
      );
      v_total_debit := v_total_debit + v_item.line_vat;
    END IF;

    -- POPDV accumulation (domestic suppliers only)
    IF v_is_domestic THEN
      IF v_cost.account_code = '2740' THEN
        v_6_4_pdv := v_6_4_pdv + v_line_amount;
      ELSIF v_invoice.has_internal_vat_calculation THEN
        IF v_item.vat_rate = 20 THEN
          v_3a3_pdv_20 := v_3a3_pdv_20 + v_item.line_vat;
          v_8b2_base_20 := v_8b2_base_20 + v_item.line_subtotal;
        ELSIF v_item.vat_rate = 10 THEN
          v_3a3_pdv_10 := v_3a3_pdv_10 + v_item.line_vat;
          v_8b2_base_10 := v_8b2_base_10 + v_item.line_subtotal;
        END IF;
        v_8e2_pdv := v_8e2_pdv + v_item.line_vat;
      ELSIF v_invoice.vat_calculation_type = 'no_vat_8v2' THEN
        v_8v2_value := v_8v2_value + v_item.line_total;
      ELSE
        IF v_invoice.supplier_is_in_pdv THEN
          IF v_item.is_vat_deductible THEN
            IF v_item.vat_rate = 20 THEN
              v_8a2_base_20 := v_8a2_base_20 + v_item.line_subtotal;
              v_8a2_pdv_20 := v_8a2_pdv_20 + v_item.line_vat;
            ELSIF v_item.vat_rate = 10 THEN
              v_8a2_base_10 := v_8a2_base_10 + v_item.line_subtotal;
              v_8a2_pdv_10 := v_8a2_pdv_10 + v_item.line_vat;
            END IF;
            v_8e1_pdv := v_8e1_pdv + v_item.line_vat;
          ELSE
            v_8d2_value := v_8d2_value + v_item.line_total;
          END IF;
        ELSE
          v_8d2_value := v_8d2_value + v_item.line_total;
        END IF;
      END IF;
    END IF;
  END LOOP;

  UPDATE journal_entries
  SET total_debit = v_total_debit, total_credit = v_total_credit, posted_at = now(), posted_by = _user_id
  WHERE id = v_journal_entry_id;

  UPDATE service_purchase_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = v_journal_entry_id, updated_at = now()
  WHERE id = _invoice_id;

  -- POPDV integration (auto-create report if needed)
  IF v_is_domestic AND (
    v_8a2_base_20 > 0 OR v_8a2_pdv_20 > 0 OR v_8a2_base_10 > 0 OR v_8a2_pdv_10 > 0 OR
    v_8e1_pdv > 0 OR v_8d2_value > 0 OR v_8v2_value > 0 OR
    v_3a3_pdv_20 > 0 OR v_3a3_pdv_10 > 0 OR v_8b2_base_20 > 0 OR v_8b2_base_10 > 0 OR
    v_8e2_pdv > 0 OR v_6_4_pdv > 0
  ) THEN
    v_popdv_report_id := public.ensure_popdv_report(
      v_invoice.company_id, v_invoice.business_year_id, v_invoice.receipt_date::date, _user_id
    );

    -- 8a.2
    IF v_8a2_base_20 > 0 OR v_8a2_pdv_20 > 0 OR v_8a2_base_10 > 0 OR v_8a2_pdv_10 > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order
      FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8a.2';

      INSERT INTO popdv_report_detail_rows (
        report_id, company_id, section, row_code,
        document_date, document_type_number, partner_info,
        values, item_order, source_document_id
      ) VALUES (
        v_popdv_report_id, v_invoice.company_id, '8a', '8a.2',
        v_invoice.receipt_date::date,
        'UFU ' || v_invoice.internal_number,
        COALESCE(v_invoice.supplier_pib, '') || ' / ' || COALESCE(v_invoice.supplier_name, ''),
        jsonb_build_object(
          'opsta_osnov', v_8a2_base_20, 'opsta_pdv', v_8a2_pdv_20,
          'posebna_osnov', v_8a2_base_10, 'posebna_pdv', v_8a2_pdv_10
        ),
        v_popdv_next_order, _invoice_id
      );
    END IF;

    -- 8e.1
    IF v_8e1_pdv > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order
      FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8e.1';

      INSERT INTO popdv_report_detail_rows (
        report_id, company_id, section, row_code,
        document_date, document_type_number, partner_info,
        values, item_order, source_document_id
      ) VALUES (
        v_popdv_report_id, v_invoice.company_id, '8e', '8e.1',
        v_invoice.receipt_date::date,
        'UFU ' || v_invoice.internal_number,
        COALESCE(v_invoice.supplier_pib, '') || ' / ' || COALESCE(v_invoice.supplier_name, ''),
        jsonb_build_object('iznos', v_8e1_pdv),
        v_popdv_next_order, _invoice_id
      );
    END IF;

    -- 8d.2
    IF v_8d2_value > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order
      FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8d.2';

      INSERT INTO popdv_report_detail_rows (
        report_id, company_id, section, row_code,
        document_date, document_type_number, partner_info,
        values, item_order, source_document_id
      ) VALUES (
        v_popdv_report_id, v_invoice.company_id, '8d', '8d.2',
        v_invoice.receipt_date::date,
        'UFU ' || v_invoice.internal_number,
        COALESCE(v_invoice.supplier_pib, '') || ' / ' || COALESCE(v_invoice.supplier_name, ''),
        jsonb_build_object('iznos', v_8d2_value),
        v_popdv_next_order, _invoice_id
      );
    END IF;

    -- 8v.2
    IF v_8v2_value > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order
      FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8v.2';

      INSERT INTO popdv_report_detail_rows (
        report_id, company_id, section, row_code,
        document_date, document_type_number, partner_info,
        values, item_order, source_document_id
      ) VALUES (
        v_popdv_report_id, v_invoice.company_id, '8v', '8v.2',
        v_invoice.receipt_date::date,
        'UFU ' || v_invoice.internal_number,
        COALESCE(v_invoice.supplier_pib, '') || ' / ' || COALESCE(v_invoice.supplier_name, ''),
        jsonb_build_object('iznos', v_8v2_value),
        v_popdv_next_order, _invoice_id
      );
    END IF;

    -- 3a.3
    IF v_3a3_pdv_20 > 0 OR v_3a3_pdv_10 > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order
      FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '3a.3';

      INSERT INTO popdv_report_detail_rows (
        report_id, company_id, section, row_code,
        document_date, document_type_number, partner_info,
        values, item_order, source_document_id
      ) VALUES (
        v_popdv_report_id, v_invoice.company_id, '3a', '3a.3',
        v_invoice.receipt_date::date,
        'UFU ' || v_invoice.internal_number,
        COALESCE(v_invoice.supplier_pib, '') || ' / ' || COALESCE(v_invoice.supplier_name, ''),
        jsonb_build_object('opsta_pdv', v_3a3_pdv_20, 'posebna_pdv', v_3a3_pdv_10),
        v_popdv_next_order, _invoice_id
      );
    END IF;

    -- 8b.2
    IF v_8b2_base_20 > 0 OR v_8b2_base_10 > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order
      FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8b.2';

      INSERT INTO popdv_report_detail_rows (
        report_id, company_id, section, row_code,
        document_date, document_type_number, partner_info,
        values, item_order, source_document_id
      ) VALUES (
        v_popdv_report_id, v_invoice.company_id, '8b', '8b.2',
        v_invoice.receipt_date::date,
        'UFU ' || v_invoice.internal_number,
        COALESCE(v_invoice.supplier_pib, '') || ' / ' || COALESCE(v_invoice.supplier_name, ''),
        jsonb_build_object('opsta_osnov', v_8b2_base_20, 'posebna_osnov', v_8b2_base_10),
        v_popdv_next_order, _invoice_id
      );
    END IF;

    -- 8e.2
    IF v_8e2_pdv > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order
      FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8e.2';

      INSERT INTO popdv_report_detail_rows (
        report_id, company_id, section, row_code,
        document_date, document_type_number, partner_info,
        values, item_order, source_document_id
      ) VALUES (
        v_popdv_report_id, v_invoice.company_id, '8e', '8e.2',
        v_invoice.receipt_date::date,
        'UFU ' || v_invoice.internal_number,
        COALESCE(v_invoice.supplier_pib, '') || ' / ' || COALESCE(v_invoice.supplier_name, ''),
        jsonb_build_object('iznos', v_8e2_pdv),
        v_popdv_next_order, _invoice_id
      );
    END IF;

    -- 6.4
    IF v_6_4_pdv > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order
      FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '6.4';

      INSERT INTO popdv_report_detail_rows (
        report_id, company_id, section, row_code,
        document_date, document_type_number, partner_info,
        values, item_order, source_document_id
      ) VALUES (
        v_popdv_report_id, v_invoice.company_id, '6', '6.4',
        v_invoice.receipt_date::date,
        'UFU ' || v_invoice.internal_number,
        COALESCE(v_invoice.supplier_pib, '') || ' / ' || COALESCE(v_invoice.supplier_name, ''),
        jsonb_build_object('iznos', v_6_4_pdv),
        v_popdv_next_order, _invoice_id
      );
    END IF;
  END IF;

  RETURN v_journal_entry_id;
END;
$$;

-- ============================================================
-- UPDATE post_credit_note
-- ============================================================
-- First check if post_credit_note has POPDV integration
