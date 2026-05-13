CREATE OR REPLACE FUNCTION public.get_warehouse_stock_by_variant(
  p_company_id UUID,
  p_warehouse_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE(
  article_id UUID,
  article_code TEXT,
  article_name TEXT,
  unit TEXT,
  variant_id UUID,
  variant_code TEXT,
  variant_description TEXT,
  total_in_qty NUMERIC,
  total_in_value NUMERIC,
  total_out_qty NUMERIC,
  total_out_value NUMERIC,
  balance_qty NUMERIC,
  balance_value NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH movements AS (
    SELECT gri.article_id, gri.variant_id AS vid, gri.quantity AS in_qty, gri.quantity * gri.unit_price AS in_value, 0::NUMERIC AS out_qty, 0::NUMERIC AS out_value, gr.receipt_date AS movement_date
    FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    WHERE gr.company_id = p_company_id AND gr.warehouse_id = p_warehouse_id AND gr.status = 'posted' AND gri.article_id IS NOT NULL
    UNION ALL
    SELECT dni.article_id, dni.variant_id, 0::NUMERIC, 0::NUMERIC, dni.quantity, dni.line_value, dn.delivery_date
    FROM delivery_note_items dni JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    WHERE dn.company_id = p_company_id AND dn.warehouse_id = p_warehouse_id AND dn.status = 'posted'
    UNION ALL
    SELECT ici.article_id, ici.variant_id, ici.surplus_qty, ici.surplus_value, 0::NUMERIC, 0::NUMERIC, ic.count_date
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.surplus_qty > 0
    UNION ALL
    SELECT ici.article_id, ici.variant_id, 0::NUMERIC, 0::NUMERIC, ici.deficit_qty, ici.deficit_value, ic.count_date
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.deficit_qty > 0
    UNION ALL
    SELECT pai.article_id, pai.variant_id, 0::NUMERIC,
      CASE WHEN pai.value_difference > 0 THEN pai.value_difference ELSE 0::NUMERIC END,
      0::NUMERIC,
      CASE WHEN pai.value_difference < 0 THEN ABS(pai.value_difference) ELSE 0::NUMERIC END,
      pa.adjustment_date
    FROM price_adjustment_items pai JOIN price_adjustments pa ON pa.id = pai.price_adjustment_id
    WHERE pa.company_id = p_company_id AND pa.warehouse_id = p_warehouse_id AND pa.status = 'posted'
    UNION ALL
    SELECT iti.article_id, iti.variant_id, -iti.quantity, -(iti.quantity * iti.unit_price), 0::NUMERIC, 0::NUMERIC, iwt.transfer_date
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.source_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    SELECT iti.article_id, iti.variant_id, iti.quantity, iti.quantity * iti.unit_price, 0::NUMERIC, 0::NUMERIC, iwt.transfer_date
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.destination_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    SELECT asw.article_1_id, NULL::UUID, -asw.quantity_1, -asw.swap_value, 0::NUMERIC, 0::NUMERIC, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    SELECT asw.article_2_id, NULL::UUID, asw.quantity_2, asw.swap_value, 0::NUMERIC, 0::NUMERIC, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    SELECT pdni.article_id, pdni.variant_id, pdni.qty_total, pdni.item_value, 0::NUMERIC, 0::NUMERIC, pdn.delivery_date
    FROM production_delivery_note_items pdni JOIN production_delivery_notes pdn ON pdn.id = pdni.delivery_note_id
    WHERE pdn.company_id = p_company_id AND pdn.warehouse_id = p_warehouse_id AND pdn.status = 'posted'
    UNION ALL
    SELECT rdni.article_id, rdni.variant_id, rdni.qty_total, rdni.item_value, 0::NUMERIC, 0::NUMERIC, rdn.delivery_date::DATE
    FROM reprocessing_delivery_note_items rdni JOIN reprocessing_delivery_notes rdn ON rdn.id = rdni.delivery_note_id
    WHERE rdn.company_id = p_company_id AND rdn.warehouse_id = p_warehouse_id AND rdn.status = 'posted'
    UNION ALL
    SELECT rwi.article_id, rwi.variant_id, -rwi.quantity, -rwi.item_value, 0::NUMERIC, 0::NUMERIC, rwo.order_date::DATE
    FROM reprocessing_wo_input_items rwi JOIN reprocessing_work_orders rwo ON rwo.id = rwi.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed' AND COALESCE(rwi.warehouse_id, rwo.warehouse_id) = p_warehouse_id
    UNION ALL
    SELECT rwm.article_id, rwm.variant_id, 0::NUMERIC, 0::NUMERIC, rwm.quantity, rwm.item_value, rwo.order_date::DATE
    FROM reprocessing_wo_materials rwm JOIN reprocessing_work_orders rwo ON rwo.id = rwm.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed' AND COALESCE(rwm.warehouse_id, rwo.warehouse_id) = p_warehouse_id
    UNION ALL
    SELECT mri.article_id, mri.variant_id, 0::NUMERIC, 0::NUMERIC, mri.quantity, mri.quantity * mri.unit_price, mr.requisition_date
    FROM material_requisition_items mri JOIN material_requisitions mr ON mr.id = mri.requisition_id
    WHERE mr.company_id = p_company_id AND mr.status = 'posted' AND mr.warehouse_id = p_warehouse_id
    UNION ALL
    SELECT vs.article_id, vs.source_variant_id, -vs.quantity, -COALESCE(vs.swap_value, 0), 0::NUMERIC, 0::NUMERIC, vs.swap_date
    FROM variant_swaps vs
    WHERE vs.company_id = p_company_id AND vs.warehouse_id = p_warehouse_id AND vs.status = 'posted'
    UNION ALL
    SELECT vs.article_id, vs.target_variant_id, vs.quantity, COALESCE(vs.swap_value, 0), 0::NUMERIC, 0::NUMERIC, vs.swap_date
    FROM variant_swaps vs
    WHERE vs.company_id = p_company_id AND vs.warehouse_id = p_warehouse_id AND vs.status = 'posted'
  ),
  aggregated AS (
    SELECT m.article_id, m.vid,
      SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN m.in_qty ELSE 0 END) AS v_total_in_qty,
      SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN m.in_value ELSE 0 END) AS v_total_in_value,
      SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN m.out_qty ELSE 0 END) AS v_total_out_qty,
      SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN m.out_value ELSE 0 END) AS v_total_out_value,
      SUM(m.in_qty) - SUM(m.out_qty) AS v_balance_qty,
      SUM(m.in_value) - SUM(m.out_value) AS v_balance_value
    FROM movements m
    WHERE p_date_to IS NULL OR m.movement_date <= p_date_to
    GROUP BY m.article_id, m.vid
  )
  SELECT a.id, a.code, a.name, a.unit,
    agg.vid, COALESCE(av.code, '')::TEXT, COALESCE(av.description, '')::TEXT,
    agg.v_total_in_qty, agg.v_total_in_value,
    agg.v_total_out_qty, agg.v_total_out_value,
    agg.v_balance_qty, agg.v_balance_value
  FROM aggregated agg
  JOIN articles a ON a.id = agg.article_id
  LEFT JOIN article_variants av ON av.id = agg.vid
  ORDER BY a.code, COALESCE(av.code, '');
END;
$$;