
-- Update post_service_purchase_invoice with POPDV logic for domestic suppliers
CREATE OR REPLACE FUNCTION public.post_service_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_period_start date;
  v_period_end date;
  v_vat_period_type text;
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
      -- Case 4: Customs VAT (cost account 2740) → always 6.4, regardless of other flags
      IF v_cost.account_code = '2740' THEN
        v_6_4_pdv := v_6_4_pdv + v_line_amount;

      -- Case 3: Internal VAT calculation → 3a.3, 8b.2, 8e.2
      ELSIF v_invoice.has_internal_vat_calculation THEN
        IF v_item.vat_rate = 20 THEN
          v_3a3_pdv_20 := v_3a3_pdv_20 + v_item.line_vat;
          v_8b2_base_20 := v_8b2_base_20 + v_item.line_subtotal;
        ELSIF v_item.vat_rate = 10 THEN
          v_3a3_pdv_10 := v_3a3_pdv_10 + v_item.line_vat;
          v_8b2_base_10 := v_8b2_base_10 + v_item.line_subtotal;
        END IF;
        v_8e2_pdv := v_8e2_pdv + v_item.line_vat;

      -- Case 2: No VAT calculation (8v.2 checkbox) → 8v.2
      ELSIF v_invoice.vat_calculation_type = 'no_vat_8v2' THEN
        v_8v2_value := v_8v2_value + v_item.line_total;

      -- Case 1: Standard
      ELSE
        IF v_invoice.supplier_is_in_pdv THEN
          IF v_item.is_vat_deductible THEN
            -- 1.1: Domestic in PDV, deductible → 8a.2 + 8e.1
            IF v_item.vat_rate = 20 THEN
              v_8a2_base_20 := v_8a2_base_20 + v_item.line_subtotal;
              v_8a2_pdv_20 := v_8a2_pdv_20 + v_item.line_vat;
            ELSIF v_item.vat_rate = 10 THEN
              v_8a2_base_10 := v_8a2_base_10 + v_item.line_subtotal;
              v_8a2_pdv_10 := v_8a2_pdv_10 + v_item.line_vat;
            END IF;
            v_8e1_pdv := v_8e1_pdv + v_item.line_vat;
          ELSE
            -- 1.2: Domestic in PDV, non-deductible → 8d.2 (total with VAT)
            v_8d2_value := v_8d2_value + v_item.line_total;
          END IF;
        ELSE
          -- 1.3: Domestic NOT in PDV → 8d.2 (invoice amount)
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

  -- POPDV integration (domestic suppliers only)
  IF v_is_domestic AND (
    v_8a2_base_20 > 0 OR v_8a2_pdv_20 > 0 OR v_8a2_base_10 > 0 OR v_8a2_pdv_10 > 0 OR
    v_8e1_pdv > 0 OR v_8d2_value > 0 OR v_8v2_value > 0 OR
    v_3a3_pdv_20 > 0 OR v_3a3_pdv_10 > 0 OR v_8b2_base_20 > 0 OR v_8b2_base_10 > 0 OR
    v_8e2_pdv > 0 OR v_6_4_pdv > 0
  ) THEN
    SELECT vat_period_type INTO v_vat_period_type FROM companies WHERE id = v_invoice.company_id;
    IF v_vat_period_type = 'monthly' THEN
      v_period_start := date_trunc('month', v_invoice.receipt_date::date)::date;
      v_period_end := (date_trunc('month', v_invoice.receipt_date::date) + interval '1 month' - interval '1 day')::date;
    ELSE
      v_period_start := date_trunc('quarter', v_invoice.receipt_date::date)::date;
      v_period_end := (date_trunc('quarter', v_invoice.receipt_date::date) + interval '3 months' - interval '1 day')::date;
    END IF;

    SELECT id INTO v_popdv_report_id FROM popdv_reports
    WHERE company_id = v_invoice.company_id AND period_start = v_period_start AND period_end = v_period_end
    LIMIT 1;

    IF v_popdv_report_id IS NOT NULL THEN
      -- 8a.2: Domestic in PDV, deductible (base + VAT by rate)
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

      -- 8e.1: Deductible VAT total
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

      -- 8d.2: Non-deductible or non-PDV supplier
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

      -- 8v.2: No VAT calculation (8v.2 checkbox)
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

      -- 3a.3: Internal VAT calculation - PDV by rate
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

      -- 8b.2: Internal VAT calculation - Base by rate
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

      -- 8e.2: Internal VAT calculation - total calculated PDV
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

      -- 6.4: Customs VAT (account 2740)
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
  END IF;

  RETURN v_journal_entry_id;
END;
$function$;

-- Update unpost to also clean up POPDV detail rows
CREATE OR REPLACE FUNCTION public.unpost_service_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice RECORD;
  v_journal_entry_id uuid;
  v_access_level text;
  v_calc_number text;
BEGIN
  SELECT * INTO v_invoice FROM service_purchase_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF v_invoice.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjižene fakture mogu biti poništene'; END IF;

  -- Check if linked to a calculation
  SELECT pc.calculation_number INTO v_calc_number
  FROM calculation_ufu_links cul
  JOIN purchase_price_calculations pc ON pc.id = cul.calculation_id
  WHERE cul.service_invoice_id = _invoice_id
  LIMIT 1;
  
  IF v_calc_number IS NOT NULL THEN
    RAISE EXCEPTION 'Faktura je vezana za kalkulaciju %. Obrišite kalkulaciju pre poništavanja.', v_calc_number;
  END IF;

  v_access_level := get_user_access_level(_user_id, v_invoice.company_id, 'nabavka.ulazne_fakture_usluge', NULL);
  IF v_access_level != 'admin' THEN
    RAISE EXCEPTION 'Nemate admin dozvole za poništavanje knjiženja';
  END IF;

  v_journal_entry_id := v_invoice.journal_entry_id;

  -- Clean up POPDV detail rows
  DELETE FROM popdv_report_detail_rows WHERE source_document_id = _invoice_id;

  -- Reset invoice status
  UPDATE service_purchase_invoices
  SET status = 'draft', posted_at = NULL, posted_by = NULL, journal_entry_id = NULL, updated_at = now()
  WHERE id = _invoice_id;

  -- Delete journal entry
  IF v_journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_journal_entry_id;
  END IF;

  RETURN true;
END;
$function$;
