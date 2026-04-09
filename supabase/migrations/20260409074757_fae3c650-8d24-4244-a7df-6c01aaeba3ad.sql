
CREATE OR REPLACE FUNCTION public.get_article_all_warehouses_card(
  p_company_id UUID,
  p_article_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE(
  warehouse_code TEXT,
  warehouse_name TEXT,
  warehouse_id UUID,
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
    SELECT gr.warehouse_id AS wh_id, gr.receipt_date AS mv_date, 'Prijemnica'::TEXT AS doc_type, gr.receipt_number AS doc_number, COALESCE(p.name, '')::TEXT AS p_name, gri.quantity AS in_qty, 0::NUMERIC AS out_qty, gri.unit_price AS u_price, (gri.quantity * gri.unit_price) AS deb_val, 0::NUMERIC AS cred_val
    FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id LEFT JOIN partners p ON p.id = gr.partner_id
    WHERE gr.company_id = p_company_id AND gri.article_id = p_article_id AND gr.status = 'posted'
    UNION ALL
    SELECT dn.warehouse_id, dn.delivery_date, 'Otpremnica'::TEXT, dn.delivery_number, COALESCE(p.name, '')::TEXT, 0::NUMERIC, dni.quantity, dni.unit_price, 0::NUMERIC, dni.line_value
    FROM delivery_note_items dni JOIN delivery_notes dn ON dn.id = dni.delivery_note_id LEFT JOIN partners p ON p.id = dn.partner_id
    WHERE dn.company_id = p_company_id AND dni.article_id = p_article_id AND dn.status = 'posted'
    UNION ALL
    SELECT ic.warehouse_id, ic.count_date, 'Popis višak'::TEXT, ic.count_number, ''::TEXT, ici.surplus_qty, 0::NUMERIC, ici.price, ici.surplus_value, 0::NUMERIC
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ici.article_id = p_article_id AND ic.status = 'posted' AND ici.surplus_qty > 0
    UNION ALL
    SELECT ic.warehouse_id, ic.count_date, 'Popis manjak'::TEXT, ic.count_number, ''::TEXT, 0::NUMERIC, ici.deficit_qty, ici.price, 0::NUMERIC, ici.deficit_value
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ici.article_id = p_article_id AND ic.status = 'posted' AND ici.deficit_qty > 0
    UNION ALL
    SELECT pa.warehouse_id, pa.adjustment_date, 'Nivelacija'::TEXT, pa.adjustment_number, ''::TEXT, 0::NUMERIC, 0::NUMERIC, pai.new_price,
      CASE WHEN pai.value_difference > 0 THEN pai.value_difference ELSE 0::NUMERIC END,
      CASE WHEN pai.value_difference < 0 THEN ABS(pai.value_difference) ELSE 0::NUMERIC END
    FROM price_adjustment_items pai JOIN price_adjustments pa ON pa.id = pai.price_adjustment_id
    WHERE pa.company_id = p_company_id AND pai.article_id = p_article_id AND pa.status = 'posted'
    UNION ALL
    SELECT iwt.source_warehouse_id, iwt.transfer_date, 'MMP izlaz'::TEXT, iwt.transfer_number, ''::TEXT, 0::NUMERIC, iti.quantity, iti.unit_price, 0::NUMERIC, (iti.quantity * iti.unit_price)
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iti.article_id = p_article_id AND iwt.status = 'posted'
    UNION ALL
    SELECT iwt.destination_warehouse_id, iwt.transfer_date, 'MMP ulaz'::TEXT, iwt.transfer_number, ''::TEXT, iti.quantity, 0::NUMERIC, iti.unit_price, (iti.quantity * iti.unit_price), 0::NUMERIC
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iti.article_id = p_article_id AND iwt.status = 'posted'
    UNION ALL
    SELECT asw.warehouse_id, asw.swap_date, 'Zamena izlaz'::TEXT, asw.swap_number, ''::TEXT, 0::NUMERIC, asw.quantity_1, asw.price_1, 0::NUMERIC, asw.swap_value
    FROM article_swaps asw
    WHERE asw.company_id = p_company_id AND asw.article_1_id = p_article_id AND asw.status = 'posted'
    UNION ALL
    SELECT asw.warehouse_id, asw.swap_date, 'Zamena ulaz'::TEXT, asw.swap_number, ''::TEXT, asw.quantity_2, 0::NUMERIC, asw.price_2, asw.swap_value, 0::NUMERIC
    FROM article_swaps asw
    WHERE asw.company_id = p_company_id AND asw.article_2_id = p_article_id AND asw.status = 'posted'
    UNION ALL
    SELECT pdn.warehouse_id, pdn.delivery_date, 'Predajnica GP'::TEXT, pdn.delivery_number, ''::TEXT, pdni.quantity, 0::NUMERIC, pdni.unit_price, pdni.total_price, 0::NUMERIC
    FROM production_delivery_note_items pdni JOIN production_delivery_notes pdn ON pdn.id = pdni.production_delivery_note_id
    WHERE pdn.company_id = p_company_id AND pdni.article_id = p_article_id AND pdn.status = 'posted'
    UNION ALL
    SELECT mr.warehouse_id, mr.requisition_date, 'Trebovanje'::TEXT, mr.requisition_number, ''::TEXT, 0::NUMERIC, mri.quantity, mri.unit_price, 0::NUMERIC, (mri.quantity * mri.unit_price)
    FROM material_requisition_items mri JOIN material_requisitions mr ON mr.id = mri.material_requisition_id
    WHERE mr.company_id = p_company_id AND mri.article_id = p_article_id AND mr.status = 'posted'
    UNION ALL
    SELECT rpdn.warehouse_id, rpdn.delivery_date, 'Predajnica PR'::TEXT, rpdn.delivery_number, ''::TEXT, rpdni.quantity, 0::NUMERIC, rpdni.unit_price, rpdni.total_price, 0::NUMERIC
    FROM reprocessing_delivery_note_items rpdni JOIN reprocessing_delivery_notes rpdn ON rpdn.id = rpdni.reprocessing_delivery_note_id
    WHERE rpdn.company_id = p_company_id AND rpdni.article_id = p_article_id AND rpdn.status = 'posted'
  ),
  dated AS (
    SELECT * FROM all_movements
    WHERE (p_date_from IS NULL OR mv_date >= p_date_from)
      AND (p_date_to IS NULL OR mv_date <= p_date_to)
  )
  SELECT w.code::TEXT AS warehouse_code, w.name::TEXT AS warehouse_name, w.id AS warehouse_id,
         d.mv_date AS movement_date, d.doc_type AS document_type, d.doc_number AS document_number,
         d.p_name AS partner_name, d.in_qty AS in_quantity, d.out_qty AS out_quantity,
         d.u_price AS unit_price, d.deb_val AS debit_value, d.cred_val AS credit_value
  FROM dated d
  JOIN warehouses w ON w.id = d.wh_id
  ORDER BY w.code, d.mv_date, d.doc_type, d.doc_number;
END;
$$;
