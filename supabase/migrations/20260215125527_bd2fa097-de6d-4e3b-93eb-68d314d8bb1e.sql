
-- Table for article swaps (Zamena artikla po šifri)
CREATE TABLE public.article_swaps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  swap_number TEXT NOT NULL,
  swap_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  article_1_id UUID NOT NULL REFERENCES public.articles(id),
  article_1_code TEXT NOT NULL,
  article_1_name TEXT NOT NULL,
  article_1_unit TEXT NOT NULL DEFAULT 'kom',
  quantity_1 NUMERIC NOT NULL DEFAULT 0,
  price_1 NUMERIC NOT NULL DEFAULT 0,
  article_2_id UUID NOT NULL REFERENCES public.articles(id),
  article_2_code TEXT NOT NULL,
  article_2_name TEXT NOT NULL,
  article_2_unit TEXT NOT NULL DEFAULT 'kom',
  quantity_2 NUMERIC NOT NULL DEFAULT 0,
  price_2 NUMERIC NOT NULL DEFAULT 0,
  swap_value NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID NOT NULL,
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, swap_number)
);

ALTER TABLE public.article_swaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view article swaps" ON public.article_swaps FOR SELECT
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert article swaps" ON public.article_swaps FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update article swaps" ON public.article_swaps FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete article swaps" ON public.article_swaps FOR DELETE
  USING (has_company_access(auth.uid(), company_id) AND status = 'draft');

CREATE TRIGGER update_article_swaps_updated_at
  BEFORE UPDATE ON public.article_swaps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Get next swap number
CREATE OR REPLACE FUNCTION public.get_next_swap_number(_company_id UUID, _year_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _year_short text; _next_num integer;
BEGIN
  SELECT RIGHT(year::text, 2) INTO _year_short FROM business_years WHERE id = _year_id;
  SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
  FROM (SELECT CAST(SUBSTRING(swap_number FROM '(\d{4})$') AS INTEGER) as seq
    FROM article_swaps WHERE company_id = _company_id AND business_year_id = _year_id
    AND swap_number ~ ('^' || _year_short || '\d{4}$')) t;
  RETURN _year_short || LPAD(_next_num::text, 4, '0');
END; $$;

-- Post article swap
CREATE OR REPLACE FUNCTION public.post_article_swap(_swap_id UUID, _user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_swap article_swaps%ROWTYPE;
BEGIN
  SELECT * INTO v_swap FROM article_swaps WHERE id = _swap_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Zamena nije pronađena'; END IF;
  IF v_swap.status = 'posted' THEN RAISE EXCEPTION 'Dokument je već proknjižen'; END IF;
  IF v_swap.quantity_1 <= 0 OR v_swap.quantity_2 <= 0 THEN RAISE EXCEPTION 'Količine moraju biti veće od 0'; END IF;
  IF v_swap.article_1_id = v_swap.article_2_id THEN RAISE EXCEPTION 'Artikli moraju biti različiti'; END IF;
  UPDATE article_swaps SET status = 'posted', posted_at = now(), posted_by = _user_id, updated_at = now() WHERE id = _swap_id;
  RETURN _swap_id;
END; $$;

-- Unpost article swap
CREATE OR REPLACE FUNCTION public.unpost_article_swap(_swap_id UUID, _user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_swap article_swaps%ROWTYPE;
BEGIN
  SELECT * INTO v_swap FROM article_swaps WHERE id = _swap_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Zamena nije pronađena'; END IF;
  IF v_swap.status != 'posted' THEN RAISE EXCEPTION 'Dokument nije proknjižen'; END IF;
  UPDATE article_swaps SET status = 'draft', posted_at = NULL, posted_by = NULL, updated_at = now() WHERE id = _swap_id;
  RETURN _swap_id;
END; $$;

-- Update get_warehouse_stock to include article swaps
CREATE OR REPLACE FUNCTION public.get_warehouse_stock(p_company_id UUID, p_warehouse_id UUID, p_date_from DATE DEFAULT NULL, p_date_to DATE DEFAULT NULL)
RETURNS TABLE(article_id UUID, article_code TEXT, article_name TEXT, unit TEXT, total_in_qty NUMERIC, total_in_value NUMERIC, total_out_qty NUMERIC, total_out_value NUMERIC, balance_qty NUMERIC, balance_value NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    -- Article swap: article_1 (storno ulaz)
    SELECT asw.article_1_id, -asw.quantity_1, -asw.swap_value, 0::NUMERIC, 0::NUMERIC, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    -- Article swap: article_2 (ulaz)
    SELECT asw.article_2_id, asw.quantity_2, asw.swap_value, 0::NUMERIC, 0::NUMERIC, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
  )
  SELECT a.id AS article_id, a.code AS article_code, a.name AS article_name, a.unit,
    COALESCE(SUM(m.in_qty) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS total_in_qty,
    COALESCE(SUM(m.in_value) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS total_in_value,
    COALESCE(SUM(m.out_qty) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS total_out_qty,
    COALESCE(SUM(m.out_value) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS total_out_value,
    COALESCE(SUM(m.in_qty) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) -
    COALESCE(SUM(m.out_qty) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS balance_qty,
    COALESCE(SUM(m.in_value) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) -
    COALESCE(SUM(m.out_value) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS balance_value
  FROM movements m JOIN articles a ON a.id = m.article_id
  GROUP BY a.id, a.code, a.name, a.unit ORDER BY a.code;
END; $$;

-- Update get_article_warehouse_card to include article swaps
CREATE OR REPLACE FUNCTION public.get_article_warehouse_card(p_company_id UUID, p_warehouse_id UUID, p_article_id UUID, p_date_from DATE DEFAULT NULL, p_date_to DATE DEFAULT NULL)
RETURNS TABLE(movement_date DATE, document_type TEXT, document_number TEXT, partner_name TEXT, in_quantity NUMERIC, out_quantity NUMERIC, unit_price NUMERIC, debit_value NUMERIC, credit_value NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (
    SELECT gr.receipt_date, 'Prijemnica'::TEXT, gr.receipt_number, COALESCE(p.name, '')::TEXT, gri.quantity, 0::NUMERIC, gri.unit_price, (gri.quantity * gri.unit_price), 0::NUMERIC
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
    -- Article swap: article_1 (storno ulaz)
    SELECT asw.swap_date, 'Zamena storno'::TEXT, asw.swap_number, ''::TEXT, -asw.quantity_1, 0::NUMERIC, asw.price_1, -asw.swap_value, 0::NUMERIC
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.article_1_id = p_article_id AND asw.status = 'posted'
      AND (p_date_from IS NULL OR asw.swap_date >= p_date_from) AND (p_date_to IS NULL OR asw.swap_date <= p_date_to)
    UNION ALL
    -- Article swap: article_2 (ulaz)
    SELECT asw.swap_date, 'Zamena ulaz'::TEXT, asw.swap_number, ''::TEXT, asw.quantity_2, 0::NUMERIC, asw.price_2, asw.swap_value, 0::NUMERIC
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.article_2_id = p_article_id AND asw.status = 'posted'
      AND (p_date_from IS NULL OR asw.swap_date >= p_date_from) AND (p_date_to IS NULL OR asw.swap_date <= p_date_to)
  ) sub ORDER BY sub.movement_date, sub.document_type;
END; $$;
