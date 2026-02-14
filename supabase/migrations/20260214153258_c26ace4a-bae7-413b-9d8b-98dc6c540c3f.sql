
-- ═══════════════════════════════════════════════════════════════════
-- Inventory Counts (Popisne liste) - Tables, RLS, Functions
-- ═══════════════════════════════════════════════════════════════════

-- 1. Header table
CREATE TABLE public.inventory_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  count_number TEXT NOT NULL,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by UUID NOT NULL,
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, business_year_id, count_number)
);

-- 2. Items table
CREATE TABLE public.inventory_count_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_count_id UUID NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  article_id UUID NOT NULL REFERENCES public.articles(id),
  item_order INT NOT NULL DEFAULT 0,
  item_code TEXT,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kom',
  book_quantity NUMERIC NOT NULL DEFAULT 0,
  counted_quantity NUMERIC NOT NULL DEFAULT 0,
  surplus_qty NUMERIC NOT NULL DEFAULT 0,
  deficit_qty NUMERIC NOT NULL DEFAULT 0,
  price NUMERIC NOT NULL DEFAULT 0,
  surplus_value NUMERIC NOT NULL DEFAULT 0,
  deficit_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for inventory_counts
CREATE POLICY "Users can view inventory counts for their companies"
  ON public.inventory_counts FOR SELECT
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert inventory counts for their companies"
  ON public.inventory_counts FOR INSERT
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update inventory counts for their companies"
  ON public.inventory_counts FOR UPDATE
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete draft inventory counts for their companies"
  ON public.inventory_counts FOR DELETE
  USING (status = 'draft' AND public.has_company_access(auth.uid(), company_id));

-- 5. RLS Policies for inventory_count_items
CREATE POLICY "Users can view inventory count items for their companies"
  ON public.inventory_count_items FOR SELECT
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert inventory count items for their companies"
  ON public.inventory_count_items FOR INSERT
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update inventory count items for their companies"
  ON public.inventory_count_items FOR UPDATE
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete inventory count items for their companies"
  ON public.inventory_count_items FOR DELETE
  USING (public.has_company_access(auth.uid(), company_id));

-- 6. Updated_at trigger
CREATE TRIGGER update_inventory_counts_updated_at
  BEFORE UPDATE ON public.inventory_counts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Next number function
CREATE OR REPLACE FUNCTION public.get_next_inventory_count_number(
  _company_id UUID,
  _year_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT;
  v_prefix TEXT;
  v_max_num INT;
  v_next TEXT;
BEGIN
  SELECT year INTO v_year FROM business_years WHERE id = _year_id;
  v_prefix := RIGHT(v_year::TEXT, 2);

  SELECT COALESCE(MAX(RIGHT(count_number, 4)::INT), 0)
  INTO v_max_num
  FROM inventory_counts
  WHERE company_id = _company_id
    AND business_year_id = _year_id;

  v_next := v_prefix || LPAD((v_max_num + 1)::TEXT, 4, '0');
  RETURN v_next;
END;
$$;

-- 8. Post inventory count function
CREATE OR REPLACE FUNCTION public.post_inventory_count(
  _count_id UUID,
  _user_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ic RECORD;
  v_item RECORD;
  v_surplus_total NUMERIC := 0;
  v_deficit_total NUMERIC := 0;
  v_je_id UUID;
  v_entry_number TEXT;
  v_inventory_account TEXT;
  v_item_order INT := 0;
BEGIN
  SELECT ic.*, w.inventory_account, w.code as warehouse_code
  INTO v_ic
  FROM inventory_counts ic
  JOIN warehouses w ON w.id = ic.warehouse_id
  WHERE ic.id = _count_id;

  IF v_ic IS NULL THEN
    RAISE EXCEPTION 'Popisna lista nije pronađena';
  END IF;
  IF v_ic.status = 'posted' THEN
    RAISE EXCEPTION 'Popisna lista je već proknjižena';
  END IF;

  v_inventory_account := COALESCE(v_ic.inventory_account, '1320');

  -- Calculate totals
  SELECT COALESCE(SUM(surplus_value), 0), COALESCE(SUM(deficit_value), 0)
  INTO v_surplus_total, v_deficit_total
  FROM inventory_count_items
  WHERE inventory_count_id = _count_id;

  -- Create journal entry if there are any differences
  IF v_surplus_total > 0 OR v_deficit_total > 0 THEN
    v_entry_number := 'POP' || v_ic.count_number;

    INSERT INTO journal_entries (
      company_id, business_year_id, entry_number, entry_date,
      description, status, total_debit, total_credit,
      source_document_type, source_document_id, created_by,
      posted_at, posted_by
    ) VALUES (
      v_ic.company_id, v_ic.business_year_id, v_entry_number, v_ic.count_date,
      'Popis ' || v_ic.count_number || ' - Magacin ' || v_ic.warehouse_code,
      'posted', v_surplus_total + v_deficit_total, v_surplus_total + v_deficit_total,
      'inventory_count', _count_id, _user_id,
      now(), _user_id
    ) RETURNING id INTO v_je_id;

    -- Surplus: Debit inventory account, Credit 6790
    IF v_surplus_total > 0 THEN
      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount)
      VALUES (v_je_id, v_ic.company_id, v_inventory_account, v_item_order,
        'Višak po popisu ' || v_ic.count_number, v_surplus_total, 0);

      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount)
      VALUES (v_je_id, v_ic.company_id, '6790', v_item_order,
        'Višak po popisu ' || v_ic.count_number, 0, v_surplus_total);
    END IF;

    -- Deficit: Debit 5790, Credit inventory account
    IF v_deficit_total > 0 THEN
      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount)
      VALUES (v_je_id, v_ic.company_id, '5790', v_item_order,
        'Manjak po popisu ' || v_ic.count_number, v_deficit_total, 0);

      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount)
      VALUES (v_je_id, v_ic.company_id, v_inventory_account, v_item_order,
        'Manjak po popisu ' || v_ic.count_number, 0, v_deficit_total);
    END IF;

    UPDATE inventory_counts
    SET status = 'posted', posted_at = now(), posted_by = _user_id, journal_entry_id = v_je_id
    WHERE id = _count_id;
  ELSE
    UPDATE inventory_counts
    SET status = 'posted', posted_at = now(), posted_by = _user_id
    WHERE id = _count_id;
  END IF;
END;
$$;

-- 9. Unpost inventory count function
CREATE OR REPLACE FUNCTION public.unpost_inventory_count(
  _count_id UUID,
  _user_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ic RECORD;
BEGIN
  SELECT * INTO v_ic FROM inventory_counts WHERE id = _count_id;

  IF v_ic IS NULL THEN
    RAISE EXCEPTION 'Popisna lista nije pronađena';
  END IF;
  IF v_ic.status != 'posted' THEN
    RAISE EXCEPTION 'Popisna lista nije proknjižena';
  END IF;

  -- Delete journal entry if exists
  IF v_ic.journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_ic.journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_ic.journal_entry_id;
  END IF;

  UPDATE inventory_counts
  SET status = 'draft', posted_at = NULL, posted_by = NULL, journal_entry_id = NULL
  WHERE id = _count_id;
END;
$$;

-- 10. Update get_warehouse_stock to include inventory count movements
-- We need to add surplus (as inflow) and deficit (as outflow) from posted inventory counts
CREATE OR REPLACE FUNCTION public.get_warehouse_stock(
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

-- 11. Update get_article_warehouse_card to include inventory count movements
CREATE OR REPLACE FUNCTION public.get_article_warehouse_card(
  p_company_id UUID,
  p_warehouse_id UUID,
  p_article_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
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
  ) sub
  ORDER BY sub.movement_date, sub.document_type;
END;
$$;
