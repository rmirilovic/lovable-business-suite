
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
  v_supplier_account text;
  v_partner RECORD;
  v_total_additional_costs numeric := 0;
  v_total_markup numeric := 0;
BEGIN
  -- Get calculation
  SELECT * INTO v_calc FROM purchase_price_calculations WHERE id = _calculation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kalkulacija nije pronađena'; END IF;
  IF v_calc.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;

  -- Get goods receipt
  SELECT * INTO v_receipt FROM goods_receipts WHERE id = v_calc.goods_receipt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prijemnica nije pronađena'; END IF;

  -- Get warehouse inventory account
  SELECT COALESCE(inventory_account, '1320') INTO v_inventory_account
  FROM warehouses WHERE id = v_receipt.warehouse_id;

  -- Calculate totals
  SELECT COALESCE(SUM(amount), 0) INTO v_total_additional_costs
  FROM calculation_additional_costs WHERE calculation_id = _calculation_id;

  SELECT COALESCE(SUM(markup_amount * quantity), 0) INTO v_total_markup
  FROM calculation_items WHERE calculation_id = _calculation_id
  AND svk = '1';

  -- Only create journal entry if there are costs or markup
  IF v_total_additional_costs > 0 OR v_total_markup > 0 THEN
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

    -- Book each additional cost separately (per partner)
    FOR v_cost IN
      SELECT * FROM calculation_additional_costs
      WHERE calculation_id = _calculation_id
      ORDER BY item_order
    LOOP
      v_supplier_account := '4350';
      IF v_cost.partner_id IS NOT NULL THEN
        SELECT * INTO v_partner FROM partners WHERE id = v_cost.partner_id;
        IF FOUND AND v_partner.legal_status = 4 THEN
          v_supplier_account := '4360';
        END IF;
      END IF;

      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, document_date
      ) VALUES (
        v_journal_entry_id, v_calc.company_id, v_inventory_account, v_item_order,
        'Zavisni trošak: ' || v_cost.description,
        v_cost.amount, 0, v_calc.calculation_date
      );
      v_total_debit := v_total_debit + v_cost.amount;

      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, partner_id, document_date
      ) VALUES (
        v_journal_entry_id, v_calc.company_id, v_supplier_account, v_item_order,
        'Obaveza: ' || v_cost.description,
        0, v_cost.amount, v_cost.partner_id, v_calc.calculation_date
      );
      v_total_credit := v_total_credit + v_cost.amount;
    END LOOP;

    -- Book markup (RUC) for goods (SVK=1)
    IF v_total_markup > 0 THEN
      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, document_date
      ) VALUES (
        v_journal_entry_id, v_calc.company_id, v_inventory_account, v_item_order,
        'Ukalkulisana razlika u ceni',
        v_total_markup, 0, v_calc.calculation_date
      );
      v_total_debit := v_total_debit + v_total_markup;

      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, document_date
      ) VALUES (
        v_journal_entry_id, v_calc.company_id, v_ruc_account, v_item_order,
        'Razlika u ceni robe',
        0, v_total_markup, v_calc.calculation_date
      );
      v_total_credit := v_total_credit + v_total_markup;
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

  -- *** UPDATE GOODS RECEIPT ITEM PRICES BASED ON SVK ***
  -- SVK=1 (Roba): use selling_price (nabavna + zavisni troškovi + marža)
  -- SVK=2,6 (Repromaterijal, Rezervni delovi): use cost_price (nabavna + zavisni troškovi)
  FOR v_calc_item IN
    SELECT ci.goods_receipt_item_id, ci.svk, ci.selling_price, ci.cost_price
    FROM calculation_items ci
    WHERE ci.calculation_id = _calculation_id
      AND ci.goods_receipt_item_id IS NOT NULL
  LOOP
    IF v_calc_item.svk = '1' THEN
      -- Roba: magacin se vodi po prodajnoj ceni
      UPDATE goods_receipt_items
      SET unit_price = ROUND(v_calc_item.selling_price::numeric, 2)
      WHERE id = v_calc_item.goods_receipt_item_id;
    ELSIF v_calc_item.svk IN ('2', '6') THEN
      -- Repromaterijal / Rezervni delovi: magacin se vodi po ceni koštanja
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

-- Unpost function
CREATE OR REPLACE FUNCTION public.unpost_purchase_price_calculation(_calculation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calc RECORD;
  v_journal_entry_id uuid;
  v_calc_item RECORD;
  v_access_level text;
BEGIN
  SELECT * INTO v_calc FROM purchase_price_calculations WHERE id = _calculation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kalkulacija nije pronađena'; END IF;
  IF v_calc.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjižene kalkulacije mogu biti poništene'; END IF;

  v_access_level := get_user_access_level(_user_id, v_calc.company_id, 'magacin.kalkulacije', NULL);
  IF v_access_level != 'admin' THEN
    RAISE EXCEPTION 'Nemate admin dozvole za poništavanje knjiženja kalkulacije';
  END IF;

  -- Find and delete journal entry
  SELECT id INTO v_journal_entry_id
  FROM journal_entries
  WHERE source_document_type = 'purchase_price_calculation'
    AND source_document_id = _calculation_id;

  IF v_journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_journal_entry_id;
  END IF;

  -- Revert article selling prices
  FOR v_calc_item IN
    SELECT ci.article_id, a.purchase_price
    FROM calculation_items ci
    JOIN articles a ON a.id = ci.article_id
    WHERE ci.calculation_id = _calculation_id
      AND ci.svk = '1'
      AND ci.article_id IS NOT NULL
  LOOP
    UPDATE articles
    SET selling_price = COALESCE(v_calc_item.purchase_price, 0),
        updated_at = now()
    WHERE id = v_calc_item.article_id;
  END LOOP;

  -- *** REVERT GOODS RECEIPT ITEM PRICES TO ORIGINAL PURCHASE PRICE ***
  FOR v_calc_item IN
    SELECT ci.goods_receipt_item_id, ci.purchase_price
    FROM calculation_items ci
    WHERE ci.calculation_id = _calculation_id
      AND ci.goods_receipt_item_id IS NOT NULL
  LOOP
    UPDATE goods_receipt_items
    SET unit_price = ROUND(v_calc_item.purchase_price::numeric, 2)
    WHERE id = v_calc_item.goods_receipt_item_id;
  END LOOP;

  -- Reset calculation status
  UPDATE purchase_price_calculations
  SET status = 'draft',
      posted_by = NULL,
      posted_at = NULL,
      updated_at = now()
  WHERE id = _calculation_id;

  RETURN true;
END;
$$;
