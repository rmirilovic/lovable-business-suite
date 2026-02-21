CREATE OR REPLACE FUNCTION public.get_warehouse_turnover(p_company_id uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(warehouse_id uuid, warehouse_code text, warehouse_name text, document_type text, debit_value numeric, credit_value numeric, balance_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH movements AS (
    SELECT gr.warehouse_id, 'Prijemnica'::TEXT AS doc_type,
      SUM(gri.quantity * gri.unit_price) AS debit_val, 0::NUMERIC AS credit_val
    FROM goods_receipts gr JOIN goods_receipt_items gri ON gri.goods_receipt_id = gr.id AND gri.company_id = gr.company_id
    WHERE gr.company_id = p_company_id AND gr.status = 'posted' AND gr.linked_calculation_id IS NULL
      AND (p_date_from IS NULL OR gr.receipt_date >= p_date_from) AND (p_date_to IS NULL OR gr.receipt_date <= p_date_to)
    GROUP BY gr.warehouse_id
    UNION ALL
    SELECT gr.warehouse_id, 'Kalkulacija'::TEXT, SUM(ci.selling_value), 0::NUMERIC
    FROM purchase_price_calculations ppc JOIN goods_receipts gr ON gr.id = ppc.goods_receipt_id
    JOIN calculation_items ci ON ci.calculation_id = ppc.id AND ci.company_id = ppc.company_id
    WHERE ppc.company_id = p_company_id AND ppc.status = 'posted'
      AND (p_date_from IS NULL OR ppc.calculation_date >= p_date_from) AND (p_date_to IS NULL OR ppc.calculation_date <= p_date_to)
    GROUP BY gr.warehouse_id
    UNION ALL
    SELECT pa.warehouse_id, 'Nivelacija'::TEXT,
      SUM(CASE WHEN pai.value_difference > 0 THEN pai.value_difference ELSE 0 END),
      SUM(CASE WHEN pai.value_difference < 0 THEN ABS(pai.value_difference) ELSE 0 END)
    FROM price_adjustments pa JOIN price_adjustment_items pai ON pai.price_adjustment_id = pa.id AND pai.company_id = pa.company_id
    WHERE pa.company_id = p_company_id AND pa.status = 'posted'
      AND (p_date_from IS NULL OR pa.adjustment_date >= p_date_from) AND (p_date_to IS NULL OR pa.adjustment_date <= p_date_to)
    GROUP BY pa.warehouse_id
    UNION ALL
    SELECT ic.warehouse_id, 'Popis - višak'::TEXT, SUM(ici.surplus_value), 0::NUMERIC
    FROM inventory_counts ic JOIN inventory_count_items ici ON ici.inventory_count_id = ic.id AND ici.company_id = ic.company_id
    WHERE ic.company_id = p_company_id AND ic.status = 'posted'
      AND (p_date_from IS NULL OR ic.count_date >= p_date_from) AND (p_date_to IS NULL OR ic.count_date <= p_date_to)
    GROUP BY ic.warehouse_id HAVING SUM(ici.surplus_value) > 0
    UNION ALL
    SELECT ic.warehouse_id, 'Popis - manjak'::TEXT, 0::NUMERIC, SUM(ici.deficit_value)
    FROM inventory_counts ic JOIN inventory_count_items ici ON ici.inventory_count_id = ic.id AND ici.company_id = ic.company_id
    WHERE ic.company_id = p_company_id AND ic.status = 'posted'
      AND (p_date_from IS NULL OR ic.count_date >= p_date_from) AND (p_date_to IS NULL OR ic.count_date <= p_date_to)
    GROUP BY ic.warehouse_id HAVING SUM(ici.deficit_value) > 0
    UNION ALL
    SELECT iwt.source_warehouse_id, 'MMP - izlaz'::TEXT, 0::NUMERIC, SUM(iwti.quantity * iwti.unit_price)
    FROM inter_warehouse_transfers iwt JOIN inter_warehouse_transfer_items iwti ON iwti.transfer_id = iwt.id AND iwti.company_id = iwt.company_id
    WHERE iwt.company_id = p_company_id AND iwt.status = 'posted'
      AND (p_date_from IS NULL OR iwt.transfer_date >= p_date_from) AND (p_date_to IS NULL OR iwt.transfer_date <= p_date_to)
    GROUP BY iwt.source_warehouse_id
    UNION ALL
    SELECT iwt.destination_warehouse_id, 'MMP - ulaz'::TEXT, SUM(iwti.quantity * iwti.unit_price), 0::NUMERIC
    FROM inter_warehouse_transfers iwt JOIN inter_warehouse_transfer_items iwti ON iwti.transfer_id = iwt.id AND iwti.company_id = iwt.company_id
    WHERE iwt.company_id = p_company_id AND iwt.status = 'posted'
      AND (p_date_from IS NULL OR iwt.transfer_date >= p_date_from) AND (p_date_to IS NULL OR iwt.transfer_date <= p_date_to)
    GROUP BY iwt.destination_warehouse_id
    UNION ALL
    SELECT asw.warehouse_id, 'Zamena artikla'::TEXT, SUM(asw.quantity_2 * asw.price_2), SUM(asw.quantity_1 * asw.price_1)
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.status = 'posted'
      AND (p_date_from IS NULL OR asw.swap_date >= p_date_from) AND (p_date_to IS NULL OR asw.swap_date <= p_date_to)
    GROUP BY asw.warehouse_id
    UNION ALL
    SELECT dn.warehouse_id, 'Otpremnica'::TEXT, 0::NUMERIC, SUM(dni.quantity * COALESCE(a.selling_price, 0))
    FROM delivery_notes dn JOIN delivery_note_items dni ON dni.delivery_note_id = dn.id AND dni.company_id = dn.company_id
    JOIN articles a ON a.id = dni.article_id
    WHERE dn.company_id = p_company_id AND dn.status = 'posted'
      AND (p_date_from IS NULL OR dn.delivery_date >= p_date_from) AND (p_date_to IS NULL OR dn.delivery_date <= p_date_to)
    GROUP BY dn.warehouse_id
    UNION ALL
    SELECT pdn.warehouse_id, 'Predajnica GP'::TEXT, SUM(pdni.item_value), 0::NUMERIC
    FROM production_delivery_notes pdn JOIN production_delivery_note_items pdni ON pdni.delivery_note_id = pdn.id AND pdni.company_id = pdn.company_id
    WHERE pdn.company_id = p_company_id AND pdn.status = 'posted'
      AND (p_date_from IS NULL OR pdn.delivery_date >= p_date_from) AND (p_date_to IS NULL OR pdn.delivery_date <= p_date_to)
    GROUP BY pdn.warehouse_id
    UNION ALL
    SELECT rdn.warehouse_id, 'Predajnica prerada'::TEXT, SUM(rdni.item_value), 0::NUMERIC
    FROM reprocessing_delivery_notes rdn JOIN reprocessing_delivery_note_items rdni ON rdni.delivery_note_id = rdn.id AND rdni.company_id = rdn.company_id
    WHERE rdn.company_id = p_company_id AND rdn.status = 'posted'
      AND (p_date_from IS NULL OR rdn.delivery_date::DATE >= p_date_from) AND (p_date_to IS NULL OR rdn.delivery_date::DATE <= p_date_to)
    GROUP BY rdn.warehouse_id
    UNION ALL
    SELECT COALESCE(rwi.warehouse_id, rwo.warehouse_id), 'RN prerada - GP'::TEXT, -SUM(rwi.item_value), 0::NUMERIC
    FROM reprocessing_work_orders rwo JOIN reprocessing_wo_input_items rwi ON rwi.work_order_id = rwo.id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed'
      AND (p_date_from IS NULL OR rwo.order_date::DATE >= p_date_from) AND (p_date_to IS NULL OR rwo.order_date::DATE <= p_date_to)
    GROUP BY COALESCE(rwi.warehouse_id, rwo.warehouse_id)
    UNION ALL
    SELECT COALESCE(rwm.warehouse_id, rwo.warehouse_id), 'RN prerada - mat.'::TEXT, 0::NUMERIC, SUM(rwm.item_value)
    FROM reprocessing_work_orders rwo JOIN reprocessing_wo_materials rwm ON rwm.work_order_id = rwo.id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed'
      AND (p_date_from IS NULL OR rwo.order_date::DATE >= p_date_from) AND (p_date_to IS NULL OR rwo.order_date::DATE <= p_date_to)
    GROUP BY COALESCE(rwm.warehouse_id, rwo.warehouse_id)
  )
  SELECT m.warehouse_id, w.code, w.name, m.doc_type, m.debit_val, m.credit_val, (m.debit_val - m.credit_val)
  FROM movements m JOIN warehouses w ON w.id = m.warehouse_id
  ORDER BY w.code, m.doc_type;
END;
$function$;