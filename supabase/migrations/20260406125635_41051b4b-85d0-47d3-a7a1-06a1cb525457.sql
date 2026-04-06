
CREATE OR REPLACE FUNCTION public.post_purchase_price_calculation(_calculation_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calc purchase_price_calculations%ROWTYPE;
  v_receipt goods_receipts%ROWTYPE;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_item_order int := 0;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_inventory_account text;
  v_ruc_account text := '1329';
  v_cost RECORD;
  v_calc_item RECORD;
  v_total_additional_costs numeric := 0;
  v_total_markup numeric := 0;
  v_warehouse_code text;
  v_total_material_cost_value numeric := 0;
  v_credit_account text;
BEGIN
  -- Get calculation
  SELECT * INTO v_calc FROM purchase_price_calculations WHERE id = _calculation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kalkulacija nije pronađena'; END IF;
  IF v_calc.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;

  -- Get goods receipt
  SELECT * INTO v_receipt FROM goods_receipts WHERE id = v_calc.goods_receipt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prijemnica nije pronađena'; END IF;

  -- Get warehouse inventory account and code
  SELECT COALESCE(inventory_account, '1320'), code INTO v_inventory_account, v_warehouse_code
  FROM warehouses WHERE id = v_receipt.warehouse_id;

  -- Calculate totals
  SELECT COALESCE(SUM(amount), 0) INTO v_total_additional_costs
  FROM calculation_additional_costs WHERE calculation_id = _calculation_id;

  SELECT COALESCE(SUM(markup_amount * quantity), 0) INTO v_total_markup
  FROM calculation_items WHERE calculation_id = _calculation_id
  AND svk = '1';

  -- Calculate total cost_value for materials (SVK=2,6)
  SELECT COALESCE(SUM(cost_value), 0) INTO v_total_material_cost_value
  FROM calculation_items WHERE calculation_id = _calculation_id
  AND svk IN ('2', '6');

  -- Only create journal entry if there are costs, markup, or material cost value
  IF v_total_additional_costs > 0 OR v_total_markup > 0 OR v_total_material_cost_value > 0 THEN
    v_entry_number := 'KAL' || v_calc.calculation_number;

    INSERT INTO journal_entries (
      company_id, business_year_id, entry_number, entry_date,
      document_date, document_number, description, status,
      created_by, source_document_type, source_document_id
    ) VALUES (
      v_calc.company_id, v_calc.business_year_id, v_entry_number,
      v_calc.calculation_date, v_calc.calculation_date,
      v_calc.calculation_number,
      'Kalkulacija ' || v_calc.calculation_number,
      'posted', _user_id, 'purchase_price_calculation', _calculation_id
    ) RETURNING id INTO v_journal_entry_id;

    -- === Additional costs entries (ZTN) ===
    -- Debit: warehouse inventory account (zbirno) with warehouse analytics
    -- Credit: the account where UFU originally debited this cost (from input_costs.account_code)
    --         with warehouse analytics (NOT supplier account)
    IF v_total_additional_costs > 0 THEN
      -- Single debit entry for total ZTN on inventory account
      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, document_date, cost_center_code
      ) VALUES (
        v_journal_entry_id, v_calc.company_id, v_inventory_account, v_item_order,
        'Zavisni troškovi nabavke',
        v_total_additional_costs, 0, v_calc.calculation_date, v_warehouse_code
      );
      v_total_debit := v_total_debit + v_total_additional_costs;

      -- Credit entries per cost item - on the account from input_costs (where UFU debited)
      FOR v_cost IN
        SELECT cac.*,
               ic.account_code as ufu_debit_account
        FROM calculation_additional_costs cac
        LEFT JOIN service_purchase_invoice_items spii ON spii.id = cac.source_ufu_item_id
        LEFT JOIN input_costs ic ON ic.id = spii.input_cost_id
        WHERE cac.calculation_id = _calculation_id
        ORDER BY cac.item_order
      LOOP
        -- Determine credit account: use the account from input_costs (where UFU booked debit)
        -- Fall back to a default if somehow not linked
        v_credit_account := COALESCE(v_cost.ufu_debit_account, '4350');

        v_item_order := v_item_order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order, description,
          debit_amount, credit_amount, document_date, cost_center_code
        ) VALUES (
          v_journal_entry_id, v_calc.company_id, v_credit_account, v_item_order,
          'ZTN: ' || v_cost.description,
          0, ROUND(v_cost.amount::numeric, 2), v_calc.calculation_date, v_warehouse_code
        );
        v_total_credit := v_total_credit + v_cost.amount;
      END LOOP;
    END IF;

    -- Book markup (RUC) for goods (SVK=1) with warehouse analytics
    IF v_total_markup > 0 THEN
      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, document_date, cost_center_code
      ) VALUES (
        v_journal_entry_id, v_calc.company_id, v_inventory_account, v_item_order,
        'Ukalkulisana razlika u ceni',
        v_total_markup, 0, v_calc.calculation_date, v_warehouse_code
      );
      v_total_debit := v_total_debit + v_total_markup;

      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, document_date, cost_center_code
      ) VALUES (
        v_journal_entry_id, v_calc.company_id, v_ruc_account, v_item_order,
        'Razlika u ceni robe',
        0, v_total_markup, v_calc.calculation_date, v_warehouse_code
      );
      v_total_credit := v_total_credit + v_total_markup;
    END IF;

    -- Book material (repromaterijal) cost value on accounts 9100/9010
    IF v_total_material_cost_value > 0 THEN
      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, document_date, cost_center_code
      ) VALUES (
        v_journal_entry_id, v_calc.company_id, '9100', v_item_order,
        'Nabavna vrednost repromaterijala',
        v_total_material_cost_value, 0, v_calc.calculation_date, v_warehouse_code
      );
      v_total_debit := v_total_debit + v_total_material_cost_value;

      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, document_date, cost_center_code
      ) VALUES (
        v_journal_entry_id, v_calc.company_id, '9010', v_item_order,
        'Nabavna vrednost repromaterijala',
        0, v_total_material_cost_value, v_calc.calculation_date, v_warehouse_code
      );
      v_total_credit := v_total_credit + v_total_material_cost_value;
    END IF;

    UPDATE journal_entries
    SET total_debit = v_total_debit, total_credit = v_total_credit,
        posted_at = now(), posted_by = _user_id
    WHERE id = v_journal_entry_id;
  END IF;

  -- Update article selling prices for SVK=1 items
  FOR v_calc_item IN
    SELECT ci.article_id, ci.selling_price
    FROM calculation_items ci
    WHERE ci.calculation_id = _calculation_id
      AND ci.svk = '1'
      AND ci.article_id IS NOT NULL
      AND ci.selling_price > 0
  LOOP
    UPDATE articles
    SET selling_price = v_calc_item.selling_price,
        updated_at = now()
    WHERE id = v_calc_item.article_id;
  END LOOP;

  -- Update goods receipt item prices based on SVK
  FOR v_calc_item IN
    SELECT ci.goods_receipt_item_id, ci.svk, ci.selling_price, ci.cost_price
    FROM calculation_items ci
    WHERE ci.calculation_id = _calculation_id
      AND ci.goods_receipt_item_id IS NOT NULL
  LOOP
    IF v_calc_item.svk = '1' THEN
      UPDATE goods_receipt_items
      SET unit_price = ROUND(v_calc_item.selling_price::numeric, 2)
      WHERE id = v_calc_item.goods_receipt_item_id;
    ELSIF v_calc_item.svk IN ('2', '6') THEN
      UPDATE goods_receipt_items
      SET unit_price = ROUND(v_calc_item.cost_price::numeric, 2)
      WHERE id = v_calc_item.goods_receipt_item_id;
    END IF;
  END LOOP;

  -- Mark calculation as posted
  UPDATE purchase_price_calculations
  SET status = 'posted',
      posted_by = _user_id,
      posted_at = now(),
      updated_at = now()
  WHERE id = _calculation_id;

  RETURN COALESCE(v_journal_entry_id, '00000000-0000-0000-0000-000000000000'::uuid);
END;
$$;
