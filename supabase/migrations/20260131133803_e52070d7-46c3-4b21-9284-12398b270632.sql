-- Fix the post_goods_purchase_invoice function - use correct field name 'svk' instead of 'svk_type'
CREATE OR REPLACE FUNCTION public.post_goods_purchase_invoice(_invoice_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _invoice goods_purchase_invoices%ROWTYPE;
  _journal_entry_id uuid;
  _journal_entry_number integer;
  _partner partners%ROWTYPE;
  _warehouse warehouses%ROWTYPE;
  _item RECORD;
  _item_order integer := 1;
  _payable_account text := '4320'; -- Obaveze prema dobavljačima
  _input_vat_account text := '2700'; -- Ulazni PDV
  _inventory_account text;
  _total_inventory_debit numeric := 0;
BEGIN
  SELECT * INTO _invoice FROM goods_purchase_invoices WHERE id = _invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ulazna faktura nije pronađena';
  END IF;
  
  IF _invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi';
  END IF;
  
  IF _invoice.total_amount <= 0 THEN
    RAISE EXCEPTION 'Faktura mora imati pozitivan iznos';
  END IF;
  
  SELECT * INTO _partner FROM partners WHERE id = _invoice.partner_id;
  SELECT * INTO _warehouse FROM warehouses WHERE id = _invoice.warehouse_id;
  
  -- Determine inventory account based on warehouse SVK (fixed field name)
  -- SVK types: 1=Roba, 2=Materijal, 6=Rezervni delovi
  CASE _warehouse.svk
    WHEN '1' THEN _inventory_account := '1320'; -- Roba u magacinu
    WHEN '2' THEN _inventory_account := '1010'; -- Materijal
    WHEN '6' THEN _inventory_account := '1020'; -- Rezervni delovi
    WHEN '9' THEN _inventory_account := '1320'; -- Roba
    WHEN '12' THEN _inventory_account := '1320'; -- Roba
    ELSE _inventory_account := '1320'; -- Default: Roba
  END CASE;
  
  -- Calculate total inventory amount (for items where VAT is not deductible, include VAT)
  SELECT COALESCE(SUM(
    CASE WHEN is_vat_deductible THEN line_subtotal ELSE line_total END
  ), 0) INTO _total_inventory_debit
  FROM goods_purchase_invoice_items
  WHERE goods_purchase_invoice_id = _invoice_id;
  
  -- Get next journal entry number
  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO _journal_entry_number
  FROM journal_entries
  WHERE company_id = _invoice.company_id AND business_year_id = _invoice.business_year_id;
  
  -- Create journal entry
  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    document_number, description, status, total_debit, total_credit,
    posted_at, posted_by, source_document_type, source_document_id, created_by
  ) VALUES (
    _invoice.company_id, _invoice.business_year_id, _journal_entry_number,
    _invoice.receipt_date, _invoice.invoice_date, _invoice.internal_number,
    'Ulazna faktura roba ' || _invoice.internal_number || ' - ' || COALESCE(_invoice.supplier_name, _partner.name),
    'posted', _invoice.total_amount, _invoice.total_amount,
    now(), _user_id, 'goods_purchase_invoice', _invoice_id, _user_id
  )
  RETURNING id INTO _journal_entry_id;
  
  -- Credit: Obaveze prema dobavljaču (ukupan iznos sa PDV)
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id
  ) VALUES (
    _journal_entry_id, _invoice.company_id, _payable_account, _item_order,
    'Obaveza prema dobavljaču - ' || COALESCE(_invoice.supplier_name, _partner.name),
    0, _invoice.total_amount, _invoice.partner_id
  );
  _item_order := _item_order + 1;
  
  -- Debit: Ulazni PDV (ako je dobavljač u sistemu PDV-a i PDV je odbitni)
  IF _invoice.supplier_is_in_pdv AND _invoice.vat_calculation_type = 'standard' AND _invoice.vat_amount > 0 THEN
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, partner_id
    ) VALUES (
      _journal_entry_id, _invoice.company_id, _input_vat_account, _item_order,
      'Ulazni PDV - faktura ' || _invoice.internal_number,
      _invoice.vat_amount, 0, NULL
    );
    _item_order := _item_order + 1;
  END IF;
  
  -- Debit: Zalihe (sa analitikom magacina)
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id, cost_center_code
  ) VALUES (
    _journal_entry_id, _invoice.company_id, _inventory_account, _item_order,
    'Zalihe - magacin ' || _warehouse.code || ' - ' || _warehouse.name,
    _total_inventory_debit, 0, NULL, _warehouse.code
  );
  
  -- Update invoice status
  UPDATE goods_purchase_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id, journal_entry_id = _journal_entry_id
  WHERE id = _invoice_id;
  
  RETURN TRUE;
END;
$function$;