-- Drop and recreate the post_goods_purchase_invoice function with correct warehouse_type reference
DROP FUNCTION IF EXISTS public.post_goods_purchase_invoice(UUID, UUID);

CREATE OR REPLACE FUNCTION public.post_goods_purchase_invoice(
  _invoice_id UUID,
  _user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice goods_purchase_invoices%ROWTYPE;
  _partner partners%ROWTYPE;
  _warehouse warehouses%ROWTYPE;
  _business_year business_years%ROWTYPE;
  _next_entry_number INTEGER;
  _journal_entry_id UUID;
  _inventory_account TEXT;
  _supplier_account TEXT := '4320'; -- Dobavljači u zemlji
  _vat_account TEXT := '2700'; -- PDV po primljenim fakturama
  _item RECORD;
BEGIN
  -- Validate invoice exists and is in draft status
  SELECT * INTO _invoice FROM goods_purchase_invoices WHERE id = _invoice_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Faktura nije pronađena');
  END IF;
  
  IF _invoice.status != 'draft' THEN
    RETURN json_build_object('success', false, 'error', 'Samo fakture u pripremi mogu biti proknjižene');
  END IF;
  
  -- Get partner info
  SELECT * INTO _partner FROM partners WHERE id = _invoice.partner_id;
  
  -- Get warehouse info and determine inventory account based on warehouse_type
  SELECT * INTO _warehouse FROM warehouses WHERE id = _invoice.warehouse_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Magacin nije pronađen');
  END IF;
  
  -- Use inventory_account from warehouse if defined, otherwise use default based on warehouse_type
  IF _warehouse.inventory_account IS NOT NULL AND _warehouse.inventory_account != '' THEN
    _inventory_account := _warehouse.inventory_account;
  ELSE
    -- Default accounts based on warehouse_type
    CASE _warehouse.warehouse_type
      WHEN '1' THEN _inventory_account := '1320'; -- Roba
      WHEN '2' THEN _inventory_account := '1010'; -- Materijal
      WHEN '6' THEN _inventory_account := '1030'; -- Rezervni delovi
      WHEN '9' THEN _inventory_account := '1200'; -- Gotovi proizvodi
      WHEN '12' THEN _inventory_account := '1010'; -- Materijal za gradnju
      ELSE _inventory_account := '1320'; -- Default roba
    END CASE;
  END IF;
  
  -- Get business year
  SELECT * INTO _business_year FROM business_years WHERE id = _invoice.business_year_id;
  
  -- Get next entry number for this business year
  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO _next_entry_number
  FROM journal_entries 
  WHERE company_id = _invoice.company_id 
    AND business_year_id = _invoice.business_year_id;
  
  -- Create journal entry
  INSERT INTO journal_entries (
    company_id,
    business_year_id,
    entry_number,
    entry_date,
    document_date,
    document_number,
    description,
    source_document_type,
    source_document_id,
    total_debit,
    total_credit,
    status,
    created_by,
    posted_at,
    posted_by
  ) VALUES (
    _invoice.company_id,
    _invoice.business_year_id,
    _next_entry_number,
    _invoice.receipt_date,
    _invoice.invoice_date,
    _invoice.supplier_invoice_number,
    'UFR ' || _invoice.internal_number || ' - ' || COALESCE(_invoice.supplier_name, _partner.name),
    'goods_purchase_invoice',
    _invoice_id,
    _invoice.total_amount,
    _invoice.total_amount,
    'posted',
    _user_id,
    NOW(),
    _user_id
  )
  RETURNING id INTO _journal_entry_id;
  
  -- Create journal entry items
  -- 1. Debit inventory account (roba/materijal)
  INSERT INTO journal_entry_items (
    journal_entry_id,
    company_id,
    item_order,
    account_code,
    description,
    debit_amount,
    credit_amount,
    partner_id
  ) VALUES (
    _journal_entry_id,
    _invoice.company_id,
    1,
    _inventory_account,
    'Nabavka robe - ' || _invoice.supplier_invoice_number,
    _invoice.subtotal,
    0,
    _invoice.partner_id
  );
  
  -- 2. Debit VAT account (if applicable)
  IF _invoice.vat_amount > 0 THEN
    INSERT INTO journal_entry_items (
      journal_entry_id,
      company_id,
      item_order,
      account_code,
      description,
      debit_amount,
      credit_amount,
      partner_id
    ) VALUES (
      _journal_entry_id,
      _invoice.company_id,
      2,
      _vat_account,
      'PDV po ulaznoj fakturi - ' || _invoice.supplier_invoice_number,
      _invoice.vat_amount,
      0,
      _invoice.partner_id
    );
  END IF;
  
  -- 3. Credit supplier account
  INSERT INTO journal_entry_items (
    journal_entry_id,
    company_id,
    item_order,
    account_code,
    description,
    debit_amount,
    credit_amount,
    partner_id
  ) VALUES (
    _journal_entry_id,
    _invoice.company_id,
    CASE WHEN _invoice.vat_amount > 0 THEN 3 ELSE 2 END,
    _supplier_account,
    'Obaveza prema dobavljaču - ' || COALESCE(_invoice.supplier_name, _partner.name),
    0,
    _invoice.total_amount,
    _invoice.partner_id
  );
  
  -- Update invoice status
  UPDATE goods_purchase_invoices
  SET 
    status = 'posted',
    posted_at = NOW(),
    posted_by = _user_id,
    journal_entry_id = _journal_entry_id
  WHERE id = _invoice_id;
  
  RETURN json_build_object(
    'success', true, 
    'journal_entry_id', _journal_entry_id,
    'entry_number', _next_entry_number
  );
END;
$$;