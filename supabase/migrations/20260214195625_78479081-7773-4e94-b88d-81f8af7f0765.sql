
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
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (
    -- Goods receipt items
    SELECT
      gr.receipt_date AS movement_date,
      'Prijemnica'::TEXT AS document_type,
      gr.receipt_number AS document_number,
      COALESCE(p.name, '')::TEXT AS partner_name,
      gri.quantity AS in_quantity,
      0::NUMERIC AS out_quantity,
      gri.unit_price,
      (gri.quantity * gri.unit_price) AS debit_value,
      0::NUMERIC AS credit_value
    FROM goods_receipt_items gri
    JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    LEFT JOIN partners p ON p.id = gr.partner_id
    WHERE gr.company_id = p_company_id
      AND gr.warehouse_id = p_warehouse_id
      AND gri.article_id = p_article_id
      AND gr.status = 'posted'
      AND (p_date_from IS NULL OR gr.receipt_date >= p_date_from)
      AND (p_date_to IS NULL OR gr.receipt_date <= p_date_to)

    UNION ALL

    -- Delivery note items
    SELECT
      dn.delivery_date AS movement_date,
      'Otpremnica'::TEXT AS document_type,
      dn.delivery_number AS document_number,
      COALESCE(p.name, '')::TEXT AS partner_name,
      0::NUMERIC AS in_quantity,
      dni.quantity AS out_quantity,
      0::NUMERIC AS unit_price,
      0::NUMERIC AS debit_value,
      0::NUMERIC AS credit_value
    FROM delivery_note_items dni
    JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    LEFT JOIN partners p ON p.id = dn.partner_id
    WHERE dn.company_id = p_company_id
      AND dn.warehouse_id = p_warehouse_id
      AND dni.article_id = p_article_id
      AND dn.status = 'posted'
      AND (p_date_from IS NULL OR dn.delivery_date >= p_date_from)
      AND (p_date_to IS NULL OR dn.delivery_date <= p_date_to)

    UNION ALL

    -- Inventory count surplus (inflow)
    SELECT
      ic.count_date AS movement_date,
      'Popis višak'::TEXT AS document_type,
      ic.count_number AS document_number,
      ''::TEXT AS partner_name,
      ici.surplus_qty AS in_quantity,
      0::NUMERIC AS out_quantity,
      ici.price AS unit_price,
      ici.surplus_value AS debit_value,
      0::NUMERIC AS credit_value
    FROM inventory_count_items ici
    JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id
      AND ic.warehouse_id = p_warehouse_id
      AND ici.article_id = p_article_id
      AND ic.status = 'posted'
      AND ici.surplus_qty > 0
      AND (p_date_from IS NULL OR ic.count_date >= p_date_from)
      AND (p_date_to IS NULL OR ic.count_date <= p_date_to)

    UNION ALL

    -- Inventory count deficit (outflow)
    SELECT
      ic.count_date AS movement_date,
      'Popis manjak'::TEXT AS document_type,
      ic.count_number AS document_number,
      ''::TEXT AS partner_name,
      0::NUMERIC AS in_quantity,
      ici.deficit_qty AS out_quantity,
      ici.price AS unit_price,
      0::NUMERIC AS debit_value,
      ici.deficit_value AS credit_value
    FROM inventory_count_items ici
    JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id
      AND ic.warehouse_id = p_warehouse_id
      AND ici.article_id = p_article_id
      AND ic.status = 'posted'
      AND ici.deficit_qty > 0
      AND (p_date_from IS NULL OR ic.count_date >= p_date_from)
      AND (p_date_to IS NULL OR ic.count_date <= p_date_to)

    UNION ALL

    -- Price adjustment items (value-only, no quantity change)
    SELECT
      pa.adjustment_date AS movement_date,
      'Nivelacija'::TEXT AS document_type,
      pa.adjustment_number AS document_number,
      ''::TEXT AS partner_name,
      0::NUMERIC AS in_quantity,
      0::NUMERIC AS out_quantity,
      pai.new_price AS unit_price,
      CASE WHEN pai.value_difference > 0 THEN pai.value_difference ELSE 0::NUMERIC END AS debit_value,
      CASE WHEN pai.value_difference < 0 THEN ABS(pai.value_difference) ELSE 0::NUMERIC END AS credit_value
    FROM price_adjustment_items pai
    JOIN price_adjustments pa ON pa.id = pai.price_adjustment_id
    WHERE pa.company_id = p_company_id
      AND pa.warehouse_id = p_warehouse_id
      AND pai.article_id = p_article_id
      AND pa.status = 'posted'
      AND (p_date_from IS NULL OR pa.adjustment_date >= p_date_from)
      AND (p_date_to IS NULL OR pa.adjustment_date <= p_date_to)
  ) sub
  ORDER BY sub.movement_date, sub.document_type;
END;
$$;
