
-- Price Adjustments (Nivelacije cena)
CREATE TABLE public.price_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  adjustment_number TEXT NOT NULL,
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  total_increase NUMERIC NOT NULL DEFAULT 0,
  total_decrease NUMERIC NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by UUID NOT NULL,
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, business_year_id, adjustment_number)
);

ALTER TABLE public.price_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view price adjustments for their company"
  ON public.price_adjustments FOR SELECT
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can insert price adjustments for their company"
  ON public.price_adjustments FOR INSERT
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can update price adjustments for their company"
  ON public.price_adjustments FOR UPDATE
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can delete draft price adjustments"
  ON public.price_adjustments FOR DELETE
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()) AND status = 'draft');

-- Price Adjustment Items
CREATE TABLE public.price_adjustment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  price_adjustment_id UUID NOT NULL REFERENCES public.price_adjustments(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  article_id UUID NOT NULL REFERENCES public.articles(id),
  item_order INT NOT NULL DEFAULT 1,
  item_code TEXT,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kom',
  quantity NUMERIC NOT NULL DEFAULT 0,
  old_price NUMERIC NOT NULL DEFAULT 0,
  new_price NUMERIC NOT NULL DEFAULT 0,
  price_difference NUMERIC NOT NULL DEFAULT 0,
  value_difference NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_adjustment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view price adjustment items"
  ON public.price_adjustment_items FOR SELECT
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can insert price adjustment items"
  ON public.price_adjustment_items FOR INSERT
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can update price adjustment items"
  ON public.price_adjustment_items FOR UPDATE
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can delete price adjustment items"
  ON public.price_adjustment_items FOR DELETE
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_price_adjustments_updated_at
  BEFORE UPDATE ON public.price_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Next number function
CREATE OR REPLACE FUNCTION public.get_next_price_adjustment_number(_company_id UUID, _year_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT;
  v_max TEXT;
  v_next INT;
  v_prefix TEXT;
BEGIN
  SELECT year INTO v_year FROM business_years WHERE id = _year_id;
  v_prefix := RIGHT(v_year::TEXT, 2);

  SELECT MAX(adjustment_number) INTO v_max
  FROM price_adjustments
  WHERE company_id = _company_id AND business_year_id = _year_id;

  IF v_max IS NULL THEN
    v_next := 1;
  ELSE
    v_next := COALESCE(NULLIF(SUBSTRING(v_max FROM 3), '')::INT, 0) + 1;
  END IF;

  RETURN v_prefix || LPAD(v_next::TEXT, 4, '0');
END;
$$;

-- Post price adjustment function
CREATE OR REPLACE FUNCTION public.post_price_adjustment(_adjustment_id UUID, _user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pa RECORD;
  v_item RECORD;
  v_je_id UUID;
  v_entry_number TEXT;
  v_total_increase NUMERIC := 0;
  v_total_decrease NUMERIC := 0;
  v_item_order INT := 0;
  v_warehouse_code TEXT;
  v_inventory_account TEXT;
BEGIN
  -- Get price adjustment
  SELECT pa.*, w.code AS warehouse_code, w.inventory_account
  INTO v_pa
  FROM price_adjustments pa
  JOIN warehouses w ON w.id = pa.warehouse_id
  WHERE pa.id = _adjustment_id;

  IF v_pa.status != 'draft' THEN
    RAISE EXCEPTION 'Dokument nije u statusu nacrta';
  END IF;

  v_warehouse_code := v_pa.warehouse_code;
  v_inventory_account := COALESCE(v_pa.inventory_account, '1320');

  -- Calculate totals
  FOR v_item IN SELECT * FROM price_adjustment_items WHERE price_adjustment_id = _adjustment_id ORDER BY item_order
  LOOP
    IF v_item.value_difference > 0 THEN
      v_total_increase := v_total_increase + v_item.value_difference;
    ELSE
      v_total_decrease := v_total_decrease + ABS(v_item.value_difference);
    END IF;
  END LOOP;

  -- Create journal entry
  v_entry_number := 'NIV' || v_pa.adjustment_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    description, source_type, source_id, status, created_by
  )
  VALUES (
    v_pa.company_id, v_pa.business_year_id, v_entry_number, v_pa.adjustment_date, v_pa.adjustment_date,
    'Nivelacija cena ' || v_pa.adjustment_number, 'price_adjustment', _adjustment_id, 'posted', _user_id
  )
  RETURNING id INTO v_je_id;

  -- Journal entry items
  -- Price increase: Debit inventory account (1320), Credit income (6140)
  IF v_total_increase > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, cost_center_code, document_date
    )
    VALUES (
      v_je_id, v_pa.company_id, v_inventory_account, v_item_order,
      'Povećanje cena - nivelacija ' || v_pa.adjustment_number,
      v_total_increase, 0, v_warehouse_code, v_pa.adjustment_date
    );

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, cost_center_code, document_date
    )
    VALUES (
      v_je_id, v_pa.company_id, '6140', v_item_order,
      'Prihod od usklađivanja cena - nivelacija ' || v_pa.adjustment_number,
      0, v_total_increase, v_warehouse_code, v_pa.adjustment_date
    );
  END IF;

  -- Price decrease: Debit expense (5140), Credit inventory account (1320)
  IF v_total_decrease > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, cost_center_code, document_date
    )
    VALUES (
      v_je_id, v_pa.company_id, '5140', v_item_order,
      'Rashod od usklađivanja cena - nivelacija ' || v_pa.adjustment_number,
      v_total_decrease, 0, v_warehouse_code, v_pa.adjustment_date
    );

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, cost_center_code, document_date
    )
    VALUES (
      v_je_id, v_pa.company_id, v_inventory_account, v_item_order,
      'Smanjenje cena - nivelacija ' || v_pa.adjustment_number,
      0, v_total_decrease, v_warehouse_code, v_pa.adjustment_date
    );
  END IF;

  -- Update article selling prices
  FOR v_item IN SELECT * FROM price_adjustment_items WHERE price_adjustment_id = _adjustment_id
  LOOP
    UPDATE articles SET selling_price = v_item.new_price WHERE id = v_item.article_id;
  END LOOP;

  -- Update price adjustment status
  UPDATE price_adjustments SET
    status = 'posted',
    posted_at = now(),
    posted_by = _user_id,
    journal_entry_id = v_je_id,
    total_increase = v_total_increase,
    total_decrease = v_total_decrease
  WHERE id = _adjustment_id;
END;
$$;

-- Unpost price adjustment function
CREATE OR REPLACE FUNCTION public.unpost_price_adjustment(_adjustment_id UUID, _user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pa RECORD;
  v_item RECORD;
BEGIN
  SELECT * INTO v_pa FROM price_adjustments WHERE id = _adjustment_id;

  IF v_pa.status != 'posted' THEN
    RAISE EXCEPTION 'Dokument nije proknjižen';
  END IF;

  -- Revert article selling prices to old prices
  FOR v_item IN SELECT * FROM price_adjustment_items WHERE price_adjustment_id = _adjustment_id
  LOOP
    UPDATE articles SET selling_price = v_item.old_price WHERE id = v_item.article_id;
  END LOOP;

  -- Delete journal entry
  IF v_pa.journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_pa.journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_pa.journal_entry_id;
  END IF;

  -- Reset status
  UPDATE price_adjustments SET
    status = 'draft',
    posted_at = NULL,
    posted_by = NULL,
    journal_entry_id = NULL
  WHERE id = _adjustment_id;
END;
$$;
