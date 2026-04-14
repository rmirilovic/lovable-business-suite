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