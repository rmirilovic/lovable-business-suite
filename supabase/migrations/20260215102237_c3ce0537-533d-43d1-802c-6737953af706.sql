
-- Fix post_inter_warehouse_transfer: change description from 'Izlaz' to 'Ulaz storno' for source warehouse
CREATE OR REPLACE FUNCTION public.post_inter_warehouse_transfer(_transfer_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer inter_warehouse_transfers%ROWTYPE;
  v_item RECORD;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_item_order int := 0;
  v_total_value numeric := 0;
  v_src_inventory_account text;
  v_dst_inventory_account text;
  v_src_warehouse_code text;
  v_dst_warehouse_code text;
BEGIN
  -- Get transfer
  SELECT * INTO v_transfer FROM inter_warehouse_transfers WHERE id = _transfer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Međumagacinski prenos nije pronađen'; END IF;
  IF v_transfer.status = 'posted' THEN RAISE EXCEPTION 'Dokument je već proknjižen'; END IF;

  -- Check items exist
  IF NOT EXISTS (SELECT 1 FROM inter_warehouse_transfer_items WHERE transfer_id = _transfer_id) THEN
    RAISE EXCEPTION 'Dokument nema stavki';
  END IF;

  -- Validate same SVK (warehouse_type) for both warehouses
  DECLARE
    v_src_type text;
    v_dst_type text;
  BEGIN
    SELECT warehouse_type, COALESCE(inventory_account, '1320'), code
      INTO v_src_type, v_src_inventory_account, v_src_warehouse_code
      FROM warehouses WHERE id = v_transfer.source_warehouse_id;
    SELECT warehouse_type, COALESCE(inventory_account, '1320'), code
      INTO v_dst_type, v_dst_inventory_account, v_dst_warehouse_code
      FROM warehouses WHERE id = v_transfer.destination_warehouse_id;
    IF v_src_type != v_dst_type THEN
      RAISE EXCEPTION 'Magacini moraju biti istog tipa (SVK)';
    END IF;
  END;

  -- Calculate total value
  SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_total_value
  FROM inter_warehouse_transfer_items WHERE transfer_id = _transfer_id;

  -- Update stock: subtract from source, add to destination
  FOR v_item IN
    SELECT article_id, quantity
    FROM inter_warehouse_transfer_items
    WHERE transfer_id = _transfer_id
  LOOP
    UPDATE articles
    SET stock = COALESCE(stock, 0),
        updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  -- Create journal entry
  v_entry_number := 'MMP' || v_transfer.transfer_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    document_date, document_number, description, status,
    created_by, source_document_type, source_document_id
  ) VALUES (
    v_transfer.company_id, v_transfer.business_year_id, v_entry_number,
    v_transfer.transfer_date, v_transfer.transfer_date,
    v_transfer.transfer_number,
    'Međumagacinski prenos ' || v_transfer.transfer_number,
    'posted', _user_id, 'inter_warehouse_transfer', _transfer_id
  ) RETURNING id INTO v_journal_entry_id;

  -- Source warehouse: NEGATIVE debit (storno ulaz) on inventory account
  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, document_date, cost_center_code
  ) VALUES (
    v_journal_entry_id, v_transfer.company_id, v_src_inventory_account, v_item_order,
    'Ulaz storno - MMP ' || v_transfer.transfer_number,
    -v_total_value, 0, v_transfer.transfer_date, v_src_warehouse_code
  );

  -- Destination warehouse: POSITIVE debit on inventory account
  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, document_date, cost_center_code
  ) VALUES (
    v_journal_entry_id, v_transfer.company_id, v_dst_inventory_account, v_item_order,
    'Ulaz - MMP ' || v_transfer.transfer_number,
    v_total_value, 0, v_transfer.transfer_date, v_dst_warehouse_code
  );

  -- Update journal entry totals
  UPDATE journal_entries
  SET total_debit = v_total_value,
      total_credit = 0
  WHERE id = v_journal_entry_id;

  -- Update transfer status
  UPDATE inter_warehouse_transfers
  SET status = 'posted',
      posted_at = now(),
      posted_by = _user_id,
      journal_entry_id = v_journal_entry_id,
      updated_at = now()
  WHERE id = _transfer_id;

  RETURN _transfer_id;
END;
$$;
