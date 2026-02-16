
CREATE OR REPLACE FUNCTION public.get_warehouse_inventory_list(
  p_company_id UUID,
  p_warehouse_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  article_id UUID,
  article_code TEXT,
  article_name TEXT,
  unit TEXT,
  opening_qty NUMERIC,
  in_qty NUMERIC,
  out_qty NUMERIC,
  turnover_qty NUMERIC,
  closing_qty NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH movements AS (
    -- Goods receipts
    SELECT gri.article_id, gri.quantity AS qty_in, 0::NUMERIC AS qty_out, gr.receipt_date AS movement_date
    FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    WHERE gr.company_id = p_company_id AND gr.warehouse_id = p_warehouse_id AND gr.status = 'posted' AND gri.article_id IS NOT NULL
    UNION ALL
    -- Delivery notes (outflow)
    SELECT dni.article_id, 0::NUMERIC, dni.quantity, dn.delivery_date
    FROM delivery_note_items dni JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    WHERE dn.company_id = p_company_id AND dn.warehouse_id = p_warehouse_id AND dn.status = 'posted'
    UNION ALL
    -- Inventory count surplus (inflow)
    SELECT ici.article_id, ici.surplus_qty, 0::NUMERIC, ic.count_date
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.surplus_qty > 0
    UNION ALL
    -- Inventory count deficit (outflow)
    SELECT ici.article_id, 0::NUMERIC, ici.deficit_qty, ic.count_date
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.deficit_qty > 0
    UNION ALL
    -- MMP outflow (source warehouse)
    SELECT iti.article_id, 0::NUMERIC, iti.quantity, iwt.transfer_date
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.source_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    -- MMP inflow (destination warehouse)
    SELECT iti.article_id, iti.quantity, 0::NUMERIC, iwt.transfer_date
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.destination_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    -- Article swap: article_1 storno (outflow)
    SELECT asw.article_1_id, 0::NUMERIC, asw.quantity_1, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    -- Article swap: article_2 (inflow)
    SELECT asw.article_2_id, asw.quantity_2, 0::NUMERIC, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
  )
  SELECT
    a.id AS article_id,
    a.code AS article_code,
    a.name AS article_name,
    a.unit,
    -- Opening balance: all movements BEFORE p_date_from
    COALESCE(SUM(m.qty_in - m.qty_out) FILTER (WHERE p_date_from IS NOT NULL AND m.movement_date < p_date_from), 0) AS opening_qty,
    -- Inflow in period
    COALESCE(SUM(m.qty_in) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS in_qty,
    -- Outflow in period
    COALESCE(SUM(m.qty_out) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS out_qty,
    -- Turnover = in - out in period
    COALESCE(SUM(m.qty_in - m.qty_out) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS turnover_qty,
    -- Closing = opening + turnover
    COALESCE(SUM(m.qty_in - m.qty_out) FILTER (WHERE p_date_from IS NOT NULL AND m.movement_date < p_date_from), 0) +
    COALESCE(SUM(m.qty_in - m.qty_out) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS closing_qty
  FROM movements m
  JOIN articles a ON a.id = m.article_id
  GROUP BY a.id, a.code, a.name, a.unit
  HAVING
    COALESCE(SUM(m.qty_in - m.qty_out) FILTER (WHERE p_date_from IS NOT NULL AND m.movement_date < p_date_from), 0) != 0
    OR COALESCE(SUM(m.qty_in) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) != 0
    OR COALESCE(SUM(m.qty_out) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) != 0
  ORDER BY a.code;
END;
$$;
