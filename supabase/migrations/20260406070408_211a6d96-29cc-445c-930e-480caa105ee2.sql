
-- Function to post a customs clearance
-- Creates: 1) Inter-warehouse transfer (MMP) with items at cost_price
--          2) Journal entry for customs duties, VAT, obligations
-- Then posts the MMP which handles stock movements
CREATE OR REPLACE FUNCTION public.post_customs_clearance(_clearance_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cc customs_clearances%ROWTYPE;
  v_item RECORD;
  v_transfer_id uuid;
  v_transfer_number text;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_item_order int := 0;
  v_src_inventory_account text;
  v_dst_inventory_account text;
BEGIN
  -- Get clearance
  SELECT * INTO v_cc FROM customs_clearances WHERE id = _clearance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carinski obračun nije pronađen'; END IF;
  IF v_cc.status = 'posted' THEN RAISE EXCEPTION 'Dokument je već proknjižen'; END IF;

  -- Check items exist
  IF NOT EXISTS (SELECT 1 FROM customs_clearance_items WHERE customs_clearance_id = _clearance_id AND quantity > 0) THEN
    RAISE EXCEPTION 'Dokument nema stavki sa količinom';
  END IF;

  -- Get warehouse accounts
  SELECT COALESCE(inventory_account, '1310') INTO v_src_inventory_account
    FROM warehouses WHERE id = v_cc.source_warehouse_id;
  SELECT COALESCE(inventory_account, '1320') INTO v_dst_inventory_account
    FROM warehouses WHERE id = v_cc.destination_warehouse_id;

  -- Override with user-specified accounts if provided
  IF v_cc.source_warehouse_account IS NOT NULL AND v_cc.source_warehouse_account != '' THEN
    v_src_inventory_account := v_cc.source_warehouse_account;
  END IF;
  IF v_cc.destination_warehouse_account IS NOT NULL AND v_cc.destination_warehouse_account != '' THEN
    v_dst_inventory_account := v_cc.destination_warehouse_account;
  END IF;

  -- 1) Create inter-warehouse transfer
  SELECT get_next_transfer_number(v_cc.company_id, v_cc.business_year_id) INTO v_transfer_number;

  INSERT INTO inter_warehouse_transfers (
    company_id, business_year_id, source_warehouse_id, destination_warehouse_id,
    transfer_number, transfer_date, status, note, created_by
  ) VALUES (
    v_cc.company_id, v_cc.business_year_id, v_cc.source_warehouse_id, v_cc.destination_warehouse_id,
    v_transfer_number, v_cc.clearance_date, 'draft',
    'Automatski MMP iz carinskog obračuna ' || v_cc.clearance_number,
    _user_id
  ) RETURNING id INTO v_transfer_id;

  -- 2) Create transfer items at cost_price
  INSERT INTO inter_warehouse_transfer_items (
    transfer_id, company_id, article_id, item_code, item_name, unit,
    quantity, unit_price, item_order
  )
  SELECT
    v_transfer_id, v_cc.company_id, ci.article_id, ci.item_code, ci.item_name, ci.unit,
    ci.quantity, ci.cost_price, ci.item_order
  FROM customs_clearance_items ci
  WHERE ci.customs_clearance_id = _clearance_id AND ci.quantity > 0;

  -- 3) Post the transfer (this handles stock movements and creates MMP journal entry)
  PERFORM post_inter_warehouse_transfer(v_transfer_id, _user_id);

  -- 4) Create journal entry for customs duties/VAT/obligations
  v_entry_number := 'CO' || v_cc.clearance_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    document_date, document_number, description, status,
    created_by, source_document_type, source_document_id
  ) VALUES (
    v_cc.company_id, v_cc.business_year_id, v_entry_number,
    v_cc.clearance_date, v_cc.clearance_date,
    v_cc.clearance_number,
    'Carinski obračun ' || v_cc.clearance_number,
    'posted', _user_id, 'customs_clearance', _clearance_id
  ) RETURNING id INTO v_journal_entry_id;

  -- Journal items:
  -- D: Customs duty account (cost of customs duty)
  IF v_cc.customs_duty_amount > 0 AND v_cc.customs_duty_account IS NOT NULL AND v_cc.customs_duty_account != '' THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, document_date
    ) VALUES (
      v_journal_entry_id, v_cc.company_id, v_cc.customs_duty_account, v_item_order,
      'Carina - CO ' || v_cc.clearance_number,
      v_cc.customs_duty_amount, 0, v_cc.clearance_date
    );
  END IF;

  -- D: Excise account
  IF v_cc.excise_amount > 0 AND v_cc.excise_account IS NOT NULL AND v_cc.excise_account != '' THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, document_date
    ) VALUES (
      v_journal_entry_id, v_cc.company_id, v_cc.excise_account, v_item_order,
      'Akciza - CO ' || v_cc.clearance_number,
      v_cc.excise_amount, 0, v_cc.clearance_date
    );
  END IF;

  -- D: VAT account (input VAT)
  IF v_cc.vat_amount > 0 AND v_cc.vat_account IS NOT NULL AND v_cc.vat_account != '' THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, document_date
    ) VALUES (
      v_journal_entry_id, v_cc.company_id, v_cc.vat_account, v_item_order,
      'PDV pri uvozu - CO ' || v_cc.clearance_number,
      v_cc.vat_amount, 0, v_cc.clearance_date
    );
  END IF;

  -- P: Customs obligation account (total = duty + excise + VAT)
  IF v_cc.customs_obligation_account IS NOT NULL AND v_cc.customs_obligation_account != '' THEN
    DECLARE
      v_obligation_total numeric;
    BEGIN
      v_obligation_total := COALESCE(v_cc.customs_duty_amount, 0) + COALESCE(v_cc.excise_amount, 0) + COALESCE(v_cc.vat_amount, 0);
      IF v_obligation_total > 0 THEN
        v_item_order := v_item_order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order, description,
          debit_amount, credit_amount, document_date
        ) VALUES (
          v_journal_entry_id, v_cc.company_id, v_cc.customs_obligation_account, v_item_order,
          'Obaveza prema carini - CO ' || v_cc.clearance_number,
          0, v_obligation_total, v_cc.clearance_date
        );
      END IF;
    END;
  END IF;

  -- Update totals on journal entry
  UPDATE journal_entries SET
    total_debit = (SELECT COALESCE(SUM(debit_amount), 0) FROM journal_entry_items WHERE journal_entry_id = v_journal_entry_id),
    total_credit = (SELECT COALESCE(SUM(credit_amount), 0) FROM journal_entry_items WHERE journal_entry_id = v_journal_entry_id),
    posted_at = now(),
    posted_by = _user_id
  WHERE id = v_journal_entry_id;

  -- 5) Update customs clearance status
  UPDATE customs_clearances SET
    status = 'posted',
    posted_at = now(),
    posted_by = _user_id,
    journal_entry_id = v_journal_entry_id,
    transfer_id = v_transfer_id,
    updated_at = now()
  WHERE id = _clearance_id;
END;
$$;

-- Function to unpost a customs clearance
CREATE OR REPLACE FUNCTION public.unpost_customs_clearance(_clearance_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cc customs_clearances%ROWTYPE;
BEGIN
  SELECT * INTO v_cc FROM customs_clearances WHERE id = _clearance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carinski obračun nije pronađen'; END IF;
  IF v_cc.status != 'posted' THEN RAISE EXCEPTION 'Dokument nije proknjižen'; END IF;

  -- 1) Unpost and delete the transfer (reverses stock)
  IF v_cc.transfer_id IS NOT NULL THEN
    -- Check if transfer is posted
    IF EXISTS (SELECT 1 FROM inter_warehouse_transfers WHERE id = v_cc.transfer_id AND status = 'posted') THEN
      PERFORM unpost_inter_warehouse_transfer(v_cc.transfer_id, _user_id);
    END IF;
    -- Delete transfer items then transfer
    DELETE FROM inter_warehouse_transfer_items WHERE transfer_id = v_cc.transfer_id;
    DELETE FROM inter_warehouse_transfers WHERE id = v_cc.transfer_id;
  END IF;

  -- 2) Delete the customs journal entry
  IF v_cc.journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_cc.journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_cc.journal_entry_id;
  END IF;

  -- 3) Reset customs clearance status
  UPDATE customs_clearances SET
    status = 'draft',
    posted_at = NULL,
    posted_by = NULL,
    journal_entry_id = NULL,
    transfer_id = NULL,
    updated_at = now()
  WHERE id = _clearance_id;
END;
$$;
