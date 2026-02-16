
CREATE OR REPLACE FUNCTION public.post_purchase_price_calculation(_calculation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calc RECORD;
  v_receipt RECORD;
  v_warehouse RECORD;
  v_user_id uuid;
  v_journal_id uuid;
  v_entry_number text;
  v_total_ruc numeric := 0;
  v_total_additional_costs numeric := 0;
  v_total_purchase_value numeric := 0;
  v_cost_row RECORD;
  v_item_count int;
  v_max_item_order int;
  v_next_order int;
  v_year_prefix text;
  v_next_num int;
  v_business_year_id uuid;
  v_total_material_cost_value numeric := 0;
BEGIN
  SELECT * INTO v_calc FROM purchase_price_calculations WHERE id = _calculation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Calculation not found'; END IF;
  IF v_calc.status = 'posted' THEN RAISE EXCEPTION 'Already posted'; END IF;

  v_user_id := auth.uid();

  SELECT gr.*, w.code as warehouse_code, w.svk as warehouse_svk
  INTO v_receipt
  FROM goods_receipts gr
  JOIN warehouses w ON w.id = gr.warehouse_id
  WHERE gr.id = v_calc.goods_receipt_id;

  -- Calculate RUC only for SVK=1 items
  SELECT COALESCE(SUM(
    CASE WHEN ci.svk = '1' THEN (ci.markup_amount * ci.quantity) ELSE 0 END
  ), 0)
  INTO v_total_ruc
  FROM calculation_items ci WHERE ci.calculation_id = _calculation_id;

  -- Calculate total additional costs
  SELECT COALESCE(SUM(amount), 0) INTO v_total_additional_costs
  FROM calculation_additional_costs WHERE calculation_id = _calculation_id;

  -- Calculate total purchase value (from receipt items, for cost splitting)
  SELECT COALESCE(SUM(purchase_value), 0) INTO v_total_purchase_value
  FROM calculation_items WHERE calculation_id = _calculation_id;

  -- Calculate total cost_value for SVK=2 items only
  SELECT COALESCE(SUM(cost_value), 0) INTO v_total_material_cost_value
  FROM calculation_items WHERE calculation_id = _calculation_id AND svk = '2';

  -- Update selling_price for SVK=1 articles
  UPDATE articles a
  SET selling_price = ci.selling_price,
      updated_at = now()
  FROM calculation_items ci
  WHERE ci.calculation_id = _calculation_id
    AND ci.article_id = a.id
    AND ci.svk = '1';

  -- Update unit_price on goods_receipt_items based on SVK
  UPDATE goods_receipt_items gri
  SET unit_price = CASE
    WHEN ci.svk = '1' THEN ci.selling_price
    ELSE ci.cost_price
  END
  FROM calculation_items ci
  WHERE ci.calculation_id = _calculation_id
    AND ci.goods_receipt_item_id = gri.id;

  -- Only create journal entry if there's something to post
  IF v_total_ruc > 0 OR v_total_additional_costs > 0 OR v_total_material_cost_value > 0 THEN
    v_year_prefix := to_char(v_calc.calculation_date::date, 'YY');
    SELECT business_year_id INTO v_business_year_id FROM goods_receipts WHERE id = v_calc.goods_receipt_id;

    SELECT COALESCE(MAX(
      CASE WHEN je.entry_number ~ ('^KAL-' || v_year_prefix || '[0-9]+$')
      THEN CAST(SUBSTRING(je.entry_number FROM length('KAL-' || v_year_prefix) + 1) AS integer)
      ELSE 0 END
    ), 0) + 1
    INTO v_next_num
    FROM journal_entries je WHERE je.company_id = v_calc.company_id;

    v_entry_number := 'KAL-' || v_year_prefix || LPAD(v_next_num::text, 4, '0');

    INSERT INTO journal_entries (
      company_id, business_year_id, entry_number, entry_date,
      description, status, created_by, source_type, source_id
    ) VALUES (
      v_calc.company_id, v_business_year_id, v_entry_number, v_calc.calculation_date,
      'Kalkulacija ' || v_calc.calculation_number, 'posted', v_user_id,
      'calculation', _calculation_id
    ) RETURNING id INTO v_journal_id;

    v_next_order := 1;

    -- === SVK=1 RUC entries ===
    IF v_total_ruc > 0 THEN
      -- Debit 1329 (RUC)
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, item_order, account_code,
        debit_amount, credit_amount, description, cost_center_code,
        document_type, document_number
      ) VALUES (
        v_journal_id, v_calc.company_id, v_next_order, '1329',
        ROUND(v_total_ruc::numeric, 2), 0,
        'Ukalkulisana razlika u ceni',
        v_receipt.warehouse_code,
        'KAL', v_calc.calculation_number
      );
      v_next_order := v_next_order + 1;

      -- Credit 1329 offset (to balance via 1321)
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, item_order, account_code,
        debit_amount, credit_amount, description, cost_center_code,
        document_type, document_number
      ) VALUES (
        v_journal_id, v_calc.company_id, v_next_order, '1300',
        0, ROUND(v_total_ruc::numeric, 2),
        'Ukalkulisana razlika u ceni',
        v_receipt.warehouse_code,
        'KAL', v_calc.calculation_number
      );
      v_next_order := v_next_order + 1;
    END IF;

    -- === Additional costs entries (ZTN) ===
    FOR v_cost_row IN
      SELECT cac.*, p.name as partner_name, p.code as partner_code
      FROM calculation_additional_costs cac
      LEFT JOIN partners p ON p.id = cac.partner_id
      WHERE cac.calculation_id = _calculation_id
      ORDER BY cac.item_order
    LOOP
      -- Debit 1321 (warehouse stock) for cost amount
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, item_order, account_code,
        debit_amount, credit_amount, description, cost_center_code,
        document_type, document_number
      ) VALUES (
        v_journal_id, v_calc.company_id, v_next_order, '1321',
        ROUND(v_cost_row.amount::numeric, 2), 0,
        'ZTN: ' || v_cost_row.description,
        v_receipt.warehouse_code,
        'KAL', v_calc.calculation_number
      );
      v_next_order := v_next_order + 1;

      -- Credit supplier account for cost
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, item_order, account_code,
        debit_amount, credit_amount, description, cost_center_code,
        partner_code, partner_name,
        document_type, document_number
      ) VALUES (
        v_journal_id, v_calc.company_id, v_next_order,
        CASE WHEN EXISTS (
          SELECT 1 FROM partners WHERE id = v_cost_row.partner_id AND legal_status = '4'
        ) THEN '4360' ELSE '4350' END,
        0, ROUND(v_cost_row.amount::numeric, 2),
        'ZTN: ' || v_cost_row.description,
        NULL,
        v_cost_row.partner_code, v_cost_row.partner_name,
        'KAL', v_calc.calculation_number
      );
      v_next_order := v_next_order + 1;
    END LOOP;

    -- === SVK=2 material cost entries (9100/9010) ===
    IF v_total_material_cost_value > 0 THEN
      -- Debit 9100
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, item_order, account_code,
        debit_amount, credit_amount, description, cost_center_code,
        document_type, document_number
      ) VALUES (
        v_journal_id, v_calc.company_id, v_next_order, '9100',
        ROUND(v_total_material_cost_value::numeric, 2), 0,
        'Nabavna vrednost repromaterijala',
        v_receipt.warehouse_code,
        'KAL', v_calc.calculation_number
      );
      v_next_order := v_next_order + 1;

      -- Credit 9010
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, item_order, account_code,
        debit_amount, credit_amount, description, cost_center_code,
        document_type, document_number
      ) VALUES (
        v_journal_id, v_calc.company_id, v_next_order, '9010',
        0, ROUND(v_total_material_cost_value::numeric, 2),
        'Nabavna vrednost repromaterijala',
        v_receipt.warehouse_code,
        'KAL', v_calc.calculation_number
      );
      v_next_order := v_next_order + 1;
    END IF;

    UPDATE purchase_price_calculations
    SET journal_entry_id = v_journal_id
    WHERE id = _calculation_id;
  END IF;

  UPDATE purchase_price_calculations
  SET status = 'posted', posted_at = now(), posted_by = v_user_id
  WHERE id = _calculation_id;
END;
$$;
