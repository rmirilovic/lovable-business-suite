
CREATE OR REPLACE FUNCTION public.get_article_warehouse_card(
  p_company_id UUID, p_warehouse_id UUID, p_article_id UUID, p_date_from DATE DEFAULT NULL, p_date_to DATE DEFAULT NULL
)
RETURNS TABLE(movement_date DATE, document_type TEXT, document_number TEXT, partner_name TEXT, in_quantity NUMERIC, out_quantity NUMERIC, unit_price NUMERIC, debit_value NUMERIC, credit_value NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (
    SELECT gr.receipt_date AS movement_date, 'Prijemnica'::TEXT AS document_type, gr.receipt_number AS document_number, COALESCE(p.name, '')::TEXT AS partner_name, gri.quantity AS in_quantity, 0::NUMERIC AS out_quantity, gri.unit_price AS unit_price, (gri.quantity * gri.unit_price) AS debit_value, 0::NUMERIC AS credit_value
    FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id LEFT JOIN partners p ON p.id = gr.partner_id
    WHERE gr.company_id = p_company_id AND gr.warehouse_id = p_warehouse_id AND gri.article_id = p_article_id AND gr.status = 'posted'
      AND (p_date_from IS NULL OR gr.receipt_date >= p_date_from) AND (p_date_to IS NULL OR gr.receipt_date <= p_date_to)
    UNION ALL
    SELECT dn.delivery_date, 'Otpremnica'::TEXT, dn.delivery_number, COALESCE(p.name, '')::TEXT, 0::NUMERIC, dni.quantity, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC
    FROM delivery_note_items dni JOIN delivery_notes dn ON dn.id = dni.delivery_note_id LEFT JOIN partners p ON p.id = dn.partner_id
    WHERE dn.company_id = p_company_id AND dn.warehouse_id = p_warehouse_id AND dni.article_id = p_article_id AND dn.status = 'posted'
      AND (p_date_from IS NULL OR dn.delivery_date >= p_date_from) AND (p_date_to IS NULL OR dn.delivery_date <= p_date_to)
    UNION ALL
    SELECT ic.count_date, 'Popis višak'::TEXT, ic.count_number, ''::TEXT, ici.surplus_qty, 0::NUMERIC, ici.price, ici.surplus_value, 0::NUMERIC
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ici.article_id = p_article_id AND ic.status = 'posted' AND ici.surplus_qty > 0
      AND (p_date_from IS NULL OR ic.count_date >= p_date_from) AND (p_date_to IS NULL OR ic.count_date <= p_date_to)
    UNION ALL
    SELECT ic.count_date, 'Popis manjak'::TEXT, ic.count_number, ''::TEXT, 0::NUMERIC, ici.deficit_qty, ici.price, 0::NUMERIC, ici.deficit_value
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ici.article_id = p_article_id AND ic.status = 'posted' AND ici.deficit_qty > 0
      AND (p_date_from IS NULL OR ic.count_date >= p_date_from) AND (p_date_to IS NULL OR ic.count_date <= p_date_to)
    UNION ALL
    SELECT pa.adjustment_date, 'Nivelacija'::TEXT, pa.adjustment_number, ''::TEXT, 0::NUMERIC, 0::NUMERIC, pai.new_price,
      CASE WHEN pai.value_difference > 0 THEN pai.value_difference ELSE 0::NUMERIC END,
      CASE WHEN pai.value_difference < 0 THEN ABS(pai.value_difference) ELSE 0::NUMERIC END
    FROM price_adjustment_items pai JOIN price_adjustments pa ON pa.id = pai.price_adjustment_id
    WHERE pa.company_id = p_company_id AND pa.warehouse_id = p_warehouse_id AND pai.article_id = p_article_id AND pa.status = 'posted'
      AND (p_date_from IS NULL OR pa.adjustment_date >= p_date_from) AND (p_date_to IS NULL OR pa.adjustment_date <= p_date_to)
    UNION ALL
    SELECT iwt.transfer_date, 'MMP ulaz storno'::TEXT, iwt.transfer_number, ''::TEXT, -iti.quantity, 0::NUMERIC, iti.unit_price, -(iti.quantity * iti.unit_price), 0::NUMERIC
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.source_warehouse_id = p_warehouse_id AND iti.article_id = p_article_id AND iwt.status = 'posted'
      AND (p_date_from IS NULL OR iwt.transfer_date >= p_date_from) AND (p_date_to IS NULL OR iwt.transfer_date <= p_date_to)
    UNION ALL
    SELECT iwt.transfer_date, 'MMP ulaz'::TEXT, iwt.transfer_number, ''::TEXT, iti.quantity, 0::NUMERIC, iti.unit_price, (iti.quantity * iti.unit_price), 0::NUMERIC
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.destination_warehouse_id = p_warehouse_id AND iti.article_id = p_article_id AND iwt.status = 'posted'
      AND (p_date_from IS NULL OR iwt.transfer_date >= p_date_from) AND (p_date_to IS NULL OR iwt.transfer_date <= p_date_to)
    UNION ALL
    SELECT asw.swap_date, 'Zamena storno'::TEXT, asw.swap_number, ''::TEXT, -asw.quantity_1, 0::NUMERIC, asw.price_1, -asw.swap_value, 0::NUMERIC
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.article_1_id = p_article_id AND asw.status = 'posted'
      AND (p_date_from IS NULL OR asw.swap_date >= p_date_from) AND (p_date_to IS NULL OR asw.swap_date <= p_date_to)
    UNION ALL
    SELECT asw.swap_date, 'Zamena ulaz'::TEXT, asw.swap_number, ''::TEXT, asw.quantity_2, 0::NUMERIC, asw.price_2, asw.swap_value, 0::NUMERIC
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.article_2_id = p_article_id AND asw.status = 'posted'
      AND (p_date_from IS NULL OR asw.swap_date >= p_date_from) AND (p_date_to IS NULL OR asw.swap_date <= p_date_to)
    UNION ALL
    SELECT pdn.delivery_date, 'Predajnica GP'::TEXT, pdn.delivery_number, ''::TEXT, pdni.delivered_kg, 0::NUMERIC, pdni.unit_price, pdni.item_value, 0::NUMERIC
    FROM production_delivery_note_items pdni JOIN production_delivery_notes pdn ON pdn.id = pdni.delivery_note_id
    WHERE pdn.company_id = p_company_id AND pdn.warehouse_id = p_warehouse_id AND pdni.article_id = p_article_id AND pdn.status = 'posted'
      AND (p_date_from IS NULL OR pdn.delivery_date >= p_date_from) AND (p_date_to IS NULL OR pdn.delivery_date <= p_date_to)
    UNION ALL
    SELECT rdn.delivery_date::DATE, 'Predajnica prerada'::TEXT, rdn.delivery_number, ''::TEXT, rdni.delivered_kg, 0::NUMERIC, rdni.unit_price, rdni.item_value, 0::NUMERIC
    FROM reprocessing_delivery_note_items rdni JOIN reprocessing_delivery_notes rdn ON rdn.id = rdni.delivery_note_id
    WHERE rdn.company_id = p_company_id AND rdn.warehouse_id = p_warehouse_id AND rdni.article_id = p_article_id AND rdn.status = 'posted'
      AND (p_date_from IS NULL OR rdn.delivery_date::DATE >= p_date_from) AND (p_date_to IS NULL OR rdn.delivery_date::DATE <= p_date_to)
  ) sub
  ORDER BY sub.movement_date, sub.document_type;
END;
$$;
