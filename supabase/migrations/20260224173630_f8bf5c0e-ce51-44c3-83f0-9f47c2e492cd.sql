
-- Add unit_price and line_value to delivery_note_items
ALTER TABLE public.delivery_note_items
  ADD COLUMN unit_price NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN line_value NUMERIC NOT NULL DEFAULT 0;

-- Update get_warehouse_stock to include delivery note values
CREATE OR REPLACE FUNCTION public.get_warehouse_stock(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  article_id uuid,
  article_code text,
  article_name text,
  unit text,
  total_in_qty numeric,
  total_in_value numeric,
  total_out_qty numeric,
  total_out_value numeric,
  balance_qty numeric,
  balance_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH movements AS (
    SELECT gri.article_id, gri.quantity AS in_qty, gri.quantity * gri.unit_price AS in_value, 0::NUMERIC AS out_qty, 0::NUMERIC AS out_value, gr.receipt_date AS movement_date
    FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    WHERE gr.company_id = p_company_id AND gr.warehouse_id = p_warehouse_id AND gr.status = 'posted' AND gri.article_id IS NOT NULL
    UNION ALL
    SELECT dni.article_id, 0::NUMERIC, 0::NUMERIC, dni.quantity, dni.line_value, dn.delivery_date
    FROM delivery_note_items dni JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    WHERE dn.company_id = p_company_id AND dn.warehouse_id = p_warehouse_id AND dn.status = 'posted'
    UNION ALL
    SELECT ici.article_id, ici.surplus_qty, ici.surplus_value, 0::NUMERIC, 0::NUMERIC, ic.count_date
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.surplus_qty > 0
    UNION ALL
    SELECT ici.article_id, 0::NUMERIC, 0::NUMERIC, ici.deficit_qty, ici.deficit_value, ic.count_date
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.deficit_qty > 0
    UNION ALL
    SELECT pai.article_id, 0::NUMERIC, CASE WHEN pai.value_difference > 0 THEN pai.value_difference ELSE 0::NUMERIC END, 0::NUMERIC, CASE WHEN pai.value_difference < 0 THEN ABS(pai.value_difference) ELSE 0::NUMERIC END, pa.adjustment_date
    FROM price_adjustment_items pai JOIN price_adjustments pa ON pa.id = pai.price_adjustment_id
    WHERE pa.company_id = p_company_id AND pa.warehouse_id = p_warehouse_id AND pa.status = 'posted'
    UNION ALL
    SELECT iti.article_id, -iti.quantity, -(iti.quantity * iti.unit_price), 0::NUMERIC, 0::NUMERIC, iwt.transfer_date
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.source_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    SELECT iti.article_id, iti.quantity, iti.quantity * iti.unit_price, 0::NUMERIC, 0::NUMERIC, iwt.transfer_date
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.destination_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    SELECT asw.article_1_id, -asw.quantity_1, -asw.swap_value, 0::NUMERIC, 0::NUMERIC, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    SELECT asw.article_2_id, asw.quantity_2, asw.swap_value, 0::NUMERIC, 0::NUMERIC, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    SELECT pdni.article_id, pdni.delivered_kg, pdni.item_value, 0::NUMERIC, 0::NUMERIC, pdn.delivery_date
    FROM production_delivery_note_items pdni JOIN production_delivery_notes pdn ON pdn.id = pdni.delivery_note_id
    WHERE pdn.company_id = p_company_id AND pdn.warehouse_id = p_warehouse_id AND pdn.status = 'posted'
    UNION ALL
    SELECT rdni.article_id, rdni.delivered_kg, rdni.item_value, 0::NUMERIC, 0::NUMERIC, rdn.delivery_date::DATE
    FROM reprocessing_delivery_note_items rdni JOIN reprocessing_delivery_notes rdn ON rdn.id = rdni.delivery_note_id
    WHERE rdn.company_id = p_company_id AND rdn.warehouse_id = p_warehouse_id AND rdn.status = 'posted'
    UNION ALL
    SELECT rwi.article_id, -rwi.quantity, -rwi.item_value, 0::NUMERIC, 0::NUMERIC, rwo.order_date::DATE
    FROM reprocessing_wo_input_items rwi JOIN reprocessing_work_orders rwo ON rwo.id = rwi.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed'
      AND COALESCE(rwi.warehouse_id, rwo.warehouse_id) = p_warehouse_id
    UNION ALL
    SELECT rwm.article_id, 0::NUMERIC, 0::NUMERIC, rwm.quantity, rwm.item_value, rwo.order_date::DATE
    FROM reprocessing_wo_materials rwm JOIN reprocessing_work_orders rwo ON rwo.id = rwm.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed'
      AND COALESCE(rwm.warehouse_id, rwo.warehouse_id) = p_warehouse_id
  )
  SELECT a.id, a.code, a.name, a.unit,
    COALESCE(SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN m.in_qty ELSE 0 END), 0) AS total_in_qty,
    COALESCE(SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN m.in_value ELSE 0 END), 0) AS total_in_value,
    COALESCE(SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN m.out_qty ELSE 0 END), 0) AS total_out_qty,
    COALESCE(SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN m.out_value ELSE 0 END), 0) AS total_out_value,
    COALESCE(SUM(m.in_qty - m.out_qty), 0) AS balance_qty,
    COALESCE(SUM(m.in_value - m.out_value), 0) AS balance_value
  FROM movements m
  JOIN articles a ON a.id = m.article_id
  GROUP BY a.id, a.code, a.name, a.unit
  HAVING COALESCE(SUM(m.in_qty - m.out_qty), 0) != 0
    OR COALESCE(SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN m.in_qty ELSE 0 END), 0) != 0
    OR COALESCE(SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN m.out_qty ELSE 0 END), 0) != 0
  ORDER BY a.code;
END;
$$;

-- Create post_delivery_note function
CREATE OR REPLACE FUNCTION public.post_delivery_note(
  _delivery_note_id uuid,
  _user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_item RECORD;
  v_stock RECORD;
  v_unit_price NUMERIC;
BEGIN
  -- Get delivery note
  SELECT * INTO v_dn FROM delivery_notes WHERE id = _delivery_note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Otpremnica nije pronađena'; END IF;
  IF v_dn.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;
  IF v_dn.warehouse_id IS NULL THEN RAISE EXCEPTION 'Otpremnica nema definisan magacin'; END IF;

  -- Check items exist
  IF NOT EXISTS (SELECT 1 FROM delivery_note_items WHERE delivery_note_id = _delivery_note_id) THEN
    RAISE EXCEPTION 'Otpremnica nema stavki';
  END IF;

  -- Get current warehouse stock for price calculation
  -- We need balance_value / balance_qty for each article to get the weighted average price
  FOR v_item IN
    SELECT dni.id AS item_id, dni.article_id, dni.quantity
    FROM delivery_note_items dni
    WHERE dni.delivery_note_id = _delivery_note_id
  LOOP
    -- Get current stock for this article in this warehouse
    SELECT ws.balance_qty, ws.balance_value
    INTO v_stock
    FROM get_warehouse_stock(v_dn.company_id, v_dn.warehouse_id) ws
    WHERE ws.article_id = v_item.article_id;

    IF NOT FOUND OR COALESCE(v_stock.balance_qty, 0) <= 0 THEN
      RAISE EXCEPTION 'Artikal nema zalihe u magacinu (article_id: %)', v_item.article_id;
    END IF;

    IF v_stock.balance_qty < v_item.quantity THEN
      RAISE EXCEPTION 'Nedovoljna zaliha za artikal (potrebno: %, dostupno: %)', v_item.quantity, v_stock.balance_qty;
    END IF;

    -- Calculate weighted average price
    v_unit_price := ROUND(v_stock.balance_value / v_stock.balance_qty, 6);

    -- Update delivery note item with price and value
    UPDATE delivery_note_items
    SET unit_price = v_unit_price,
        line_value = ROUND(v_item.quantity * v_unit_price, 2)
    WHERE id = v_item.item_id;

    -- Update global article stock
    UPDATE articles
    SET stock = COALESCE(stock, 0) - v_item.quantity,
        updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  -- Update delivery note status
  UPDATE delivery_notes
  SET status = 'posted',
      posted_at = now(),
      posted_by = _user_id,
      updated_at = now()
  WHERE id = _delivery_note_id;

  RETURN _delivery_note_id;
END;
$$;

-- Create unpost_delivery_note function
CREATE OR REPLACE FUNCTION public.unpost_delivery_note(
  _delivery_note_id uuid,
  _user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_item RECORD;
BEGIN
  SELECT * INTO v_dn FROM delivery_notes WHERE id = _delivery_note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Otpremnica nije pronađena'; END IF;
  IF v_dn.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjižene otpremnice mogu biti vraćene u nacrt'; END IF;
  IF v_dn.invoice_id IS NOT NULL THEN RAISE EXCEPTION 'Otpremnica je fakturisana i ne može biti vraćena u nacrt'; END IF;

  -- Restore stock for each item
  FOR v_item IN
    SELECT article_id, quantity
    FROM delivery_note_items
    WHERE delivery_note_id = _delivery_note_id
  LOOP
    UPDATE articles
    SET stock = COALESCE(stock, 0) + v_item.quantity,
        updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  -- Reset prices on items
  UPDATE delivery_note_items
  SET unit_price = 0, line_value = 0
  WHERE delivery_note_id = _delivery_note_id;

  -- Revert status
  UPDATE delivery_notes
  SET status = 'draft',
      posted_at = NULL,
      posted_by = NULL,
      updated_at = now()
  WHERE id = _delivery_note_id;

  RETURN _delivery_note_id;
END;
$$;
