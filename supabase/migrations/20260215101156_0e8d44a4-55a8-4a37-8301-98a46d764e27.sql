
-- Fix get_warehouse_stock: add back inter-warehouse transfer movements
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
SET search_path = public
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
      0::NUMERIC AS in_qty,
      CASE WHEN pai.value_difference > 0 THEN pai.value_difference ELSE 0::NUMERIC END AS in_value,
      0::NUMERIC AS out_qty,
      CASE WHEN pai.value_difference < 0 THEN ABS(pai.value_difference) ELSE 0::NUMERIC END AS out_value,
      pa.adjustment_date AS movement_date
    FROM price_adjustment_items pai
    JOIN price_adjustments pa ON pa.id = pai.price_adjustment_id
    WHERE pa.company_id = p_company_id
      AND pa.warehouse_id = p_warehouse_id
      AND pa.status = 'posted'

    UNION ALL

    -- Inter-warehouse transfer: source warehouse (storno ulaz = negative inflow)
    SELECT
      iti.article_id,
      -iti.quantity AS in_qty,
      -(iti.quantity * iti.unit_price) AS in_value,
      0::NUMERIC AS out_qty,
      0::NUMERIC AS out_value,
      iwt.transfer_date AS movement_date
    FROM inter_warehouse_transfer_items iti
    JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id
      AND iwt.source_warehouse_id = p_warehouse_id
      AND iwt.status = 'posted'

    UNION ALL

    -- Inter-warehouse transfer: destination warehouse (positive inflow)
    SELECT
      iti.article_id,
      iti.quantity AS in_qty,
      iti.quantity * iti.unit_price AS in_value,
      0::NUMERIC AS out_qty,
      0::NUMERIC AS out_value,
      iwt.transfer_date AS movement_date
    FROM inter_warehouse_transfer_items iti
    JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id
      AND iwt.destination_warehouse_id = p_warehouse_id
      AND iwt.status = 'posted'
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

-- Fix get_article_warehouse_card: add back inter-warehouse transfer movements
-- Both source and destination appear in "Ulaz" column (negative for source = storno, positive for destination)
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
SET search_path = public
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

    UNION ALL

    -- Inter-warehouse transfer: SOURCE warehouse (storno ulaz - negative in_quantity, negative debit)
    SELECT
      iwt.transfer_date AS movement_date,
      'MMP izlaz'::TEXT AS document_type,
      iwt.transfer_number AS document_number,
      ''::TEXT AS partner_name,
      -iti.quantity AS in_quantity,
      0::NUMERIC AS out_quantity,
      iti.unit_price AS unit_price,
      -(iti.quantity * iti.unit_price) AS debit_value,
      0::NUMERIC AS credit_value
    FROM inter_warehouse_transfer_items iti
    JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id
      AND iwt.source_warehouse_id = p_warehouse_id
      AND iti.article_id = p_article_id
      AND iwt.status = 'posted'
      AND (p_date_from IS NULL OR iwt.transfer_date >= p_date_from)
      AND (p_date_to IS NULL OR iwt.transfer_date <= p_date_to)

    UNION ALL

    -- Inter-warehouse transfer: DESTINATION warehouse (positive ulaz)
    SELECT
      iwt.transfer_date AS movement_date,
      'MMP ulaz'::TEXT AS document_type,
      iwt.transfer_number AS document_number,
      ''::TEXT AS partner_name,
      iti.quantity AS in_quantity,
      0::NUMERIC AS out_quantity,
      iti.unit_price AS unit_price,
      (iti.quantity * iti.unit_price) AS debit_value,
      0::NUMERIC AS credit_value
    FROM inter_warehouse_transfer_items iti
    JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id
      AND iwt.destination_warehouse_id = p_warehouse_id
      AND iti.article_id = p_article_id
      AND iwt.status = 'posted'
      AND (p_date_from IS NULL OR iwt.transfer_date >= p_date_from)
      AND (p_date_to IS NULL OR iwt.transfer_date <= p_date_to)
  ) sub
  ORDER BY sub.movement_date, sub.document_type;
END;
$$;
