DROP FUNCTION IF EXISTS public.get_warehouse_inventory_list(uuid, uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_warehouse_inventory_list(p_company_id uuid, p_warehouse_id uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(article_id uuid, article_code text, article_name text, unit text, opening_qty numeric, in_qty numeric, out_qty numeric, turnover_qty numeric, closing_qty numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH movements AS (
    SELECT gri.article_id AS aid, gri.quantity AS mq, gr.receipt_date AS md, 'in' AS dir
    FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    WHERE gr.company_id = p_company_id AND gr.warehouse_id = p_warehouse_id AND gr.status = 'posted' AND gri.article_id IS NOT NULL
    UNION ALL
    SELECT dni.article_id, dni.quantity, dn.delivery_date, 'out'
    FROM delivery_note_items dni JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    WHERE dn.company_id = p_company_id AND dn.warehouse_id = p_warehouse_id AND dn.status = 'posted'
    UNION ALL
    SELECT ici.article_id, ici.surplus_qty, ic.count_date, 'in'
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.surplus_qty > 0
    UNION ALL
    SELECT ici.article_id, ici.deficit_qty, ic.count_date, 'out'
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.deficit_qty > 0
    UNION ALL
    SELECT iti.article_id, -iti.quantity, iwt.transfer_date, 'in'
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.source_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    SELECT iti.article_id, iti.quantity, iwt.transfer_date, 'in'
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.destination_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    SELECT asw.article_1_id, -asw.quantity_1, asw.swap_date, 'in'
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    SELECT asw.article_2_id, asw.quantity_2, asw.swap_date, 'in'
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    SELECT pdni.article_id, pdni.delivered_kg, pdn.delivery_date, 'in'
    FROM production_delivery_note_items pdni JOIN production_delivery_notes pdn ON pdn.id = pdni.delivery_note_id
    WHERE pdn.company_id = p_company_id AND pdn.warehouse_id = p_warehouse_id AND pdn.status = 'posted'
    UNION ALL
    SELECT rdni.article_id, rdni.delivered_kg, rdn.delivery_date::DATE, 'in'
    FROM reprocessing_delivery_note_items rdni JOIN reprocessing_delivery_notes rdn ON rdn.id = rdni.delivery_note_id
    WHERE rdn.company_id = p_company_id AND rdn.warehouse_id = p_warehouse_id AND rdn.status = 'posted'
    UNION ALL
    SELECT rwi.article_id, -rwi.quantity, rwo.order_date::DATE, 'in'
    FROM reprocessing_wo_input_items rwi JOIN reprocessing_work_orders rwo ON rwo.id = rwi.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed'
      AND COALESCE(rwi.warehouse_id, rwo.warehouse_id) = p_warehouse_id
    UNION ALL
    SELECT rwm.article_id, rwm.quantity, rwo.order_date::DATE, 'out'
    FROM reprocessing_wo_materials rwm JOIN reprocessing_work_orders rwo ON rwo.id = rwm.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed'
      AND COALESCE(rwm.warehouse_id, rwo.warehouse_id) = p_warehouse_id
  ),
  article_movements AS (
    SELECT m.aid,
      COALESCE(SUM(CASE WHEN m.dir = 'in' THEN m.mq ELSE 0 END) FILTER (WHERE p_date_from IS NOT NULL AND m.md < p_date_from), 0) -
      COALESCE(SUM(CASE WHEN m.dir = 'out' THEN m.mq ELSE 0 END) FILTER (WHERE p_date_from IS NOT NULL AND m.md < p_date_from), 0) AS v_opening,
      COALESCE(SUM(CASE WHEN m.dir = 'in' THEN m.mq ELSE 0 END) FILTER (WHERE (p_date_from IS NULL OR m.md >= p_date_from) AND (p_date_to IS NULL OR m.md <= p_date_to)), 0) AS v_in,
      COALESCE(SUM(CASE WHEN m.dir = 'out' THEN m.mq ELSE 0 END) FILTER (WHERE (p_date_from IS NULL OR m.md >= p_date_from) AND (p_date_to IS NULL OR m.md <= p_date_to)), 0) AS v_out
    FROM movements m GROUP BY m.aid
  )
  SELECT a.id, a.code, a.name, a.unit,
    am.v_opening,
    am.v_in,
    am.v_out,
    am.v_in + am.v_out,
    am.v_opening + am.v_in - am.v_out
  FROM article_movements am JOIN articles a ON a.id = am.aid
  ORDER BY a.code;
END;
$function$;