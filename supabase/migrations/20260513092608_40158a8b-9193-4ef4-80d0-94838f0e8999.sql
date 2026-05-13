-- 1. Add price/value columns
ALTER TABLE public.variant_swaps
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS swap_value NUMERIC NOT NULL DEFAULT 0;

-- 2. RPC to post variant swap (computes WAC at swap_date for the article in warehouse)
CREATE OR REPLACE FUNCTION public.post_variant_swap(p_swap_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_warehouse_id UUID;
  v_article_id UUID;
  v_swap_date DATE;
  v_quantity NUMERIC;
  v_in_qty NUMERIC := 0;
  v_in_value NUMERIC := 0;
  v_unit_price NUMERIC := 0;
BEGIN
  SELECT company_id, warehouse_id, article_id, swap_date, quantity
    INTO v_company_id, v_warehouse_id, v_article_id, v_swap_date, v_quantity
  FROM public.variant_swaps WHERE id = p_swap_id FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Zamena varijante nije pronađena';
  END IF;

  -- Compute WAC across all article movements (any variant) up to and including swap_date
  WITH movements AS (
    SELECT gri.quantity AS in_qty, gri.quantity * gri.unit_price AS in_value
    FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    WHERE gr.company_id = v_company_id AND gr.warehouse_id = v_warehouse_id
      AND gri.article_id = v_article_id AND gr.status = 'posted'
      AND gr.receipt_date <= v_swap_date
    UNION ALL
    SELECT ici.surplus_qty, ici.surplus_value
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = v_company_id AND ic.warehouse_id = v_warehouse_id
      AND ici.article_id = v_article_id AND ic.status = 'posted'
      AND ici.surplus_qty > 0 AND ic.count_date <= v_swap_date
    UNION ALL
    SELECT iti.quantity, iti.quantity * iti.unit_price
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = v_company_id AND iwt.destination_warehouse_id = v_warehouse_id
      AND iti.article_id = v_article_id AND iwt.status = 'posted'
      AND iwt.transfer_date <= v_swap_date
    UNION ALL
    SELECT pdni.qty_total, pdni.item_value
    FROM production_delivery_note_items pdni JOIN production_delivery_notes pdn ON pdn.id = pdni.delivery_note_id
    WHERE pdn.company_id = v_company_id AND pdn.warehouse_id = v_warehouse_id
      AND pdni.article_id = v_article_id AND pdn.status = 'posted'
      AND pdn.delivery_date <= v_swap_date
    UNION ALL
    SELECT rdni.qty_total, rdni.item_value
    FROM reprocessing_delivery_note_items rdni JOIN reprocessing_delivery_notes rdn ON rdn.id = rdni.delivery_note_id
    WHERE rdn.company_id = v_company_id AND rdn.warehouse_id = v_warehouse_id
      AND rdni.article_id = v_article_id AND rdn.status = 'posted'
      AND rdn.delivery_date::DATE <= v_swap_date
    UNION ALL
    SELECT asw.quantity_2, asw.swap_value
    FROM article_swaps asw
    WHERE asw.company_id = v_company_id AND asw.warehouse_id = v_warehouse_id
      AND asw.article_2_id = v_article_id AND asw.status = 'posted'
      AND asw.swap_date <= v_swap_date
  )
  SELECT COALESCE(SUM(in_qty), 0), COALESCE(SUM(in_value), 0)
    INTO v_in_qty, v_in_value
  FROM movements;

  IF v_in_qty > 0 THEN
    v_unit_price := v_in_value / v_in_qty;
  END IF;

  UPDATE public.variant_swaps
    SET status = 'posted',
        unit_price = v_unit_price,
        swap_value = ROUND(v_quantity * v_unit_price, 2),
        posted_at = now(),
        posted_by = auth.uid()
  WHERE id = p_swap_id;
END;
$$;

-- 3. Update RPC: include values for variant swaps
DROP FUNCTION IF EXISTS public.get_warehouse_stock_by_variant(uuid,uuid,date,date);

CREATE OR REPLACE FUNCTION public.get_warehouse_stock_by_variant(
  p_company_id UUID, p_warehouse_id UUID, p_date_from DATE DEFAULT NULL, p_date_to DATE DEFAULT NULL
)
RETURNS TABLE(
  article_id UUID, article_code TEXT, article_name TEXT, unit TEXT,
  variant_id UUID, variant_code TEXT, variant_description TEXT,
  total_in_qty NUMERIC, total_in_value NUMERIC,
  total_out_qty NUMERIC, total_out_value NUMERIC,
  balance_qty NUMERIC, balance_value NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
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
    SELECT vs.article_id, vs.source_variant_id, 0::NUMERIC, 0::NUMERIC, vs.quantity, vs.swap_value, vs.swap_date
    FROM variant_swaps vs WHERE vs.company_id = p_company_id AND vs.warehouse_id = p_warehouse_id AND vs.status = 'posted'
    UNION ALL
    SELECT vs.article_id, vs.target_variant_id, vs.quantity, vs.swap_value, 0::NUMERIC, 0::NUMERIC, vs.swap_date
    FROM variant_swaps vs WHERE vs.company_id = p_company_id AND vs.warehouse_id = p_warehouse_id AND vs.status = 'posted'
  ),
  aggregated AS (
    SELECT m.article_id, m.vid,
      SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN GREATEST(m.in_qty, 0) ELSE 0 END) AS v_total_in_qty,
      SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN GREATEST(m.in_value, 0) ELSE 0 END) AS v_total_in_value,
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

-- 4. Update get_article_warehouse_card to include variant swaps
CREATE OR REPLACE FUNCTION public.get_article_warehouse_card(
  p_company_id UUID,
  p_warehouse_id UUID,
  p_article_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE(
  movement_date DATE,
  document_type TEXT,
  document_number TEXT,
  partner_name TEXT,
  in_quantity NUMERIC,
  out_quantity NUMERIC,
  unit_price NUMERIC,
  debit_value NUMERIC,
  credit_value NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH all_movements AS (
    SELECT gr.receipt_date AS mv_date, 'Prijemnica'::TEXT AS doc_type, gr.receipt_number AS doc_number, COALESCE(p.name, '')::TEXT AS p_name, gri.quantity AS in_qty, 0::NUMERIC AS out_qty, gri.unit_price AS u_price, (gri.quantity * gri.unit_price) AS deb_val, 0::NUMERIC AS cred_val
    FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id LEFT JOIN partners p ON p.id = gr.partner_id
    WHERE gr.company_id = p_company_id AND gr.warehouse_id = p_warehouse_id AND gri.article_id = p_article_id AND gr.status = 'posted'
    UNION ALL
    SELECT dn.delivery_date, 'Otpremnica'::TEXT, dn.delivery_number, COALESCE(p.name, '')::TEXT, 0::NUMERIC, dni.quantity, dni.unit_price, 0::NUMERIC, dni.line_value
    FROM delivery_note_items dni JOIN delivery_notes dn ON dn.id = dni.delivery_note_id LEFT JOIN partners p ON p.id = dn.partner_id
    WHERE dn.company_id = p_company_id AND dn.warehouse_id = p_warehouse_id AND dni.article_id = p_article_id AND dn.status = 'posted'
    UNION ALL
    SELECT ic.count_date, 'Popis višak'::TEXT, ic.count_number, ''::TEXT, ici.surplus_qty, 0::NUMERIC, ici.price, ici.surplus_value, 0::NUMERIC
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ici.article_id = p_article_id AND ic.status = 'posted' AND ici.surplus_qty > 0
    UNION ALL
    SELECT ic.count_date, 'Popis manjak'::TEXT, ic.count_number, ''::TEXT, 0::NUMERIC, ici.deficit_qty, ici.price, 0::NUMERIC, ici.deficit_value
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ici.article_id = p_article_id AND ic.status = 'posted' AND ici.deficit_qty > 0
    UNION ALL
    SELECT pa.adjustment_date, 'Nivelacija'::TEXT, pa.adjustment_number, ''::TEXT, 0::NUMERIC, 0::NUMERIC, pai.new_price,
      CASE WHEN pai.value_difference > 0 THEN pai.value_difference ELSE 0::NUMERIC END,
      CASE WHEN pai.value_difference < 0 THEN ABS(pai.value_difference) ELSE 0::NUMERIC END
    FROM price_adjustment_items pai JOIN price_adjustments pa ON pa.id = pai.price_adjustment_id
    WHERE pa.company_id = p_company_id AND pa.warehouse_id = p_warehouse_id AND pai.article_id = p_article_id AND pa.status = 'posted'
    UNION ALL
    SELECT iwt.transfer_date, 'MMP ulaz storno'::TEXT, iwt.transfer_number, ''::TEXT, -iti.quantity, 0::NUMERIC, iti.unit_price, -(iti.quantity * iti.unit_price), 0::NUMERIC
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.source_warehouse_id = p_warehouse_id AND iti.article_id = p_article_id AND iwt.status = 'posted'
    UNION ALL
    SELECT iwt.transfer_date, 'MMP ulaz'::TEXT, iwt.transfer_number, ''::TEXT, iti.quantity, 0::NUMERIC, iti.unit_price, (iti.quantity * iti.unit_price), 0::NUMERIC
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.destination_warehouse_id = p_warehouse_id AND iti.article_id = p_article_id AND iwt.status = 'posted'
    UNION ALL
    SELECT asw.swap_date, 'Zamena storno'::TEXT, asw.swap_number, ''::TEXT, -asw.quantity_1, 0::NUMERIC, asw.price_1, -asw.swap_value, 0::NUMERIC
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.article_1_id = p_article_id AND asw.status = 'posted'
    UNION ALL
    SELECT asw.swap_date, 'Zamena ulaz'::TEXT, asw.swap_number, ''::TEXT, asw.quantity_2, 0::NUMERIC, asw.price_2, asw.swap_value, 0::NUMERIC
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.article_2_id = p_article_id AND asw.status = 'posted'
    UNION ALL
    SELECT pdn.delivery_date, 'Predajnica GP'::TEXT, pdn.delivery_number, ''::TEXT, pdni.qty_total, 0::NUMERIC, pdni.unit_price, pdni.item_value, 0::NUMERIC
    FROM production_delivery_note_items pdni JOIN production_delivery_notes pdn ON pdn.id = pdni.delivery_note_id
    WHERE pdn.company_id = p_company_id AND pdn.warehouse_id = p_warehouse_id AND pdni.article_id = p_article_id AND pdn.status = 'posted'
    UNION ALL
    SELECT rdn.delivery_date::DATE, 'Predajnica prerada'::TEXT, rdn.delivery_number, ''::TEXT, rdni.qty_total, 0::NUMERIC, rdni.unit_price, rdni.item_value, 0::NUMERIC
    FROM reprocessing_delivery_note_items rdni JOIN reprocessing_delivery_notes rdn ON rdn.id = rdni.delivery_note_id
    WHERE rdn.company_id = p_company_id AND rdn.warehouse_id = p_warehouse_id AND rdni.article_id = p_article_id AND rdn.status = 'posted'
    UNION ALL
    SELECT rwo.order_date::DATE, 'RN prerada - GP'::TEXT, rwo.order_number, ''::TEXT, -rwi.quantity, 0::NUMERIC, rwi.unit_price, -rwi.item_value, 0::NUMERIC
    FROM reprocessing_wo_input_items rwi JOIN reprocessing_work_orders rwo ON rwo.id = rwi.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed' AND rwi.article_id = p_article_id
      AND COALESCE(rwi.warehouse_id, rwo.warehouse_id) = p_warehouse_id
    UNION ALL
    SELECT rwo.order_date::DATE, 'RN prerada - mat.'::TEXT, rwo.order_number, ''::TEXT, 0::NUMERIC, rwm.quantity, rwm.unit_price, 0::NUMERIC, rwm.item_value
    FROM reprocessing_wo_materials rwm JOIN reprocessing_work_orders rwo ON rwo.id = rwm.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed' AND rwm.article_id = p_article_id
      AND COALESCE(rwm.warehouse_id, rwo.warehouse_id) = p_warehouse_id
    UNION ALL
    SELECT vs.swap_date, 'Zamena varij. storno'::TEXT, vs.swap_number, ''::TEXT, 0::NUMERIC, vs.quantity, vs.unit_price, 0::NUMERIC, vs.swap_value
    FROM variant_swaps vs WHERE vs.company_id = p_company_id AND vs.warehouse_id = p_warehouse_id AND vs.article_id = p_article_id AND vs.status = 'posted'
    UNION ALL
    SELECT vs.swap_date, 'Zamena varij. ulaz'::TEXT, vs.swap_number, ''::TEXT, vs.quantity, 0::NUMERIC, vs.unit_price, vs.swap_value, 0::NUMERIC
    FROM variant_swaps vs WHERE vs.company_id = p_company_id AND vs.warehouse_id = p_warehouse_id AND vs.article_id = p_article_id AND vs.status = 'posted'
  ),
  opening AS (
    SELECT
      p_date_from AS mv_date,
      'Donos'::TEXT AS doc_type,
      ''::TEXT AS doc_number,
      ''::TEXT AS p_name,
      COALESCE(SUM(am.in_qty), 0) AS in_qty,
      COALESCE(SUM(am.out_qty), 0) AS out_qty,
      0::NUMERIC AS u_price,
      COALESCE(SUM(am.deb_val), 0) AS deb_val,
      COALESCE(SUM(am.cred_val), 0) AS cred_val
    FROM all_movements am
    WHERE p_date_from IS NOT NULL AND am.mv_date < p_date_from
  ),
  period_movements AS (
    SELECT * FROM all_movements am
    WHERE (p_date_from IS NULL OR am.mv_date >= p_date_from)
      AND (p_date_to IS NULL OR am.mv_date <= p_date_to)
  )
  SELECT o.mv_date, o.doc_type, o.doc_number, o.p_name, o.in_qty, o.out_qty, o.u_price, o.deb_val, o.cred_val
  FROM opening o
  WHERE p_date_from IS NOT NULL AND (o.in_qty <> 0 OR o.out_qty <> 0 OR o.deb_val <> 0 OR o.cred_val <> 0)
  UNION ALL
  SELECT pm.mv_date, pm.doc_type, pm.doc_number, pm.p_name, pm.in_qty, pm.out_qty, pm.u_price, pm.deb_val, pm.cred_val
  FROM period_movements pm
  ORDER BY mv_date, doc_type;
END;
$$;