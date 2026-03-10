
-- Add POPDV logic to post_goods_purchase_invoice
-- Domestic: 8a.2 (base+VAT by rate) + 8e.1 (deductible VAT)
-- Foreign (import): 6.2.1 (base by rate)
CREATE OR REPLACE FUNCTION public.post_goods_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_period_start date;
  v_period_end date;
  v_vat_period_type text;
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

  -- Deductible VAT debit
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

  -- Inventory debit
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

  -- POPDV integration
  -- Accumulate per-item POPDV values
  FOR v_item IN
    SELECT vat_rate, is_vat_deductible, line_subtotal, line_vat, line_total
    FROM goods_purchase_invoice_items WHERE goods_purchase_invoice_id = _invoice_id
  LOOP
    IF v_is_domestic THEN
      -- Domestic: 8a.2 (base + VAT) + 8e.1 (deductible VAT)
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
      -- Foreign (import): 6.2.1 (base by rate)
      IF v_item.vat_rate = 20 THEN
        v_621_base_20 := v_621_base_20 + v_item.line_subtotal;
      ELSIF v_item.vat_rate = 10 THEN
        v_621_base_10 := v_621_base_10 + v_item.line_subtotal;
      END IF;
    END IF;
  END LOOP;

  IF (v_8a2_base_20 > 0 OR v_8a2_pdv_20 > 0 OR v_8a2_base_10 > 0 OR v_8a2_pdv_10 > 0 OR
      v_8e1_pdv > 0 OR v_621_base_20 > 0 OR v_621_base_10 > 0) THEN

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
      -- 8a.2: Domestic - base + VAT by rate
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

      -- 8e.1: Deductible VAT
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

      -- 6.2.1: Foreign (import) - base by rate
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
  END IF;

  RETURN v_journal_entry_id;
END;
$$;

-- Update unpost to also clean up POPDV detail rows
CREATE OR REPLACE FUNCTION public.unpost_goods_purchase_invoice(_invoice_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journal_entry_id UUID;
  v_goods_receipt_id UUID;
  v_status TEXT;
  v_item RECORD;
BEGIN
  SELECT status, journal_entry_id, goods_receipt_id
  INTO v_status, v_journal_entry_id, v_goods_receipt_id
  FROM goods_purchase_invoices
  WHERE id = _invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ulazna faktura nije pronađena';
  END IF;

  IF v_status != 'posted' THEN
    RAISE EXCEPTION 'Samo proknjižene fakture mogu biti poništene';
  END IF;

  IF v_goods_receipt_id IS NULL THEN
    SELECT id INTO v_goods_receipt_id
    FROM goods_receipts
    WHERE source_invoice_id = _invoice_id;
  END IF;

  -- Clean up POPDV detail rows
  DELETE FROM popdv_report_detail_rows WHERE source_document_id = _invoice_id;

  -- Reset invoice status
  UPDATE goods_purchase_invoices
  SET status = 'draft', posted_at = NULL, posted_by = NULL,
      journal_entry_id = NULL, goods_receipt_id = NULL, updated_at = now()
  WHERE id = _invoice_id;

  -- Delete journal entry
  IF v_journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_journal_entry_id;
  ELSE
    FOR v_item IN
      SELECT id FROM journal_entries 
      WHERE source_document_type = 'goods_purchase_invoice' AND source_document_id = _invoice_id
    LOOP
      DELETE FROM journal_entry_items WHERE journal_entry_id = v_item.id;
      DELETE FROM journal_entries WHERE id = v_item.id;
    END LOOP;
  END IF;

  -- Reverse stock and delete goods receipt
  IF v_goods_receipt_id IS NOT NULL THEN
    FOR v_item IN 
      SELECT gri.article_id, gri.quantity 
      FROM goods_receipt_items gri
      JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
      WHERE gri.goods_receipt_id = v_goods_receipt_id
        AND gri.article_id IS NOT NULL
        AND gr.status = 'posted'
    LOOP
      UPDATE articles
      SET stock = COALESCE(stock, 0) - v_item.quantity, updated_at = now()
      WHERE id = v_item.article_id;
    END LOOP;

    DELETE FROM goods_receipt_items WHERE goods_receipt_id = v_goods_receipt_id;
    DELETE FROM goods_receipts WHERE id = v_goods_receipt_id;
  END IF;

  RETURN TRUE;
END;
$$;
