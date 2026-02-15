
-- ============================================================
-- Inter-Warehouse Transfers (Međumagacinski prenosi)
-- ============================================================

-- Table: inter_warehouse_transfers
CREATE TABLE public.inter_warehouse_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  transfer_number TEXT NOT NULL,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  destination_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  note TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inter_warehouse_transfers_different_warehouses CHECK (source_warehouse_id != destination_warehouse_id),
  UNIQUE (company_id, business_year_id, transfer_number)
);

ALTER TABLE public.inter_warehouse_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transfers for their companies"
  ON public.inter_warehouse_transfers FOR SELECT
  USING (company_id IN (
    SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert transfers for their companies"
  ON public.inter_warehouse_transfers FOR INSERT
  WITH CHECK (company_id IN (
    SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
  ));

CREATE POLICY "Users can update transfers for their companies"
  ON public.inter_warehouse_transfers FOR UPDATE
  USING (company_id IN (
    SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete transfers for their companies"
  ON public.inter_warehouse_transfers FOR DELETE
  USING (company_id IN (
    SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
  ));

-- Table: inter_warehouse_transfer_items
CREATE TABLE public.inter_warehouse_transfer_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES public.inter_warehouse_transfers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  article_id UUID NOT NULL REFERENCES public.articles(id),
  item_code TEXT,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kom',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inter_warehouse_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transfer items for their companies"
  ON public.inter_warehouse_transfer_items FOR SELECT
  USING (company_id IN (
    SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert transfer items for their companies"
  ON public.inter_warehouse_transfer_items FOR INSERT
  WITH CHECK (company_id IN (
    SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
  ));

CREATE POLICY "Users can update transfer items for their companies"
  ON public.inter_warehouse_transfer_items FOR UPDATE
  USING (company_id IN (
    SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete transfer items for their companies"
  ON public.inter_warehouse_transfer_items FOR DELETE
  USING (company_id IN (
    SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
  ));

-- Function: get next transfer number
CREATE OR REPLACE FUNCTION public.get_next_transfer_number(_company_id uuid, _year_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year_short text;
  _next_num integer;
BEGIN
  SELECT RIGHT(year::text, 2) INTO _year_short FROM business_years WHERE id = _year_id;

  SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
  FROM (
    SELECT CAST(SUBSTRING(transfer_number FROM '(\d{4})$') AS INTEGER) as seq
    FROM inter_warehouse_transfers
    WHERE company_id = _company_id AND business_year_id = _year_id
      AND transfer_number ~ ('^' || _year_short || '\d{4}$')
  ) t;

  RETURN _year_short || LPAD(_next_num::text, 4, '0');
END;
$$;

-- Function: post inter-warehouse transfer
CREATE OR REPLACE FUNCTION public.post_inter_warehouse_transfer(_transfer_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer inter_warehouse_transfers%ROWTYPE;
  v_item RECORD;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_item_order int := 0;
  v_total_value numeric := 0;
  v_src_inventory_account text;
  v_dst_inventory_account text;
  v_src_warehouse_code text;
  v_dst_warehouse_code text;
BEGIN
  -- Get transfer
  SELECT * INTO v_transfer FROM inter_warehouse_transfers WHERE id = _transfer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Međumagacinski prenos nije pronađen'; END IF;
  IF v_transfer.status = 'posted' THEN RAISE EXCEPTION 'Dokument je već proknjižen'; END IF;

  -- Check items exist
  IF NOT EXISTS (SELECT 1 FROM inter_warehouse_transfer_items WHERE transfer_id = _transfer_id) THEN
    RAISE EXCEPTION 'Dokument nema stavki';
  END IF;

  -- Validate same SVK (warehouse_type) for both warehouses
  DECLARE
    v_src_type text;
    v_dst_type text;
  BEGIN
    SELECT warehouse_type, COALESCE(inventory_account, '1320'), code
      INTO v_src_type, v_src_inventory_account, v_src_warehouse_code
      FROM warehouses WHERE id = v_transfer.source_warehouse_id;
    SELECT warehouse_type, COALESCE(inventory_account, '1320'), code
      INTO v_dst_type, v_dst_inventory_account, v_dst_warehouse_code
      FROM warehouses WHERE id = v_transfer.destination_warehouse_id;
    IF v_src_type != v_dst_type THEN
      RAISE EXCEPTION 'Magacini moraju biti istog tipa (SVK)';
    END IF;
  END;

  -- Calculate total value
  SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_total_value
  FROM inter_warehouse_transfer_items WHERE transfer_id = _transfer_id;

  -- Update stock: subtract from source, add to destination
  FOR v_item IN
    SELECT article_id, quantity
    FROM inter_warehouse_transfer_items
    WHERE transfer_id = _transfer_id
  LOOP
    UPDATE articles
    SET stock = COALESCE(stock, 0), -- stock stays same globally (transfer between warehouses)
        updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  -- Create journal entry
  v_entry_number := 'MMP' || v_transfer.transfer_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    document_date, document_number, description, status,
    created_by, source_document_type, source_document_id
  ) VALUES (
    v_transfer.company_id, v_transfer.business_year_id, v_entry_number,
    v_transfer.transfer_date, v_transfer.transfer_date,
    v_transfer.transfer_number,
    'Međumagacinski prenos ' || v_transfer.transfer_number,
    'posted', _user_id, 'inter_warehouse_transfer', _transfer_id
  ) RETURNING id INTO v_journal_entry_id;

  -- Source warehouse: NEGATIVE debit (storno) on inventory account
  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, document_date, cost_center_code
  ) VALUES (
    v_journal_entry_id, v_transfer.company_id, v_src_inventory_account, v_item_order,
    'Izlaz - MMP ' || v_transfer.transfer_number,
    -v_total_value, 0, v_transfer.transfer_date, v_src_warehouse_code
  );

  -- Destination warehouse: POSITIVE debit on inventory account
  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, document_date, cost_center_code
  ) VALUES (
    v_journal_entry_id, v_transfer.company_id, v_dst_inventory_account, v_item_order,
    'Ulaz - MMP ' || v_transfer.transfer_number,
    v_total_value, 0, v_transfer.transfer_date, v_dst_warehouse_code
  );

  -- Update journal entry totals (net is 0, but we store absolute sums)
  UPDATE journal_entries
  SET total_debit = v_total_value,
      total_credit = 0
  WHERE id = v_journal_entry_id;

  -- Update transfer status
  UPDATE inter_warehouse_transfers
  SET status = 'posted',
      posted_at = now(),
      posted_by = _user_id,
      journal_entry_id = v_journal_entry_id,
      updated_at = now()
  WHERE id = _transfer_id;

  RETURN _transfer_id;
END;
$$;

-- Function: unpost inter-warehouse transfer
CREATE OR REPLACE FUNCTION public.unpost_inter_warehouse_transfer(_transfer_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer inter_warehouse_transfers%ROWTYPE;
BEGIN
  SELECT * INTO v_transfer FROM inter_warehouse_transfers WHERE id = _transfer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dokument nije pronađen'; END IF;
  IF v_transfer.status != 'posted' THEN RAISE EXCEPTION 'Dokument nije proknjižen'; END IF;

  -- Delete journal entry (cascades items)
  IF v_transfer.journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_transfer.journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_transfer.journal_entry_id;
  END IF;

  -- Revert transfer status
  UPDATE inter_warehouse_transfers
  SET status = 'draft',
      posted_at = NULL,
      posted_by = NULL,
      journal_entry_id = NULL,
      updated_at = now()
  WHERE id = _transfer_id;

  RETURN _transfer_id;
END;
$$;

-- Update get_warehouse_stock to include inter-warehouse transfers
CREATE OR REPLACE FUNCTION public.get_warehouse_stock(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  article_id uuid,
  article_code text,
  article_name text,
  unit text,
  total_in_qty numeric,
  total_in_value numeric,
  total_out_qty numeric,
  total_out_value numeric,
  balance_qty numeric,
  balance_value numeric
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

    -- Price adjustment items (value-only movement)
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

    UNION ALL

    -- Inter-warehouse transfer OUT (source warehouse)
    SELECT
      iti.article_id,
      0::NUMERIC AS in_qty,
      0::NUMERIC AS in_value,
      iti.quantity AS out_qty,
      iti.quantity * iti.unit_price AS out_value,
      iwt.transfer_date AS movement_date
    FROM inter_warehouse_transfer_items iti
    JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id
      AND iwt.source_warehouse_id = p_warehouse_id
      AND iwt.status = 'posted'

    UNION ALL

    -- Inter-warehouse transfer IN (destination warehouse)
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

-- Also update get_article_warehouse_card to include transfers
CREATE OR REPLACE FUNCTION public.get_article_warehouse_card(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_article_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE(
  movement_date date,
  document_type text,
  document_number text,
  partner_name text,
  in_quantity numeric,
  out_quantity numeric,
  unit_price numeric,
  debit_value numeric,
  credit_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH all_movements AS (
    -- Goods receipt items
    SELECT
      gr.receipt_date AS mov_date,
      'Prijemnica'::text AS doc_type,
      gr.receipt_number AS doc_number,
      p.name AS p_name,
      gri.quantity AS in_qty,
      0::NUMERIC AS out_qty,
      gri.unit_price AS u_price,
      gri.quantity * gri.unit_price AS debit_val,
      0::NUMERIC AS credit_val
    FROM goods_receipt_items gri
    JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    LEFT JOIN partners p ON p.id = gr.partner_id
    WHERE gr.company_id = p_company_id
      AND gr.warehouse_id = p_warehouse_id
      AND gr.status = 'posted'
      AND gri.article_id = p_article_id

    UNION ALL

    -- Delivery note items
    SELECT
      dn.delivery_date,
      'Otpremnica'::text,
      dn.delivery_number,
      p.name,
      0::NUMERIC,
      dni.quantity,
      0::NUMERIC,
      0::NUMERIC,
      0::NUMERIC
    FROM delivery_note_items dni
    JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    LEFT JOIN partners p ON p.id = dn.partner_id
    WHERE dn.company_id = p_company_id
      AND dn.warehouse_id = p_warehouse_id
      AND dn.status = 'posted'
      AND dni.article_id = p_article_id

    UNION ALL

    -- Inventory surplus
    SELECT
      ic.count_date,
      'Popis višak'::text,
      ic.count_number,
      NULL::text,
      ici.surplus_qty,
      0::NUMERIC,
      ici.price,
      ici.surplus_value,
      0::NUMERIC
    FROM inventory_count_items ici
    JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id
      AND ic.warehouse_id = p_warehouse_id
      AND ic.status = 'posted'
      AND ici.article_id = p_article_id
      AND ici.surplus_qty > 0

    UNION ALL

    -- Inventory deficit
    SELECT
      ic.count_date,
      'Popis manjak'::text,
      ic.count_number,
      NULL::text,
      0::NUMERIC,
      ici.deficit_qty,
      ici.price,
      0::NUMERIC,
      ici.deficit_value
    FROM inventory_count_items ici
    JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id
      AND ic.warehouse_id = p_warehouse_id
      AND ic.status = 'posted'
      AND ici.article_id = p_article_id
      AND ici.deficit_qty > 0

    UNION ALL

    -- Price adjustments
    SELECT
      pa.adjustment_date,
      'Nivelacija'::text,
      pa.adjustment_number,
      NULL::text,
      0::NUMERIC,
      0::NUMERIC,
      0::NUMERIC,
      CASE WHEN pai.value_difference > 0 THEN pai.value_difference ELSE 0::NUMERIC END,
      CASE WHEN pai.value_difference < 0 THEN ABS(pai.value_difference) ELSE 0::NUMERIC END
    FROM price_adjustment_items pai
    JOIN price_adjustments pa ON pa.id = pai.price_adjustment_id
    WHERE pa.company_id = p_company_id
      AND pa.warehouse_id = p_warehouse_id
      AND pa.status = 'posted'
      AND pai.article_id = p_article_id

    UNION ALL

    -- Inter-warehouse transfer OUT
    SELECT
      iwt.transfer_date,
      'MMP izlaz'::text,
      iwt.transfer_number,
      NULL::text,
      0::NUMERIC,
      iti.quantity,
      iti.unit_price,
      0::NUMERIC,
      iti.quantity * iti.unit_price
    FROM inter_warehouse_transfer_items iti
    JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id
      AND iwt.source_warehouse_id = p_warehouse_id
      AND iwt.status = 'posted'
      AND iti.article_id = p_article_id

    UNION ALL

    -- Inter-warehouse transfer IN
    SELECT
      iwt.transfer_date,
      'MMP ulaz'::text,
      iwt.transfer_number,
      NULL::text,
      iti.quantity,
      0::NUMERIC,
      iti.unit_price,
      iti.quantity * iti.unit_price,
      0::NUMERIC
    FROM inter_warehouse_transfer_items iti
    JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id
      AND iwt.destination_warehouse_id = p_warehouse_id
      AND iwt.status = 'posted'
      AND iti.article_id = p_article_id
  )
  SELECT
    am.mov_date AS movement_date,
    am.doc_type AS document_type,
    am.doc_number AS document_number,
    am.p_name AS partner_name,
    am.in_qty AS in_quantity,
    am.out_qty AS out_quantity,
    am.u_price AS unit_price,
    am.debit_val AS debit_value,
    am.credit_val AS credit_value
  FROM all_movements am
  WHERE (p_date_from IS NULL OR am.mov_date >= p_date_from)
    AND (p_date_to IS NULL OR am.mov_date <= p_date_to)
  ORDER BY am.mov_date, am.doc_type, am.doc_number;
END;
$$;
