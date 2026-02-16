
CREATE OR REPLACE FUNCTION public.get_warehouse_turnover(
  p_company_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE(
  warehouse_id UUID,
  warehouse_code TEXT,
  warehouse_name TEXT,
  document_type TEXT,
  debit_value NUMERIC,
  credit_value NUMERIC,
  balance_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH movements AS (
    -- Goods receipts (Prijemnice) - only standalone (not linked to calculation)
    SELECT
      gr.warehouse_id,
      'Prijemnica'::TEXT AS doc_type,
      SUM(gri.quantity * gri.unit_price) AS debit_val,
      0::NUMERIC AS credit_val
    FROM goods_receipts gr
    JOIN goods_receipt_items gri ON gri.goods_receipt_id = gr.id AND gri.company_id = gr.company_id
    WHERE gr.company_id = p_company_id
      AND gr.status = 'posted'
      AND gr.linked_calculation_id IS NULL
      AND (p_date_from IS NULL OR gr.receipt_date >= p_date_from)
      AND (p_date_to IS NULL OR gr.receipt_date <= p_date_to)
    GROUP BY gr.warehouse_id

    UNION ALL

    -- Calculations → warehouse via goods_receipt
    SELECT
      gr.warehouse_id,
      'Kalkulacija'::TEXT AS doc_type,
      SUM(ci.selling_value) AS debit_val,
      0::NUMERIC AS credit_val
    FROM purchase_price_calculations ppc
    JOIN goods_receipts gr ON gr.id = ppc.goods_receipt_id
    JOIN calculation_items ci ON ci.calculation_id = ppc.id AND ci.company_id = ppc.company_id
    WHERE ppc.company_id = p_company_id
      AND ppc.status = 'posted'
      AND (p_date_from IS NULL OR ppc.calculation_date >= p_date_from)
      AND (p_date_to IS NULL OR ppc.calculation_date <= p_date_to)
    GROUP BY gr.warehouse_id

    UNION ALL

    -- Nivelacije
    SELECT
      pa.warehouse_id,
      'Nivelacija'::TEXT AS doc_type,
      SUM(CASE WHEN pai.new_value - pai.old_value > 0 THEN pai.new_value - pai.old_value ELSE 0 END) AS debit_val,
      SUM(CASE WHEN pai.new_value - pai.old_value < 0 THEN ABS(pai.new_value - pai.old_value) ELSE 0 END) AS credit_val
    FROM price_adjustments pa
    JOIN price_adjustment_items pai ON pai.price_adjustment_id = pa.id AND pai.company_id = pa.company_id
    WHERE pa.company_id = p_company_id
      AND pa.status = 'posted'
      AND (p_date_from IS NULL OR pa.adjustment_date >= p_date_from)
      AND (p_date_to IS NULL OR pa.adjustment_date <= p_date_to)
    GROUP BY pa.warehouse_id

    UNION ALL

    -- Popis - višak
    SELECT
      ic.warehouse_id,
      'Popis - višak'::TEXT AS doc_type,
      SUM(ici.surplus_value) AS debit_val,
      0::NUMERIC AS credit_val
    FROM inventory_counts ic
    JOIN inventory_count_items ici ON ici.inventory_count_id = ic.id AND ici.company_id = ic.company_id
    WHERE ic.company_id = p_company_id
      AND ic.status = 'posted'
      AND (p_date_from IS NULL OR ic.count_date >= p_date_from)
      AND (p_date_to IS NULL OR ic.count_date <= p_date_to)
    GROUP BY ic.warehouse_id
    HAVING SUM(ici.surplus_value) > 0

    UNION ALL

    -- Popis - manjak
    SELECT
      ic.warehouse_id,
      'Popis - manjak'::TEXT AS doc_type,
      0::NUMERIC AS debit_val,
      SUM(ici.deficit_value) AS credit_val
    FROM inventory_counts ic
    JOIN inventory_count_items ici ON ici.inventory_count_id = ic.id AND ici.company_id = ic.company_id
    WHERE ic.company_id = p_company_id
      AND ic.status = 'posted'
      AND (p_date_from IS NULL OR ic.count_date >= p_date_from)
      AND (p_date_to IS NULL OR ic.count_date <= p_date_to)
    GROUP BY ic.warehouse_id
    HAVING SUM(ici.deficit_value) > 0

    UNION ALL

    -- MMP - izlaz
    SELECT
      iwt.source_warehouse_id AS warehouse_id,
      'MMP - izlaz'::TEXT AS doc_type,
      0::NUMERIC AS debit_val,
      SUM(iwti.quantity * iwti.unit_price) AS credit_val
    FROM inter_warehouse_transfers iwt
    JOIN inter_warehouse_transfer_items iwti ON iwti.transfer_id = iwt.id AND iwti.company_id = iwt.company_id
    WHERE iwt.company_id = p_company_id
      AND iwt.status = 'posted'
      AND (p_date_from IS NULL OR iwt.transfer_date >= p_date_from)
      AND (p_date_to IS NULL OR iwt.transfer_date <= p_date_to)
    GROUP BY iwt.source_warehouse_id

    UNION ALL

    -- MMP - ulaz
    SELECT
      iwt.destination_warehouse_id AS warehouse_id,
      'MMP - ulaz'::TEXT AS doc_type,
      SUM(iwti.quantity * iwti.unit_price) AS debit_val,
      0::NUMERIC AS credit_val
    FROM inter_warehouse_transfers iwt
    JOIN inter_warehouse_transfer_items iwti ON iwti.transfer_id = iwt.id AND iwti.company_id = iwt.company_id
    WHERE iwt.company_id = p_company_id
      AND iwt.status = 'posted'
      AND (p_date_from IS NULL OR iwt.transfer_date >= p_date_from)
      AND (p_date_to IS NULL OR iwt.transfer_date <= p_date_to)
    GROUP BY iwt.destination_warehouse_id

    UNION ALL

    -- Zamena artikla
    SELECT
      asw.warehouse_id,
      'Zamena artikla'::TEXT AS doc_type,
      SUM(asw.quantity_2 * asw.price_2) AS debit_val,
      SUM(asw.quantity_1 * asw.price_1) AS credit_val
    FROM article_swaps asw
    WHERE asw.company_id = p_company_id
      AND asw.status = 'posted'
      AND (p_date_from IS NULL OR asw.swap_date >= p_date_from)
      AND (p_date_to IS NULL OR asw.swap_date <= p_date_to)
    GROUP BY asw.warehouse_id

    UNION ALL

    -- Otpremnice
    SELECT
      dn.warehouse_id,
      'Otpremnica'::TEXT AS doc_type,
      0::NUMERIC AS debit_val,
      SUM(dni.quantity * COALESCE(a.selling_price, 0)) AS credit_val
    FROM delivery_notes dn
    JOIN delivery_note_items dni ON dni.delivery_note_id = dn.id AND dni.company_id = dn.company_id
    LEFT JOIN articles a ON a.id = dni.article_id
    WHERE dn.company_id = p_company_id
      AND dn.status = 'posted'
      AND dn.warehouse_id IS NOT NULL
      AND (p_date_from IS NULL OR dn.delivery_date >= p_date_from)
      AND (p_date_to IS NULL OR dn.delivery_date <= p_date_to)
    GROUP BY dn.warehouse_id
  )
  SELECT
    m.warehouse_id,
    w.code::TEXT AS warehouse_code,
    w.name::TEXT AS warehouse_name,
    m.doc_type AS document_type,
    COALESCE(SUM(m.debit_val), 0) AS debit_value,
    COALESCE(SUM(m.credit_val), 0) AS credit_value,
    COALESCE(SUM(m.debit_val), 0) - COALESCE(SUM(m.credit_val), 0) AS balance_value
  FROM movements m
  JOIN warehouses w ON w.id = m.warehouse_id
  GROUP BY m.warehouse_id, w.code, w.name, m.doc_type
  HAVING COALESCE(SUM(m.debit_val), 0) != 0 OR COALESCE(SUM(m.credit_val), 0) != 0
  ORDER BY w.code, m.doc_type;
END;
$$;
