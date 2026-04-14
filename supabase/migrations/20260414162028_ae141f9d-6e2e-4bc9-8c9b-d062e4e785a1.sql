
CREATE OR REPLACE FUNCTION public.validate_delivery_note_stock(
  _delivery_note_id UUID
)
RETURNS TABLE(
  article_id UUID,
  variant_id UUID,
  item_code TEXT,
  item_name TEXT,
  variant_code TEXT,
  requested_qty NUMERIC,
  min_balance_qty NUMERIC,
  min_balance_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warehouse_id UUID;
  v_company_id UUID;
  v_delivery_date DATE;
  v_dn_id UUID := _delivery_note_id;
BEGIN
  -- Get delivery note info
  SELECT dn.warehouse_id, dn.company_id, dn.delivery_date::DATE
  INTO v_warehouse_id, v_company_id, v_delivery_date
  FROM delivery_notes dn
  WHERE dn.id = v_dn_id;

  IF v_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Otpremnica nema definisan magacin';
  END IF;

  RETURN QUERY
  WITH dn_items AS (
    SELECT dni.article_id, dni.variant_id, dni.item_code, dni.item_name, dni.quantity
    FROM delivery_note_items dni
    WHERE dni.delivery_note_id = v_dn_id
  ),
  -- Get all movements for relevant articles in this warehouse
  all_movements AS (
    -- Goods receipts (in)
    SELECT gri.article_id, NULL::UUID AS variant_id, gr.receipt_date AS movement_date, gri.quantity AS in_qty, 0::NUMERIC AS out_qty
    FROM goods_receipt_items gri
    JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    WHERE gr.warehouse_id = v_warehouse_id AND gr.company_id = v_company_id AND gr.status = 'posted'
    AND gri.article_id IN (SELECT di.article_id FROM dn_items di)

    UNION ALL
    -- Delivery notes (out) - exclude the current one being validated
    SELECT dni2.article_id, dni2.variant_id, dn2.delivery_date AS movement_date, 0::NUMERIC, dni2.quantity
    FROM delivery_note_items dni2
    JOIN delivery_notes dn2 ON dn2.id = dni2.delivery_note_id
    WHERE dn2.warehouse_id = v_warehouse_id AND dn2.company_id = v_company_id AND dn2.status = 'posted'
    AND dn2.id != v_dn_id
    AND dni2.article_id IN (SELECT di.article_id FROM dn_items di)

    UNION ALL
    -- Calculations (in)
    SELECT ci.article_id, NULL::UUID, ppc.calculation_date, ci.quantity, 0::NUMERIC
    FROM calculation_items ci
    JOIN purchase_price_calculations ppc ON ppc.id = ci.calculation_id
    WHERE ppc.warehouse_id = v_warehouse_id AND ppc.company_id = v_company_id AND ppc.status = 'posted'
    AND ci.article_id IN (SELECT di.article_id FROM dn_items di)

    UNION ALL
    -- Inter-warehouse transfers OUT
    SELECT iwti.article_id, iwti.variant_id, iwt.transfer_date, 0::NUMERIC, iwti.quantity
    FROM inter_warehouse_transfer_items iwti
    JOIN inter_warehouse_transfers iwt ON iwt.id = iwti.transfer_id
    WHERE iwt.from_warehouse_id = v_warehouse_id AND iwt.company_id = v_company_id AND iwt.status = 'posted'
    AND iwti.article_id IN (SELECT di.article_id FROM dn_items di)

    UNION ALL
    -- Inter-warehouse transfers IN
    SELECT iwti.article_id, iwti.variant_id, iwt.transfer_date, iwti.quantity, 0::NUMERIC
    FROM inter_warehouse_transfer_items iwti
    JOIN inter_warehouse_transfers iwt ON iwt.id = iwti.transfer_id
    WHERE iwt.to_warehouse_id = v_warehouse_id AND iwt.company_id = v_company_id AND iwt.status = 'posted'
    AND iwti.article_id IN (SELECT di.article_id FROM dn_items di)

    UNION ALL
    -- Production delivery notes (in)
    SELECT pdni.article_id, pdni.variant_id, pdn.delivery_date, pdni.qty_total, 0::NUMERIC
    FROM production_delivery_note_items pdni
    JOIN production_delivery_notes pdn ON pdn.id = pdni.delivery_note_id
    WHERE pdn.warehouse_id = v_warehouse_id AND pdn.company_id = v_company_id AND pdn.status = 'posted'
    AND pdni.article_id IN (SELECT di.article_id FROM dn_items di)

    UNION ALL
    -- Reprocessing delivery notes (in)
    SELECT rdni.article_id, rdni.variant_id, rdn.delivery_date, rdni.qty_total, 0::NUMERIC
    FROM reprocessing_delivery_note_items rdni
    JOIN reprocessing_delivery_notes rdn ON rdn.id = rdni.delivery_note_id
    WHERE rdn.warehouse_id = v_warehouse_id AND rdn.company_id = v_company_id AND rdn.status = 'posted'
    AND rdni.article_id IN (SELECT di.article_id FROM dn_items di)

    UNION ALL
    -- Inventory counts adjustments (in/out)
    SELECT ici.article_id, ici.variant_id, ic.count_date,
      CASE WHEN ici.difference_qty > 0 THEN ici.difference_qty ELSE 0::NUMERIC END,
      CASE WHEN ici.difference_qty < 0 THEN ABS(ici.difference_qty) ELSE 0::NUMERIC END
    FROM inventory_count_items ici
    JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.warehouse_id = v_warehouse_id AND ic.company_id = v_company_id AND ic.status = 'posted'
    AND ici.article_id IN (SELECT di.article_id FROM dn_items di)

    UNION ALL
    -- Work order requisitions (out)
    SELECT imi.article_id, imi.variant_id, im.issue_date, 0::NUMERIC, imi.quantity
    FROM issued_material_items imi
    JOIN issued_materials im ON im.id = imi.issued_material_id
    WHERE im.warehouse_id = v_warehouse_id AND im.company_id = v_company_id AND im.status = 'posted'
    AND imi.article_id IN (SELECT di.article_id FROM dn_items di)

    UNION ALL
    -- The current delivery note items (out) - to include in simulation
    SELECT di.article_id, di.variant_id, v_delivery_date, 0::NUMERIC, di.quantity
    FROM dn_items di
  ),
  -- ARTICLE-LEVEL check: compute running balance by date
  article_daily AS (
    SELECT m.article_id, m.movement_date,
      SUM(m.in_qty) - SUM(m.out_qty) AS net_qty
    FROM all_movements m
    GROUP BY m.article_id, m.movement_date
  ),
  article_running AS (
    SELECT ad.article_id, ad.movement_date,
      SUM(ad.net_qty) OVER (PARTITION BY ad.article_id ORDER BY ad.movement_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
    FROM article_daily ad
  ),
  article_violations AS (
    SELECT ar.article_id,
      MIN(ar.running_balance) AS min_balance,
      MIN(ar.movement_date) FILTER (WHERE ar.running_balance < 0 AND ar.movement_date >= v_delivery_date) AS violation_date
    FROM article_running ar
    WHERE ar.movement_date >= v_delivery_date
    GROUP BY ar.article_id
    HAVING MIN(ar.running_balance) < 0
  ),
  -- VARIANT-LEVEL check: for items that have variant_id
  variant_daily AS (
    SELECT m.article_id, m.variant_id, m.movement_date,
      SUM(m.in_qty) - SUM(m.out_qty) AS net_qty
    FROM all_movements m
    WHERE m.variant_id IS NOT NULL
    GROUP BY m.article_id, m.variant_id, m.movement_date
  ),
  variant_running AS (
    SELECT vd.article_id, vd.variant_id, vd.movement_date,
      SUM(vd.net_qty) OVER (PARTITION BY vd.article_id, vd.variant_id ORDER BY vd.movement_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
    FROM variant_daily vd
  ),
  variant_violations AS (
    SELECT vr.article_id, vr.variant_id,
      MIN(vr.running_balance) AS min_balance,
      MIN(vr.movement_date) FILTER (WHERE vr.running_balance < 0 AND vr.movement_date >= v_delivery_date) AS violation_date
    FROM variant_running vr
    WHERE vr.movement_date >= v_delivery_date
    GROUP BY vr.article_id, vr.variant_id
    HAVING MIN(vr.running_balance) < 0
  )
  -- Return article-level violations
  SELECT di.article_id, NULL::UUID AS variant_id, di.item_code, di.item_name,
    ''::TEXT AS variant_code, di.quantity, av.min_balance, av.violation_date
  FROM dn_items di
  JOIN article_violations av ON av.article_id = di.article_id
  
  UNION ALL
  
  -- Return variant-level violations
  SELECT di.article_id, di.variant_id, di.item_code, di.item_name,
    COALESCE(avr.code, '')::TEXT, di.quantity, vv.min_balance, vv.violation_date
  FROM dn_items di
  JOIN variant_violations vv ON vv.article_id = di.article_id AND vv.variant_id = di.variant_id
  LEFT JOIN article_variants avr ON avr.id = di.variant_id;
END;
$$;
