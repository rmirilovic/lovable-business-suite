
-- Fix: Use warehouse's inventory_account instead of hardcoded logic based on warehouse_type
CREATE OR REPLACE FUNCTION post_goods_purchase_invoice(_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice goods_purchase_invoices%ROWTYPE;
  v_year_id uuid;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_goods_receipt_id uuid;
  v_receipt_number text;
  v_item RECORD;
  v_total_base numeric := 0;
  v_total_vat numeric := 0;
  v_total_deductible_vat numeric := 0;
  v_total_non_deductible_vat numeric := 0;
  v_stock_account text;
  v_supplier_account text;
  v_warehouse_type text;
BEGIN
  -- Get invoice data
  SELECT * INTO v_invoice FROM goods_purchase_invoices WHERE id = _invoice_id;
  
  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  
  IF v_invoice.status = 'posted' THEN
    RAISE EXCEPTION 'Invoice is already posted';
  END IF;
  
  -- Get business year
  SELECT id INTO v_year_id FROM business_years 
  WHERE company_id = v_invoice.company_id AND is_active = true
  LIMIT 1;
  
  -- Get stock account from warehouse (inventory_account field)
  -- Fall back to warehouse_type logic only if inventory_account is not set
  SELECT 
    COALESCE(
      w.inventory_account,
      CASE w.warehouse_type
        WHEN '1' THEN '1320'  -- Roba
        WHEN '2' THEN '1010'  -- Materijal
        WHEN '12' THEN '1010' -- Materijal
        WHEN '6' THEN '1030'  -- Rezervni delovi
        WHEN '9' THEN '1200'  -- Gotovi proizvodi
        ELSE '1010'           -- Default: Materijal
      END
    )
  INTO v_stock_account 
  FROM warehouses w 
  WHERE w.id = v_invoice.warehouse_id;
  
  -- Default if warehouse not found
  IF v_stock_account IS NULL THEN
    v_stock_account := '1010';
  END IF;
  
  -- Determine supplier account (domestic vs foreign)
  SELECT CASE WHEN p.legal_status = '4' THEN '4360' ELSE '4350' END
  INTO v_supplier_account
  FROM partners p WHERE p.id = v_invoice.partner_id;
  
  IF v_supplier_account IS NULL THEN
    v_supplier_account := '4350';
  END IF;
  
  -- Calculate totals from items
  SELECT 
    COALESCE(SUM(line_subtotal), 0),
    COALESCE(SUM(vat_amount), 0),
    COALESCE(SUM(CASE WHEN is_vat_deductible THEN vat_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN NOT is_vat_deductible THEN vat_amount ELSE 0 END), 0)
  INTO v_total_base, v_total_vat, v_total_deductible_vat, v_total_non_deductible_vat
  FROM goods_purchase_invoice_items
  WHERE goods_purchase_invoice_id = _invoice_id;
  
  -- Get next journal entry number
  SELECT get_next_journal_entry_number(v_invoice.company_id, v_year_id) INTO v_entry_number;
  
  -- Create journal entry
  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_number,
    description, source_document_type, source_document_id, status, created_by
  ) VALUES (
    v_invoice.company_id, v_year_id, v_entry_number, v_invoice.receipt_date,
    v_invoice.invoice_number, 
    'UFR: ' || v_invoice.invoice_number || ' - ' || COALESCE(v_invoice.partner_name, ''),
    'goods_purchase_invoice', _invoice_id, 'posted', v_invoice.created_by
  ) RETURNING id INTO v_journal_entry_id;
  
  -- Entry 1: Debit Stock account (from warehouse's inventory_account)
  IF v_total_base + v_total_non_deductible_vat > 0 THEN
    INSERT INTO journal_entry_items (
      journal_entry_id, account_code, description, debit_amount, credit_amount, 
      item_order, document_date
    ) VALUES (
      v_journal_entry_id, v_stock_account, 'Zalihe po UFR ' || v_invoice.invoice_number,
      v_total_base + v_total_non_deductible_vat, 0, 0, v_invoice.receipt_date
    );
  END IF;
  
  -- Entry 2: Debit VAT (if deductible)
  IF v_total_deductible_vat > 0 THEN
    INSERT INTO journal_entry_items (
      journal_entry_id, account_code, description, debit_amount, credit_amount,
      item_order, document_date
    ) VALUES (
      v_journal_entry_id, '2700', 'PDV po UFR ' || v_invoice.invoice_number,
      v_total_deductible_vat, 0, 1, v_invoice.receipt_date
    );
  END IF;
  
  -- Entry 3: Credit Supplier account
  INSERT INTO journal_entry_items (
    journal_entry_id, account_code, description, debit_amount, credit_amount,
    item_order, partner_id, document_date
  ) VALUES (
    v_journal_entry_id, v_supplier_account, 'Obaveza po UFR ' || v_invoice.invoice_number,
    0, v_total_base + v_total_vat, 2, v_invoice.partner_id, v_invoice.due_date
  );
  
  -- Create goods receipt
  SELECT get_next_goods_receipt_number(v_invoice.company_id) INTO v_receipt_number;
  
  INSERT INTO goods_receipts (
    company_id, warehouse_id, partner_id, receipt_number, receipt_date,
    source_invoice_id, note, status, created_by
  ) VALUES (
    v_invoice.company_id, v_invoice.warehouse_id, v_invoice.partner_id,
    v_receipt_number, v_invoice.receipt_date, _invoice_id,
    'Automatski kreirano iz UFR ' || v_invoice.invoice_number,
    'draft', v_invoice.created_by
  ) RETURNING id INTO v_goods_receipt_id;
  
  -- Insert goods receipt items with NET PRICE (after discount)
  INSERT INTO goods_receipt_items (
    goods_receipt_id, company_id, article_id, item_code, item_name, unit, quantity, unit_price, item_order
  )
  SELECT 
    v_goods_receipt_id, company_id, article_id, item_code, item_name, unit, quantity,
    CASE 
      WHEN quantity > 0 THEN line_subtotal / quantity  -- Net price = subtotal / quantity
      ELSE unit_price * (1 - COALESCE(discount_percent, 0) / 100)
    END as unit_price,
    item_order
  FROM goods_purchase_invoice_items
  WHERE goods_purchase_invoice_id = _invoice_id;
  
  -- Post the goods receipt (updates stock)
  PERFORM post_goods_receipt(v_goods_receipt_id);
  
  -- Update invoice status
  UPDATE goods_purchase_invoices 
  SET status = 'posted', 
      posted_at = now(),
      journal_entry_id = v_journal_entry_id
  WHERE id = _invoice_id;
END;
$$;
