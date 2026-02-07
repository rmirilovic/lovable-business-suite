
-- 1. CLEANUP: Disable article audit trigger temporarily
ALTER TABLE articles DISABLE TRIGGER article_audit_trigger;

-- 2. Reverse stock for orphaned receipts (source_invoice_id IS NULL, status = 'posted')
DO $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN
    SELECT gi.article_id, gi.quantity
    FROM goods_receipt_items gi
    JOIN goods_receipts gr ON gi.goods_receipt_id = gr.id
    WHERE gr.source_invoice_id IS NULL
      AND gr.status = 'posted'
      AND gi.article_id IS NOT NULL
  LOOP
    UPDATE articles
    SET stock = COALESCE(stock, 0) - v_item.quantity,
        updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;
END $$;

-- 3. Delete orphaned receipt items
DELETE FROM goods_receipt_items
WHERE goods_receipt_id IN (
  SELECT id FROM goods_receipts WHERE source_invoice_id IS NULL
);

-- 4. Delete orphaned receipts
DELETE FROM goods_receipts WHERE source_invoice_id IS NULL;

-- 5. Fix the receipt number for the current UFR (262601 -> 260001)
UPDATE goods_receipts
SET receipt_number = '260001'
WHERE id = 'c52e8615-3c6b-466d-8d77-e913a19406df';

-- 6. Re-enable article audit trigger
ALTER TABLE articles ENABLE TRIGGER article_audit_trigger;

-- 7. FIX: post_goods_purchase_invoice - use invoice number for receipt number
CREATE OR REPLACE FUNCTION public.post_goods_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
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
BEGIN
  SELECT * INTO v_invoice FROM goods_purchase_invoices WHERE id = _invoice_id;
  IF v_invoice IS NULL THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF v_invoice.status = 'posted' THEN RAISE EXCEPTION 'Faktura je već proknjižena'; END IF;

  SELECT * INTO v_partner FROM partners WHERE id = v_invoice.partner_id;
  IF v_partner.legal_status = 4 THEN v_supplier_account_code := '4360';
  ELSE v_supplier_account_code := '4350'; END IF;

  SELECT COALESCE(inventory_account, '1320') INTO v_inventory_account_code
  FROM warehouses WHERE id = v_invoice.warehouse_id;

  -- Journal entry number = 'UFR' + invoice internal_number
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

  -- Receipt uses SAME number as invoice (not a separate sequence)
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
  SET status = 'posted',
      posted_at = now(),
      posted_by = _user_id,
      journal_entry_id = v_journal_entry_id,
      goods_receipt_id = v_goods_receipt_id,
      updated_at = now()
  WHERE id = _invoice_id;

  RETURN v_journal_entry_id;
END;
$$;
