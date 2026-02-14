
CREATE OR REPLACE FUNCTION public.post_inventory_count(_count_id UUID, _user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ic RECORD;
  v_item RECORD;
  v_surplus_total NUMERIC := 0;
  v_deficit_total NUMERIC := 0;
  v_je_id UUID;
  v_entry_number TEXT;
  v_inventory_account TEXT;
  v_item_order INT := 0;
BEGIN
  SELECT ic.*, w.inventory_account, w.code as warehouse_code
  INTO v_ic
  FROM inventory_counts ic
  JOIN warehouses w ON w.id = ic.warehouse_id
  WHERE ic.id = _count_id;

  IF v_ic IS NULL THEN
    RAISE EXCEPTION 'Popisna lista nije pronađena';
  END IF;
  IF v_ic.status = 'posted' THEN
    RAISE EXCEPTION 'Popisna lista je već proknjižena';
  END IF;

  v_inventory_account := COALESCE(v_ic.inventory_account, '1320');

  SELECT COALESCE(SUM(surplus_value), 0), COALESCE(SUM(deficit_value), 0)
  INTO v_surplus_total, v_deficit_total
  FROM inventory_count_items
  WHERE inventory_count_id = _count_id;

  IF v_surplus_total > 0 OR v_deficit_total > 0 THEN
    v_entry_number := 'POP' || v_ic.count_number;

    INSERT INTO journal_entries (
      company_id, business_year_id, entry_number, entry_date,
      document_date, description, status, total_debit, total_credit,
      source_document_type, source_document_id, created_by,
      posted_at, posted_by
    ) VALUES (
      v_ic.company_id, v_ic.business_year_id, v_entry_number, v_ic.count_date,
      v_ic.count_date, 'Popis ' || v_ic.count_number || ' - Magacin ' || v_ic.warehouse_code,
      'posted', v_surplus_total + v_deficit_total, v_surplus_total + v_deficit_total,
      'inventory_count', _count_id, _user_id,
      now(), _user_id
    ) RETURNING id INTO v_je_id;

    IF v_surplus_total > 0 THEN
      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount, cost_center_code, document_date)
      VALUES (v_je_id, v_ic.company_id, v_inventory_account, v_item_order,
        'Višak po popisu ' || v_ic.count_number, v_surplus_total, 0, v_ic.warehouse_code, v_ic.count_date);

      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount, document_date)
      VALUES (v_je_id, v_ic.company_id, '6790', v_item_order,
        'Višak po popisu ' || v_ic.count_number, 0, v_surplus_total, v_ic.count_date);
    END IF;

    IF v_deficit_total > 0 THEN
      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount, document_date)
      VALUES (v_je_id, v_ic.company_id, '5790', v_item_order,
        'Manjak po popisu ' || v_ic.count_number, v_deficit_total, 0, v_ic.count_date);

      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount, cost_center_code, document_date)
      VALUES (v_je_id, v_ic.company_id, v_inventory_account, v_item_order,
        'Manjak po popisu ' || v_ic.count_number, 0, v_deficit_total, v_ic.warehouse_code, v_ic.count_date);
    END IF;

    UPDATE inventory_counts
    SET status = 'posted', posted_at = now(), posted_by = _user_id, journal_entry_id = v_je_id
    WHERE id = _count_id;
  ELSE
    UPDATE inventory_counts
    SET status = 'posted', posted_at = now(), posted_by = _user_id
    WHERE id = _count_id;
  END IF;
END;
$$;
