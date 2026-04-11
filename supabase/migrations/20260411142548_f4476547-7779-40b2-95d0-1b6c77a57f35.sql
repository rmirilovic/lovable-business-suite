
-- 1. Create article_variants table (šifarnik varijanti)
CREATE TABLE public.article_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  length_value NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

ALTER TABLE public.article_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view article variants" ON public.article_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert article variants" ON public.article_variants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update article variants" ON public.article_variants FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete article variants" ON public.article_variants FOR DELETE TO authenticated USING (true);

-- 2. Create article_variant_assignments (many-to-many)
CREATE TABLE public.article_variant_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES article_variants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, article_id, variant_id)
);

ALTER TABLE public.article_variant_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage article variant assignments" ON public.article_variant_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Add variant_id to all warehouse document item tables
ALTER TABLE public.goods_receipt_items ADD COLUMN variant_id UUID REFERENCES article_variants(id);
ALTER TABLE public.delivery_note_items ADD COLUMN variant_id UUID REFERENCES article_variants(id);
ALTER TABLE public.inter_warehouse_transfer_items ADD COLUMN variant_id UUID REFERENCES article_variants(id);
ALTER TABLE public.inventory_count_items ADD COLUMN variant_id UUID REFERENCES article_variants(id);
ALTER TABLE public.price_adjustment_items ADD COLUMN variant_id UUID REFERENCES article_variants(id);
ALTER TABLE public.production_delivery_note_items ADD COLUMN variant_id UUID REFERENCES article_variants(id);
ALTER TABLE public.reprocessing_delivery_note_items ADD COLUMN variant_id UUID REFERENCES article_variants(id);
ALTER TABLE public.material_requisition_items ADD COLUMN variant_id UUID REFERENCES article_variants(id);
ALTER TABLE public.reprocessing_wo_input_items ADD COLUMN variant_id UUID REFERENCES article_variants(id);
ALTER TABLE public.reprocessing_wo_materials ADD COLUMN variant_id UUID REFERENCES article_variants(id);
ALTER TABLE public.warehouse_reservations ADD COLUMN variant_id UUID REFERENCES article_variants(id);

-- 4. Create variant_swaps table (zamena varijante dokument)
CREATE TABLE public.variant_swaps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  business_year_id UUID NOT NULL REFERENCES business_years(id),
  swap_number TEXT NOT NULL,
  swap_date DATE NOT NULL DEFAULT CURRENT_DATE,
  article_id UUID NOT NULL REFERENCES articles(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  source_variant_id UUID REFERENCES article_variants(id),
  target_variant_id UUID NOT NULL REFERENCES article_variants(id),
  quantity NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  UNIQUE(company_id, business_year_id, swap_number)
);

ALTER TABLE public.variant_swaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage variant swaps" ON public.variant_swaps FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. New RPC: get_warehouse_stock_by_variant
CREATE OR REPLACE FUNCTION public.get_warehouse_stock_by_variant(
  p_company_id UUID,
  p_warehouse_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE(
  article_id UUID, article_code TEXT, article_name TEXT, unit TEXT,
  variant_id UUID, variant_code TEXT, variant_description TEXT,
  total_in_qty NUMERIC, total_in_value NUMERIC,
  total_out_qty NUMERIC, total_out_value NUMERIC,
  balance_qty NUMERIC, balance_value NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH movements AS (
    -- Goods receipts
    SELECT gri.article_id, gri.variant_id AS vid, gri.quantity AS in_qty, gri.quantity * gri.unit_price AS in_value, 0::NUMERIC AS out_qty, 0::NUMERIC AS out_value, gr.receipt_date AS movement_date
    FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    WHERE gr.company_id = p_company_id AND gr.warehouse_id = p_warehouse_id AND gr.status = 'posted' AND gri.article_id IS NOT NULL
    UNION ALL
    -- Delivery notes (out)
    SELECT dni.article_id, dni.variant_id, 0::NUMERIC, 0::NUMERIC, dni.quantity, dni.line_value, dn.delivery_date
    FROM delivery_note_items dni JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    WHERE dn.company_id = p_company_id AND dn.warehouse_id = p_warehouse_id AND dn.status = 'posted'
    UNION ALL
    -- Inventory count surplus
    SELECT ici.article_id, ici.variant_id, ici.surplus_qty, ici.surplus_value, 0::NUMERIC, 0::NUMERIC, ic.count_date
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.surplus_qty > 0
    UNION ALL
    -- Inventory count deficit
    SELECT ici.article_id, ici.variant_id, 0::NUMERIC, 0::NUMERIC, ici.deficit_qty, ici.deficit_value, ic.count_date
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.deficit_qty > 0
    UNION ALL
    -- Price adjustments (value only)
    SELECT pai.article_id, pai.variant_id, 0::NUMERIC,
      CASE WHEN pai.value_difference > 0 THEN pai.value_difference ELSE 0::NUMERIC END,
      0::NUMERIC,
      CASE WHEN pai.value_difference < 0 THEN ABS(pai.value_difference) ELSE 0::NUMERIC END,
      pa.adjustment_date
    FROM price_adjustment_items pai JOIN price_adjustments pa ON pa.id = pai.price_adjustment_id
    WHERE pa.company_id = p_company_id AND pa.warehouse_id = p_warehouse_id AND pa.status = 'posted'
    UNION ALL
    -- Transfers out (source warehouse)
    SELECT iti.article_id, iti.variant_id, -iti.quantity, -(iti.quantity * iti.unit_price), 0::NUMERIC, 0::NUMERIC, iwt.transfer_date
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.source_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    -- Transfers in (destination warehouse)
    SELECT iti.article_id, iti.variant_id, iti.quantity, iti.quantity * iti.unit_price, 0::NUMERIC, 0::NUMERIC, iwt.transfer_date
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.destination_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    -- Article swaps (storno - no variant)
    SELECT asw.article_1_id, NULL::UUID, -asw.quantity_1, -asw.swap_value, 0::NUMERIC, 0::NUMERIC, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    -- Article swaps (add - no variant)
    SELECT asw.article_2_id, NULL::UUID, asw.quantity_2, asw.swap_value, 0::NUMERIC, 0::NUMERIC, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    -- Production delivery notes
    SELECT pdni.article_id, pdni.variant_id, pdni.delivered_kg, pdni.item_value, 0::NUMERIC, 0::NUMERIC, pdn.delivery_date
    FROM production_delivery_note_items pdni JOIN production_delivery_notes pdn ON pdn.id = pdni.delivery_note_id
    WHERE pdn.company_id = p_company_id AND pdn.warehouse_id = p_warehouse_id AND pdn.status = 'posted'
    UNION ALL
    -- Reprocessing delivery notes
    SELECT rdni.article_id, rdni.variant_id, rdni.delivered_kg, rdni.item_value, 0::NUMERIC, 0::NUMERIC, rdn.delivery_date::DATE
    FROM reprocessing_delivery_note_items rdni JOIN reprocessing_delivery_notes rdn ON rdn.id = rdni.delivery_note_id
    WHERE rdn.company_id = p_company_id AND rdn.warehouse_id = p_warehouse_id AND rdn.status = 'posted'
    UNION ALL
    -- Reprocessing work orders input (out from warehouse)
    SELECT rwi.article_id, rwi.variant_id, -rwi.quantity, -rwi.item_value, 0::NUMERIC, 0::NUMERIC, rwo.order_date::DATE
    FROM reprocessing_wo_input_items rwi JOIN reprocessing_work_orders rwo ON rwo.id = rwi.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed' AND COALESCE(rwi.warehouse_id, rwo.warehouse_id) = p_warehouse_id
    UNION ALL
    -- Reprocessing work orders materials (out from warehouse)
    SELECT rwm.article_id, rwm.variant_id, 0::NUMERIC, 0::NUMERIC, rwm.quantity, rwm.item_value, rwo.order_date::DATE
    FROM reprocessing_wo_materials rwm JOIN reprocessing_work_orders rwo ON rwo.id = rwm.work_order_id
    WHERE rwo.company_id = p_company_id AND rwo.status = 'closed' AND COALESCE(rwm.warehouse_id, rwo.warehouse_id) = p_warehouse_id
    UNION ALL
    -- Material requisitions (out)
    SELECT mri.article_id, mri.variant_id, 0::NUMERIC, 0::NUMERIC, mri.quantity, mri.quantity * mri.unit_price, mr.requisition_date
    FROM material_requisition_items mri JOIN material_requisitions mr ON mr.id = mri.requisition_id
    WHERE mr.company_id = p_company_id AND mr.status = 'posted' AND mr.warehouse_id = p_warehouse_id
    UNION ALL
    -- Variant swaps (source out)
    SELECT vs.article_id, vs.source_variant_id, 0::NUMERIC, 0::NUMERIC, vs.quantity, 0::NUMERIC, vs.swap_date
    FROM variant_swaps vs WHERE vs.company_id = p_company_id AND vs.warehouse_id = p_warehouse_id AND vs.status = 'posted'
    UNION ALL
    -- Variant swaps (target in)
    SELECT vs.article_id, vs.target_variant_id, vs.quantity, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, vs.swap_date
    FROM variant_swaps vs WHERE vs.company_id = p_company_id AND vs.warehouse_id = p_warehouse_id AND vs.status = 'posted'
  ),
  aggregated AS (
    SELECT m.article_id, m.vid,
      SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN GREATEST(m.in_qty, 0) ELSE 0 END) AS v_total_in_qty,
      SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN GREATEST(m.in_value, 0) ELSE 0 END) AS v_total_in_value,
      SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN m.out_qty ELSE 0 END) AS v_total_out_qty,
      SUM(CASE WHEN (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to) THEN m.out_value ELSE 0 END) AS v_total_out_value,
      SUM(m.in_qty) - SUM(m.out_qty) AS v_balance_qty,
      SUM(m.in_value) - SUM(m.out_value) AS v_balance_value
    FROM movements m
    WHERE p_date_to IS NULL OR m.movement_date <= p_date_to
    GROUP BY m.article_id, m.vid
  )
  SELECT a.id, a.code, a.name, a.unit,
    agg.vid, COALESCE(av.code, '')::TEXT, COALESCE(av.description, '')::TEXT,
    agg.v_total_in_qty, agg.v_total_in_value,
    agg.v_total_out_qty, agg.v_total_out_value,
    agg.v_balance_qty, agg.v_balance_value
  FROM aggregated agg
  JOIN articles a ON a.id = agg.article_id
  LEFT JOIN article_variants av ON av.id = agg.vid
  ORDER BY a.code, COALESCE(av.code, '');
END;
$$;
