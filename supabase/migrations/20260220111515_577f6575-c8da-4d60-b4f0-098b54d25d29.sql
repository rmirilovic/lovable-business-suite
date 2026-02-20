
-- Drop existing functions first to avoid parameter default conflicts
DROP FUNCTION IF EXISTS public.get_warehouse_stock(uuid, uuid, date, date);
DROP FUNCTION IF EXISTS public.get_article_warehouse_card(uuid, uuid, uuid, date, date);
DROP FUNCTION IF EXISTS public.get_warehouse_inventory_list(uuid, uuid, date, date);
DROP FUNCTION IF EXISTS public.get_warehouse_turnover(uuid, date, date);

-- ==========================================
-- 1. get_warehouse_stock
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_warehouse_stock(
  p_company_id uuid, p_warehouse_id uuid, p_date_from date DEFAULT NULL, p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  article_id uuid, article_code text, article_name text, unit text,
  total_in_qty numeric, total_in_value numeric,
  total_out_qty numeric, total_out_value numeric,
  balance_qty numeric, balance_value numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  RETURN QUERY
  WITH movements AS (
    SELECT gri.article_id, gri.quantity AS in_qty, gri.quantity * gri.unit_price AS in_value, 0::NUMERIC AS out_qty, 0::NUMERIC AS out_value, gr.receipt_date AS movement_date
    FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    WHERE gr.company_id = p_company_id AND gr.warehouse_id = p_warehouse_id AND gr.status = 'posted' AND gri.article_id IS NOT NULL
    UNION ALL
    SELECT dni.article_id, 0::NUMERIC, 0::NUMERIC, dni.quantity, 0::NUMERIC, dn.delivery_date
    FROM delivery_note_items dni JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    WHERE dn.company_id = p_company_id AND dn.warehouse_id = p_warehouse_id AND dn.status = 'posted'
    UNION ALL
    SELECT ici.article_id, ici.surplus_qty, ici.surplus_value, 0::NUMERIC, 0::NUMERIC, ic.count_date
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.surplus_qty > 0
    UNION ALL
    SELECT ici.article_id, 0::NUMERIC, 0::NUMERIC, ici.deficit_qty, ici.deficit_value, ic.count_date
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.deficit_qty > 0
    UNION ALL
    SELECT pai.article_id, 0::NUMERIC, CASE WHEN pai.value_difference > 0 THEN pai.value_difference ELSE 0::NUMERIC END, 0::NUMERIC, CASE WHEN pai.value_difference < 0 THEN ABS(pai.value_difference) ELSE 0::NUMERIC END, pa.adjustment_date
    FROM price_adjustment_items pai JOIN price_adjustments pa ON pa.id = pai.price_adjustment_id
    WHERE pa.company_id = p_company_id AND pa.warehouse_id = p_warehouse_id AND pa.status = 'posted'
    UNION ALL
    SELECT iti.article_id, -iti.quantity, -(iti.quantity * iti.unit_price), 0::NUMERIC, 0::NUMERIC, iwt.transfer_date
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.source_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    SELECT iti.article_id, iti.quantity, iti.quantity * iti.unit_price, 0::NUMERIC, 0::NUMERIC, iwt.transfer_date
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.destination_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    SELECT asw.article_1_id, -asw.quantity_1, -asw.swap_value, 0::NUMERIC, 0::NUMERIC, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    SELECT asw.article_2_id, asw.quantity_2, asw.swap_value, 0::NUMERIC, 0::NUMERIC, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    SELECT pdni.article_id, pdni.delivered_kg, pdni.item_value, 0::NUMERIC, 0::NUMERIC, pdn.delivery_date
    FROM production_delivery_note_items pdni JOIN production_delivery_notes pdn ON pdn.id = pdni.delivery_note_id
    WHERE pdn.company_id = p_company_id AND pdn.warehouse_id = p_warehouse_id AND pdn.status = 'posted'
    UNION ALL
    SELECT rdni.article_id, rdni.delivered_kg, rdni.item_value, 0::NUMERIC, 0::NUMERIC, rdn.delivery_date::DATE
    FROM reprocessing_delivery_note_items rdni JOIN reprocessing_delivery_notes rdn ON rdn.id = rdni.delivery_note_id
    WHERE rdn.company_id = p_company_id AND rdn.warehouse_id = p_warehouse_id AND rdn.status = 'posted'
    UNION ALL
    -- Reprocessing WO: consumed GP (negative input on GP warehouse)
    SELECT rwi.article_id, -rwi.quantity, -rwi.item_value, 0::NUMERIC, 0::NUMERIC, rwo.order_date::DATE
    FROM reprocessing_wo_input_items rwi JOIN reprocessing_work_orders rwo ON rwo.id = rwi.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed'
      AND COALESCE(rwi.warehouse_id, rwo.warehouse_id) = p_warehouse_id
    UNION ALL
    -- Reprocessing WO: consumed materials (output on material warehouse)
    SELECT rwm.article_id, 0::NUMERIC, 0::NUMERIC, rwm.quantity, rwm.item_value, rwo.order_date::DATE
    FROM reprocessing_wo_materials rwm JOIN reprocessing_work_orders rwo ON rwo.id = rwm.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed'
      AND COALESCE(rwm.warehouse_id, rwo.warehouse_id) = p_warehouse_id
  )
  SELECT a.id, a.code, a.name, a.unit,
    COALESCE(SUM(m.in_qty) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0),
    COALESCE(SUM(m.in_value) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0),
    COALESCE(SUM(m.out_qty) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0),
    COALESCE(SUM(m.out_value) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0),
    COALESCE(SUM(m.in_qty) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) -
    COALESCE(SUM(m.out_qty) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0),
    COALESCE(SUM(m.in_value) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) -
    COALESCE(SUM(m.out_value) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0)
  FROM movements m JOIN articles a ON a.id = m.article_id
  GROUP BY a.id, a.code, a.name, a.unit
  ORDER BY a.code;
END;
$fn$;

-- ==========================================
-- 2. get_article_warehouse_card
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_article_warehouse_card(
  p_company_id uuid, p_warehouse_id uuid, p_article_id uuid, p_date_from date DEFAULT NULL, p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  movement_date date, document_type text, document_number text, partner_name text,
  in_quantity numeric, out_quantity numeric, unit_price numeric,
  debit_value numeric, credit_value numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
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
    UNION ALL
    -- Reprocessing WO: consumed GP (negative input = ulaz u minus, dugovna strana)
    SELECT rwo.order_date::DATE, 'RN prerada - GP'::TEXT, rwo.order_number, ''::TEXT, -rwi.quantity, 0::NUMERIC, rwi.unit_price, -rwi.item_value, 0::NUMERIC
    FROM reprocessing_wo_input_items rwi JOIN reprocessing_work_orders rwo ON rwo.id = rwi.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed' AND rwi.article_id = p_article_id
      AND COALESCE(rwi.warehouse_id, rwo.warehouse_id) = p_warehouse_id
      AND (p_date_from IS NULL OR rwo.order_date::DATE >= p_date_from) AND (p_date_to IS NULL OR rwo.order_date::DATE <= p_date_to)
    UNION ALL
    -- Reprocessing WO: consumed materials (output = izlaz, potražna strana)
    SELECT rwo.order_date::DATE, 'RN prerada - mat.'::TEXT, rwo.order_number, ''::TEXT, 0::NUMERIC, rwm.quantity, rwm.unit_price, 0::NUMERIC, rwm.item_value
    FROM reprocessing_wo_materials rwm JOIN reprocessing_work_orders rwo ON rwo.id = rwm.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed' AND rwm.article_id = p_article_id
      AND COALESCE(rwm.warehouse_id, rwo.warehouse_id) = p_warehouse_id
      AND (p_date_from IS NULL OR rwo.order_date::DATE >= p_date_from) AND (p_date_to IS NULL OR rwo.order_date::DATE <= p_date_to)
  ) sub
  ORDER BY sub.movement_date, sub.document_type;
END;
$fn$;

-- ==========================================
-- 3. get_warehouse_inventory_list
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_warehouse_inventory_list(
  p_company_id uuid, p_warehouse_id uuid, p_date_from date DEFAULT NULL, p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  article_id uuid, article_code text, article_name text, unit text,
  opening numeric, period_in numeric, period_out numeric, turnover numeric, closing numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  RETURN QUERY
  WITH movements AS (
    SELECT gri.article_id AS aid, gri.quantity AS mq, gr.receipt_date AS md, 'in' AS dir
    FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    WHERE gr.company_id = p_company_id AND gr.warehouse_id = p_warehouse_id AND gr.status = 'posted' AND gri.article_id IS NOT NULL
    UNION ALL
    SELECT dni.article_id, dni.quantity, dn.delivery_date, 'out'
    FROM delivery_note_items dni JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    WHERE dn.company_id = p_company_id AND dn.warehouse_id = p_warehouse_id AND dn.status = 'posted'
    UNION ALL
    SELECT ici.article_id, ici.surplus_qty, ic.count_date, 'in'
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.surplus_qty > 0
    UNION ALL
    SELECT ici.article_id, ici.deficit_qty, ic.count_date, 'out'
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.deficit_qty > 0
    UNION ALL
    SELECT iti.article_id, -iti.quantity, iwt.transfer_date, 'in'
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.source_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    SELECT iti.article_id, iti.quantity, iwt.transfer_date, 'in'
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.destination_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    SELECT asw.article_1_id, -asw.quantity_1, asw.swap_date, 'in'
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    SELECT asw.article_2_id, asw.quantity_2, asw.swap_date, 'in'
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    SELECT pdni.article_id, pdni.delivered_kg, pdn.delivery_date, 'in'
    FROM production_delivery_note_items pdni JOIN production_delivery_notes pdn ON pdn.id = pdni.delivery_note_id
    WHERE pdn.company_id = p_company_id AND pdn.warehouse_id = p_warehouse_id AND pdn.status = 'posted'
    UNION ALL
    SELECT rdni.article_id, rdni.delivered_kg, rdn.delivery_date::DATE, 'in'
    FROM reprocessing_delivery_note_items rdni JOIN reprocessing_delivery_notes rdn ON rdn.id = rdni.delivery_note_id
    WHERE rdn.company_id = p_company_id AND rdn.warehouse_id = p_warehouse_id AND rdn.status = 'posted'
    UNION ALL
    -- Reprocessing WO: consumed GP (negative input)
    SELECT rwi.article_id, -rwi.quantity, rwo.order_date::DATE, 'in'
    FROM reprocessing_wo_input_items rwi JOIN reprocessing_work_orders rwo ON rwo.id = rwi.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed'
      AND COALESCE(rwi.warehouse_id, rwo.warehouse_id) = p_warehouse_id
    UNION ALL
    -- Reprocessing WO: consumed materials (output)
    SELECT rwm.article_id, rwm.quantity, rwo.order_date::DATE, 'out'
    FROM reprocessing_wo_materials rwm JOIN reprocessing_work_orders rwo ON rwo.id = rwm.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed'
      AND COALESCE(rwm.warehouse_id, rwo.warehouse_id) = p_warehouse_id
  ),
  article_movements AS (
    SELECT m.aid,
      COALESCE(SUM(CASE WHEN m.dir = 'in' THEN m.mq ELSE 0 END) FILTER (WHERE p_date_from IS NOT NULL AND m.md < p_date_from), 0) -
      COALESCE(SUM(CASE WHEN m.dir = 'out' THEN m.mq ELSE 0 END) FILTER (WHERE p_date_from IS NOT NULL AND m.md < p_date_from), 0) AS opening,
      COALESCE(SUM(CASE WHEN m.dir = 'in' THEN m.mq ELSE 0 END) FILTER (WHERE (p_date_from IS NULL OR m.md >= p_date_from) AND (p_date_to IS NULL OR m.md <= p_date_to)), 0) AS period_in,
      COALESCE(SUM(CASE WHEN m.dir = 'out' THEN m.mq ELSE 0 END) FILTER (WHERE (p_date_from IS NULL OR m.md >= p_date_from) AND (p_date_to IS NULL OR m.md <= p_date_to)), 0) AS period_out
    FROM movements m GROUP BY m.aid
  )
  SELECT a.id, a.code, a.name, a.unit,
    am.opening,
    am.period_in,
    am.period_out,
    am.period_in + am.period_out AS turnover,
    am.opening + am.period_in - am.period_out AS closing
  FROM article_movements am JOIN articles a ON a.id = am.aid
  ORDER BY a.code;
END;
$fn$;

-- ==========================================
-- 4. get_warehouse_turnover
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_warehouse_turnover(
  p_company_id uuid, p_date_from date DEFAULT NULL, p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  warehouse_id uuid, warehouse_code text, warehouse_name text,
  doc_type text, debit_value numeric, credit_value numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
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
      AND (p_date_from IS NULL OR rdn.delivery_date >= p_date_from) AND (p_date_to IS NULL OR rdn.delivery_date <= p_date_to)
    GROUP BY rdn.warehouse_id
    UNION ALL
    -- Reprocessing WO: consumed GP (negative debit on GP warehouse)
    SELECT COALESCE(rwi.warehouse_id, rwo.warehouse_id), 'RN prerada - GP'::TEXT, -SUM(rwi.item_value), 0::NUMERIC
    FROM reprocessing_work_orders rwo JOIN reprocessing_wo_input_items rwi ON rwi.work_order_id = rwo.id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed'
      AND (p_date_from IS NULL OR rwo.order_date::DATE >= p_date_from) AND (p_date_to IS NULL OR rwo.order_date::DATE <= p_date_to)
    GROUP BY COALESCE(rwi.warehouse_id, rwo.warehouse_id)
    UNION ALL
    -- Reprocessing WO: consumed materials (credit/output on material warehouse)
    SELECT COALESCE(rwm.warehouse_id, rwo.warehouse_id), 'RN prerada - mat.'::TEXT, 0::NUMERIC, SUM(rwm.item_value)
    FROM reprocessing_work_orders rwo JOIN reprocessing_wo_materials rwm ON rwm.work_order_id = rwo.id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed'
      AND (p_date_from IS NULL OR rwo.order_date::DATE >= p_date_from) AND (p_date_to IS NULL OR rwo.order_date::DATE <= p_date_to)
    GROUP BY COALESCE(rwm.warehouse_id, rwo.warehouse_id)
  )
  SELECT m.warehouse_id, w.code, w.name, m.doc_type, m.debit_val, m.credit_val
  FROM movements m JOIN warehouses w ON w.id = m.warehouse_id
  ORDER BY w.code, m.doc_type;
END;
$fn$;
