
-- Remove the override logic from post_customs_clearance
CREATE OR REPLACE FUNCTION public.post_customs_clearance(_clearance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cc customs_clearances%ROWTYPE;
  v_src_inventory_account text;
  v_dst_inventory_account text;
  v_transfer_id uuid;
  v_transfer_number text;
  v_je_id uuid;
  v_je_number text;
  v_total_invoice_value numeric;
  v_total_cost_value numeric;
  v_vat_base numeric;
  v_vat_amount numeric;
  v_customs_obligation numeric;
  v_item record;
BEGIN
  SELECT * INTO v_cc FROM customs_clearances WHERE id = _clearance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carinski obračun nije pronađen'; END IF;
  IF v_cc.status = 'posted' THEN RAISE EXCEPTION 'Dokument je već proknjižen'; END IF;

  -- Check items exist
  IF NOT EXISTS (SELECT 1 FROM customs_clearance_items WHERE customs_clearance_id = _clearance_id AND quantity > 0) THEN
    RAISE EXCEPTION 'Dokument nema stavki sa količinom';
  END IF;

  -- Get warehouse accounts from warehouse records (no override)
  SELECT COALESCE(inventory_account, '1310') INTO v_src_inventory_account
    FROM warehouses WHERE id = v_cc.source_warehouse_id;
  SELECT COALESCE(inventory_account, '1320') INTO v_dst_inventory_account
    FROM warehouses WHERE id = v_cc.destination_warehouse_id;

  -- 1) Create inter-warehouse transfer
  SELECT get_next_transfer_number(v_cc.company_id, v_cc.business_year_id) INTO v_transfer_number;

  INSERT INTO inter_warehouse_transfers (
    company_id, business_year_id, source_warehouse_id, destination_warehouse_id,
    transfer_number, transfer_date, status, note, created_by
  ) VALUES (
    v_cc.company_id, v_cc.business_year_id, v_cc.source_warehouse_id, v_cc.destination_warehouse_id,
    v_transfer_number, v_cc.clearance_date, 'draft',
    'Automatski prenos iz carinskog obračuna ' || v_cc.clearance_number,
    v_cc.created_by
  ) RETURNING id INTO v_transfer_id;

  -- Insert transfer items from clearance items at cost_price
  INSERT INTO inter_warehouse_transfer_items (
    company_id, transfer_id, article_id, item_code, item_name, unit,
    quantity, price, value, item_order
  )
  SELECT
    v_cc.company_id, v_transfer_id, ci.article_id, ci.item_code, ci.item_name, ci.unit,
    ci.quantity, ci.cost_price, ci.cost_value, ci.item_order
  FROM customs_clearance_items ci
  WHERE ci.customs_clearance_id = _clearance_id AND ci.quantity > 0;

  -- Post the transfer (updates stock)
  PERFORM post_transfer(v_transfer_id);

  -- 2) Calculate totals for journal entry
  SELECT
    COALESCE(SUM(invoice_value_rsd), 0),
    COALESCE(SUM(cost_value), 0)
  INTO v_total_invoice_value, v_total_cost_value
  FROM customs_clearance_items
  WHERE customs_clearance_id = _clearance_id AND quantity > 0;

  v_vat_base := v_total_invoice_value + COALESCE(v_cc.customs_duty_amount, 0);
  v_vat_amount := ROUND(v_vat_base * COALESCE(v_cc.vat_rate, 20) / 100, 2);
  v_customs_obligation := COALESCE(v_cc.customs_duty_amount, 0) + COALESCE(v_cc.excise_amount, 0) + v_vat_amount;

  -- 3) Create journal entry
  SELECT get_next_journal_entry_number(v_cc.company_id, v_cc.business_year_id) INTO v_je_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    description, source_document_type, source_document_id,
    status, created_by
  ) VALUES (
    v_cc.company_id, v_cc.business_year_id, v_je_number, v_cc.clearance_date,
    'Carinski obračun ' || v_cc.clearance_number,
    'customs_clearance', _clearance_id,
    'posted', v_cc.created_by
  ) RETURNING id INTO v_je_id;

  -- Debit: Customs duty account
  IF COALESCE(v_cc.customs_duty_amount, 0) > 0 AND COALESCE(v_cc.customs_duty_account, '') != '' THEN
    INSERT INTO journal_entry_items (company_id, journal_entry_id, account_code, debit_amount, credit_amount, description, item_order)
    VALUES (v_cc.company_id, v_je_id, v_cc.customs_duty_account, v_cc.customs_duty_amount, 0, 'Carina', 1);
  END IF;

  -- Debit: Excise account
  IF COALESCE(v_cc.excise_amount, 0) > 0 AND COALESCE(v_cc.excise_account, '') != '' THEN
    INSERT INTO journal_entry_items (company_id, journal_entry_id, account_code, debit_amount, credit_amount, description, item_order)
    VALUES (v_cc.company_id, v_je_id, v_cc.excise_account, v_cc.excise_amount, 0, 'Akciza', 2);
  END IF;

  -- Debit: VAT account
  IF v_vat_amount > 0 AND COALESCE(v_cc.vat_account, '') != '' THEN
    INSERT INTO journal_entry_items (company_id, journal_entry_id, account_code, debit_amount, credit_amount, description, item_order)
    VALUES (v_cc.company_id, v_je_id, v_cc.vat_account, v_vat_amount, 0, 'PDV na carinu', 3);
  END IF;

  -- Credit: Customs obligation account
  IF v_customs_obligation > 0 AND COALESCE(v_cc.customs_obligation_account, '') != '' THEN
    INSERT INTO journal_entry_items (company_id, journal_entry_id, account_code, debit_amount, credit_amount, description, item_order)
    VALUES (v_cc.company_id, v_je_id, v_cc.customs_obligation_account, 0, v_customs_obligation, 'Obaveze prema carini', 4);
  END IF;

  -- 4) Update clearance status
  UPDATE customs_clearances SET
    status = 'posted',
    posted_at = now(),
    posted_by = auth.uid(),
    transfer_id = v_transfer_id,
    journal_entry_id = v_je_id,
    invoice_value_rsd = v_total_invoice_value,
    total_cost_value = v_total_cost_value,
    updated_at = now()
  WHERE id = _clearance_id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'journal_entry_id', v_je_id,
    'transfer_number', v_transfer_number
  );
END;
$$;
