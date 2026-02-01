
-- Update post_goods_purchase_invoice function to use different accounts for domestic vs foreign suppliers
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
  v_entry_number int;
  v_item_order int := 0;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_goods_receipt_id uuid;
  v_supplier_account_code text;
  v_input_vat_account_code text := '2700';
  v_inventory_account_code text := '1320';
  v_item record;
  v_vat_deductible_amount numeric := 0;
  v_vat_non_deductible_amount numeric := 0;
  v_inventory_amount numeric := 0;
BEGIN
  SELECT * INTO v_invoice FROM goods_purchase_invoices WHERE id = _invoice_id;
  
  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Faktura nije pronađena';
  END IF;
  
  IF v_invoice.status = 'posted' THEN
    RAISE EXCEPTION 'Faktura je već proknjižena';
  END IF;

  -- Get partner to determine account code based on legal_status
  SELECT * INTO v_partner FROM partners WHERE id = v_invoice.partner_id;
  
  -- Use 4360 for foreign suppliers (legal_status = 4), 4350 for domestic
  IF v_partner.legal_status = 4 THEN
    v_supplier_account_code := '4360';
  ELSE
    v_supplier_account_code := '4350';
  END IF;

  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_entry_number
  FROM journal_entries
  WHERE company_id = v_invoice.company_id AND business_year_id = v_invoice.business_year_id;

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
  FROM goods_purchase_invoice_items
  WHERE goods_purchase_invoice_id = _invoice_id;

  v_inventory_amount := v_inventory_amount + v_vat_non_deductible_amount;

  -- 1. Credit supplier account - uses invoice due_date as document_date
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

  -- 2. Debit input VAT - uses receipt_date as document_date
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

  -- 3. Debit inventory account - uses receipt_date as document_date
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
  SET total_debit = v_total_debit, total_credit = v_total_credit, posted_at = now()
  WHERE id = v_journal_entry_id;

  INSERT INTO goods_receipts (
    company_id, business_year_id, warehouse_id, partner_id, receipt_number,
    receipt_date, source_invoice_id, status, created_by
  ) VALUES (
    v_invoice.company_id, v_invoice.business_year_id, v_invoice.warehouse_id,
    v_invoice.partner_id, v_invoice.internal_number, v_invoice.receipt_date,
    _invoice_id, 'posted', _user_id
  ) RETURNING id INTO v_goods_receipt_id;

  INSERT INTO goods_receipt_items (
    goods_receipt_id, company_id, article_id, item_code, item_name, unit, quantity, unit_price, item_order
  )
  SELECT 
    v_goods_receipt_id, company_id, article_id, item_code, item_name, unit, quantity, unit_price, item_order
  FROM goods_purchase_invoice_items
  WHERE goods_purchase_invoice_id = _invoice_id;

  UPDATE goods_purchase_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = v_journal_entry_id, goods_receipt_id = v_goods_receipt_id,
      updated_at = now()
  WHERE id = _invoice_id;

  RETURN v_journal_entry_id;
END;
$$;

-- Update post_service_purchase_invoice function to use different accounts for domestic vs foreign suppliers
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
  v_entry_number int;
  v_item_order int := 0;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_supplier_account_code text;
  v_input_vat_account_code text := '2700';
  v_item record;
  v_cost record;
  v_line_amount numeric;
BEGIN
  SELECT * INTO v_invoice FROM service_purchase_invoices WHERE id = _invoice_id;
  
  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Faktura nije pronađena';
  END IF;
  
  IF v_invoice.status = 'posted' THEN
    RAISE EXCEPTION 'Faktura je već proknjižena';
  END IF;

  -- Get partner to determine account code based on legal_status
  SELECT * INTO v_partner FROM partners WHERE id = v_invoice.partner_id;
  
  -- Use 4360 for foreign suppliers (legal_status = 4), 4350 for domestic
  IF v_partner.legal_status = 4 THEN
    v_supplier_account_code := '4360';
  ELSE
    v_supplier_account_code := '4350';
  END IF;

  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_entry_number
  FROM journal_entries
  WHERE company_id = v_invoice.company_id AND business_year_id = v_invoice.business_year_id;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    document_number, description, status, created_by, source_document_type, source_document_id
  ) VALUES (
    v_invoice.company_id, v_invoice.business_year_id, v_entry_number, v_invoice.receipt_date,
    v_invoice.due_date, v_invoice.supplier_invoice_number,
    'UFRE: ' || v_invoice.internal_number || ' - ' || COALESCE(v_invoice.supplier_name, ''),
    'posted', _user_id, 'service_purchase_invoice', _invoice_id
  ) RETURNING id INTO v_journal_entry_id;

  -- 1. Credit supplier account - uses invoice due_date as document_date
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

  -- 2. Process each item - uses receipt_date as document_date
  FOR v_item IN 
    SELECT * FROM service_purchase_invoice_items WHERE service_purchase_invoice_id = _invoice_id ORDER BY item_order
  LOOP
    SELECT * INTO v_cost FROM input_costs WHERE id = v_item.input_cost_id;
    
    IF v_cost IS NULL THEN
      RAISE EXCEPTION 'Ulazni trošak nije pronađen za stavku';
    END IF;

    IF v_item.is_vat_deductible THEN
      v_line_amount := v_item.line_subtotal;
    ELSE
      v_line_amount := v_item.line_subtotal + v_item.line_vat;
    END IF;

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_journal_entry_id, v_invoice.company_id, v_cost.account_code, v_item_order,
      v_item.item_name, v_line_amount, 0,
      (SELECT code FROM organizational_units WHERE id = v_invoice.org_unit_id),
      v_invoice.receipt_date
    );
    v_total_debit := v_total_debit + v_line_amount;

    IF v_item.is_vat_deductible AND v_item.line_vat > 0 THEN
      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, document_date
      ) VALUES (
        v_journal_entry_id, v_invoice.company_id, v_input_vat_account_code, v_item_order,
        'Ulazni PDV - ' || v_item.item_name, v_item.line_vat, 0, v_invoice.receipt_date
      );
      v_total_debit := v_total_debit + v_item.line_vat;
    END IF;
  END LOOP;

  UPDATE journal_entries
  SET total_debit = v_total_debit, total_credit = v_total_credit, posted_at = now()
  WHERE id = v_journal_entry_id;

  UPDATE service_purchase_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = v_journal_entry_id, updated_at = now()
  WHERE id = _invoice_id;

  RETURN v_journal_entry_id;
END;
$$;
