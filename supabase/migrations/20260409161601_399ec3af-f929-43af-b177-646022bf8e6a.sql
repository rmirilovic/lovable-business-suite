
CREATE OR REPLACE FUNCTION public.get_articles_with_movements(
  p_company_id UUID,
  p_date_from DATE DEFAULT NULL
)
RETURNS TABLE(article_id UUID)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT a_id FROM (
    SELECT gri.article_id AS a_id FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id WHERE gr.company_id = p_company_id AND gr.status = 'posted' AND (p_date_from IS NULL OR gr.receipt_date >= p_date_from)
    UNION
    SELECT dni.article_id FROM delivery_note_items dni JOIN delivery_notes dn ON dn.id = dni.delivery_note_id WHERE dn.company_id = p_company_id AND dn.status = 'posted' AND (p_date_from IS NULL OR dn.delivery_date >= p_date_from)
    UNION
    SELECT ici.article_id FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id WHERE ic.company_id = p_company_id AND ic.status = 'posted' AND (p_date_from IS NULL OR ic.count_date >= p_date_from)
    UNION
    SELECT pai.article_id FROM price_adjustment_items pai JOIN price_adjustments pa ON pa.id = pai.price_adjustment_id WHERE pa.company_id = p_company_id AND pa.status = 'posted' AND (p_date_from IS NULL OR pa.adjustment_date >= p_date_from)
    UNION
    SELECT iti.article_id FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id WHERE iwt.company_id = p_company_id AND iwt.status = 'posted' AND (p_date_from IS NULL OR iwt.transfer_date >= p_date_from)
    UNION
    SELECT asw.article_1_id FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.status = 'posted' AND (p_date_from IS NULL OR asw.swap_date >= p_date_from)
    UNION
    SELECT asw.article_2_id FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.status = 'posted' AND (p_date_from IS NULL OR asw.swap_date >= p_date_from)
    UNION
    SELECT pdni.article_id FROM production_delivery_note_items pdni JOIN production_delivery_notes pdn ON pdn.id = pdni.delivery_note_id WHERE pdn.company_id = p_company_id AND pdn.status = 'posted' AND (p_date_from IS NULL OR pdn.delivery_date >= p_date_from)
    UNION
    SELECT rdni.article_id FROM reprocessing_delivery_note_items rdni JOIN reprocessing_delivery_notes rdn ON rdn.id = rdni.delivery_note_id WHERE rdn.company_id = p_company_id AND rdn.status = 'posted' AND (p_date_from IS NULL OR rdn.delivery_date::DATE >= p_date_from)
    UNION
    SELECT mri.article_id FROM material_requisition_items mri JOIN material_requisitions mr ON mr.id = mri.requisition_id WHERE mr.company_id = p_company_id AND mr.status = 'posted' AND (p_date_from IS NULL OR mr.requisition_date >= p_date_from)
  ) sub;
$$;
