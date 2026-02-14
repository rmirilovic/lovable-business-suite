
CREATE OR REPLACE FUNCTION public.get_warehouse_stock(
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
  total_in_qty NUMERIC,
  total_in_value NUMERIC,
  total_out_qty NUMERIC,
  total_out_value NUMERIC,
  balance_qty NUMERIC,
  balance_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH movements AS (
    -- Goods receipt items (inflow)
    SELECT
      gri.article_id,
      gri.quantity AS in_qty,
      gri.quantity * gri.unit_price AS in_value,
      0::NUMERIC AS out_qty,
      0::NUMERIC AS out_value,
      gr.receipt_date AS movement_date
    FROM goods_receipt_items gri
    JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    WHERE gr.company_id = p_company_id
      AND gr.warehouse_id = p_warehouse_id
      AND gr.status = 'posted'
      AND gri.article_id IS NOT NULL

    UNION ALL

    -- Delivery note items (outflow)
    SELECT
      dni.article_id,
      0::NUMERIC AS in_qty,
      0::NUMERIC AS in_value,
      dni.quantity AS out_qty,
      0::NUMERIC AS out_value,
      dn.delivery_date AS movement_date
    FROM delivery_note_items dni
    JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    WHERE dn.company_id = p_company_id
      AND dn.warehouse_id = p_warehouse_id
      AND dn.status = 'posted'

    UNION ALL

    -- Inventory count surplus (inflow)
    SELECT
      ici.article_id,
      ici.surplus_qty AS in_qty,
      ici.surplus_value AS in_value,
      0::NUMERIC AS out_qty,
      0::NUMERIC AS out_value,
      ic.count_date AS movement_date
    FROM inventory_count_items ici
    JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id
      AND ic.warehouse_id = p_warehouse_id
      AND ic.status = 'posted'
      AND ici.surplus_qty > 0

    UNION ALL

    -- Inventory count deficit (outflow)
    SELECT
      ici.article_id,
      0::NUMERIC AS in_qty,
      0::NUMERIC AS in_value,
      ici.deficit_qty AS out_qty,
      ici.deficit_value AS out_value,
      ic.count_date AS movement_date
    FROM inventory_count_items ici
    JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id
      AND ic.warehouse_id = p_warehouse_id
      AND ic.status = 'posted'
      AND ici.deficit_qty > 0

    UNION ALL

    -- Price adjustment items (value-only movement, no quantity change)
    SELECT
      pai.article_id,
      CASE WHEN pai.value_difference > 0 THEN 0::NUMERIC ELSE 0::NUMERIC END AS in_qty,
      CASE WHEN pai.value_difference > 0 THEN pai.value_difference ELSE 0::NUMERIC END AS in_value,
      0::NUMERIC AS out_qty,
      CASE WHEN pai.value_difference < 0 THEN ABS(pai.value_difference) ELSE 0::NUMERIC END AS out_value,
      pa.adjustment_date AS movement_date
    FROM price_adjustment_items pai
    JOIN price_adjustments pa ON pa.id = pai.price_adjustment_id
    WHERE pa.company_id = p_company_id
      AND pa.warehouse_id = p_warehouse_id
      AND pa.status = 'posted'
  )
  SELECT
    a.id AS article_id,
    a.code AS article_code,
    a.name AS article_name,
    a.unit,
    COALESCE(SUM(m.in_qty) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS total_in_qty,
    COALESCE(SUM(m.in_value) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS total_in_value,
    COALESCE(SUM(m.out_qty) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS total_out_qty,
    COALESCE(SUM(m.out_value) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS total_out_value,
    COALESCE(SUM(m.in_qty) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) -
    COALESCE(SUM(m.out_qty) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS balance_qty,
    COALESCE(SUM(m.in_value) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) -
    COALESCE(SUM(m.out_value) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS balance_value
  FROM movements m
  JOIN articles a ON a.id = m.article_id
  GROUP BY a.id, a.code, a.name, a.unit
  ORDER BY a.code;
END;
$$;
