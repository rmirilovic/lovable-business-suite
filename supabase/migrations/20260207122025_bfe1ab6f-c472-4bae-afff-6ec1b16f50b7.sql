
-- Fix get_article_warehouse_card to exclude secondary/duplicate goods_receipts
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
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_cost NUMERIC;
BEGIN
  -- Calculate weighted average cost from all posted receipts (only primary ones)
  SELECT CASE WHEN SUM(gri.quantity) > 0 
    THEN ROUND(SUM(gri.quantity * gri.unit_price) / SUM(gri.quantity), 4)
    ELSE 0 
  END
  INTO v_avg_cost
  FROM goods_receipt_items gri
  JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
  WHERE gr.company_id = p_company_id
    AND gr.warehouse_id = p_warehouse_id
    AND gri.article_id = p_article_id
    AND gr.status = 'posted'
    -- Exclude secondary receipts: if linked to a UFR that points to a different primary receipt
    AND NOT EXISTS (
      SELECT 1 FROM goods_purchase_invoices gpi 
      WHERE gpi.id = gr.source_invoice_id 
        AND gpi.goods_receipt_id IS NOT NULL 
        AND gpi.goods_receipt_id != gr.id
    );

  RETURN QUERY
  -- Receipts (incoming = Duguje)
  SELECT 
    gr.receipt_date::DATE,
    'Prijemnica'::TEXT,
    gr.receipt_number::TEXT,
    COALESCE(p.name, '')::TEXT,
    gri.quantity,
    0::NUMERIC,
    gri.unit_price,
    ROUND(gri.quantity * gri.unit_price, 2),
    0::NUMERIC
  FROM goods_receipt_items gri
  JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
  LEFT JOIN partners p ON p.id = gr.partner_id
  WHERE gr.company_id = p_company_id
    AND gr.warehouse_id = p_warehouse_id
    AND gri.article_id = p_article_id
    AND gr.status = 'posted'
    AND (p_date_from IS NULL OR gr.receipt_date::DATE >= p_date_from)
    AND (p_date_to IS NULL OR gr.receipt_date::DATE <= p_date_to)
    -- Exclude secondary receipts
    AND NOT EXISTS (
      SELECT 1 FROM goods_purchase_invoices gpi 
      WHERE gpi.id = gr.source_invoice_id 
        AND gpi.goods_receipt_id IS NOT NULL 
        AND gpi.goods_receipt_id != gr.id
    )
  
  UNION ALL
  
  -- Deliveries (outgoing = Potražuje)
  SELECT 
    dn.delivery_date::DATE,
    'Otpremnica'::TEXT,
    dn.delivery_number::TEXT,
    COALESCE(p.name, '')::TEXT,
    0::NUMERIC,
    dni.quantity,
    v_avg_cost,
    0::NUMERIC,
    ROUND(dni.quantity * v_avg_cost, 2)
  FROM delivery_note_items dni
  JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
  LEFT JOIN partners p ON p.id = dn.partner_id
  WHERE dn.company_id = p_company_id
    AND dn.warehouse_id = p_warehouse_id
    AND dni.article_id = p_article_id
    AND dn.status = 'posted'
    AND (p_date_from IS NULL OR dn.delivery_date::DATE >= p_date_from)
    AND (p_date_to IS NULL OR dn.delivery_date::DATE <= p_date_to)
  
  ORDER BY 1, 2;
END;
$$;

-- Fix get_warehouse_stock to exclude secondary/duplicate goods_receipts
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
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH receipt_totals AS (
    SELECT 
      gri.article_id AS art_id,
      COALESCE(SUM(gri.quantity), 0) AS r_qty,
      COALESCE(SUM(gri.quantity * gri.unit_price), 0) AS r_value
    FROM goods_receipt_items gri
    JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    WHERE gr.company_id = p_company_id
      AND gr.warehouse_id = p_warehouse_id
      AND gr.status = 'posted'
      AND gri.article_id IS NOT NULL
      AND (p_date_from IS NULL OR gr.receipt_date::DATE >= p_date_from)
      AND (p_date_to IS NULL OR gr.receipt_date::DATE <= p_date_to)
      -- Exclude secondary receipts
      AND NOT EXISTS (
        SELECT 1 FROM goods_purchase_invoices gpi 
        WHERE gpi.id = gr.source_invoice_id 
          AND gpi.goods_receipt_id IS NOT NULL 
          AND gpi.goods_receipt_id != gr.id
      )
    GROUP BY gri.article_id
  ),
  delivery_totals AS (
    SELECT 
      dni.article_id AS art_id,
      COALESCE(SUM(dni.quantity), 0) AS d_qty
    FROM delivery_note_items dni
    JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    WHERE dn.company_id = p_company_id
      AND dn.warehouse_id = p_warehouse_id
      AND dn.status = 'posted'
      AND (p_date_from IS NULL OR dn.delivery_date::DATE >= p_date_from)
      AND (p_date_to IS NULL OR dn.delivery_date::DATE <= p_date_to)
    GROUP BY dni.article_id
  ),
  avg_costs AS (
    SELECT 
      gri.article_id AS art_id,
      CASE WHEN SUM(gri.quantity) > 0 
        THEN SUM(gri.quantity * gri.unit_price) / SUM(gri.quantity)
        ELSE 0 
      END AS avg_cost
    FROM goods_receipt_items gri
    JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    WHERE gr.company_id = p_company_id
      AND gr.warehouse_id = p_warehouse_id
      AND gr.status = 'posted'
      AND gri.article_id IS NOT NULL
      -- Exclude secondary receipts for avg cost calculation too
      AND NOT EXISTS (
        SELECT 1 FROM goods_purchase_invoices gpi 
        WHERE gpi.id = gr.source_invoice_id 
          AND gpi.goods_receipt_id IS NOT NULL 
          AND gpi.goods_receipt_id != gr.id
      )
    GROUP BY gri.article_id
  ),
  all_articles AS (
    SELECT art_id FROM receipt_totals
    UNION
    SELECT art_id FROM delivery_totals
  )
  SELECT 
    aa.art_id,
    a.code,
    a.name,
    a.unit,
    COALESCE(rt.r_qty, 0),
    COALESCE(rt.r_value, 0),
    COALESCE(dt.d_qty, 0),
    ROUND(COALESCE(dt.d_qty * COALESCE(ac.avg_cost, 0), 0), 2),
    COALESCE(rt.r_qty, 0) - COALESCE(dt.d_qty, 0),
    ROUND(COALESCE(rt.r_value, 0) - COALESCE(dt.d_qty * COALESCE(ac.avg_cost, 0), 0), 2)
  FROM all_articles aa
  JOIN articles a ON a.id = aa.art_id
  LEFT JOIN receipt_totals rt ON rt.art_id = aa.art_id
  LEFT JOIN delivery_totals dt ON dt.art_id = aa.art_id
  LEFT JOIN avg_costs ac ON ac.art_id = aa.art_id
  ORDER BY a.code;
END;
$$;
