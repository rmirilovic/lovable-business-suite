
-- Fix: post_price_adjustment must update total_debit/total_credit on journal_entries
CREATE OR REPLACE FUNCTION public.post_price_adjustment(_adjustment_id UUID, _user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pa RECORD;
  v_item RECORD;
  v_je_id UUID;
  v_entry_number TEXT;
  v_total_increase NUMERIC := 0;
  v_total_decrease NUMERIC := 0;
  v_item_order INT := 0;
  v_warehouse_code TEXT;
  v_inventory_account TEXT;
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
BEGIN
  SELECT pa.*, w.code AS warehouse_code, w.inventory_account
  INTO v_pa
  FROM price_adjustments pa
  JOIN warehouses w ON w.id = pa.warehouse_id
  WHERE pa.id = _adjustment_id;

  IF v_pa.status != 'draft' THEN
    RAISE EXCEPTION 'Dokument nije u statusu nacrta';
  END IF;

  v_warehouse_code := v_pa.warehouse_code;
  v_inventory_account := COALESCE(v_pa.inventory_account, '1320');

  FOR v_item IN SELECT * FROM price_adjustment_items WHERE price_adjustment_id = _adjustment_id ORDER BY item_order
  LOOP
    IF v_item.value_difference > 0 THEN
      v_total_increase := v_total_increase + v_item.value_difference;
    ELSE
      v_total_decrease := v_total_decrease + ABS(v_item.value_difference);
    END IF;
  END LOOP;

  v_entry_number := 'NIV' || v_pa.adjustment_number;

  -- Calculate totals for journal entry header
  v_total_debit := v_total_increase + v_total_decrease;
  v_total_credit := v_total_increase + v_total_decrease;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    description, source_type, source_id, status, created_by,
    total_debit, total_credit, posted_at, posted_by
  )
  VALUES (
    v_pa.company_id, v_pa.business_year_id, v_entry_number, v_pa.adjustment_date, v_pa.adjustment_date,
    'Nivelacija cena ' || v_pa.adjustment_number, 'price_adjustment', _adjustment_id, 'posted', _user_id,
    v_total_debit, v_total_credit, now(), _user_id
  )
  RETURNING id INTO v_je_id;

  IF v_total_increase > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_pa.company_id, v_inventory_account, v_item_order,
      'Povećanje cena - nivelacija ' || v_pa.adjustment_number,
      v_total_increase, 0, v_warehouse_code, v_pa.adjustment_date
    );

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_pa.company_id, '6140', v_item_order,
      'Prihod od usklađivanja cena - nivelacija ' || v_pa.adjustment_number,
      0, v_total_increase, v_warehouse_code, v_pa.adjustment_date
    );
  END IF;

  IF v_total_decrease > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_pa.company_id, '5140', v_item_order,
      'Rashod od usklađivanja cena - nivelacija ' || v_pa.adjustment_number,
      v_total_decrease, 0, v_warehouse_code, v_pa.adjustment_date
    );

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_pa.company_id, v_inventory_account, v_item_order,
      'Smanjenje cena - nivelacija ' || v_pa.adjustment_number,
      0, v_total_decrease, v_warehouse_code, v_pa.adjustment_date
    );
  END IF;

  FOR v_item IN SELECT * FROM price_adjustment_items WHERE price_adjustment_id = _adjustment_id
  LOOP
    UPDATE articles SET selling_price = v_item.new_price WHERE id = v_item.article_id;
  END LOOP;

  UPDATE price_adjustments SET
    status = 'posted',
    posted_at = now(),
    posted_by = _user_id,
    journal_entry_id = v_je_id,
    total_increase = v_total_increase,
    total_decrease = v_total_decrease
  WHERE id = _adjustment_id;
END;
$$;

-- Fix existing NIV entry with 0 totals
UPDATE journal_entries
SET total_debit = (SELECT COALESCE(SUM(debit_amount), 0) FROM journal_entry_items WHERE journal_entry_id = journal_entries.id),
    total_credit = (SELECT COALESCE(SUM(credit_amount), 0) FROM journal_entry_items WHERE journal_entry_id = journal_entries.id)
WHERE entry_number LIKE 'NIV%' AND total_debit = 0 AND total_credit = 0;
