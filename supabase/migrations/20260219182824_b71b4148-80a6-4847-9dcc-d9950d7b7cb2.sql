
-- ============================================
-- Reprocessing Work Orders - Tables
-- ============================================

CREATE TABLE public.reprocessing_work_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  business_year_id uuid NOT NULL REFERENCES public.business_years(id),
  order_number text NOT NULL,
  order_date text NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
  deadline_date text,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'launched', 'closed')),
  launched_at timestamptz,
  launched_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL
);

ALTER TABLE public.reprocessing_work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage reprocessing work orders" ON public.reprocessing_work_orders
  FOR ALL USING (company_id IN (SELECT company_id FROM public.user_role_assignments WHERE user_id = auth.uid() AND is_active = true));

CREATE TABLE public.reprocessing_wo_output_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id uuid NOT NULL REFERENCES public.reprocessing_work_orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  article_id uuid NOT NULL REFERENCES public.articles(id),
  article_code text NOT NULL,
  article_name text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  launched_qty numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  launched_value numeric NOT NULL DEFAULT 0,
  kg_per_unit numeric NOT NULL DEFAULT 0,
  item_order int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reprocessing_wo_output_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage reprocessing wo output" ON public.reprocessing_wo_output_items
  FOR ALL USING (company_id IN (SELECT company_id FROM public.user_role_assignments WHERE user_id = auth.uid() AND is_active = true));

CREATE TABLE public.reprocessing_wo_input_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id uuid NOT NULL REFERENCES public.reprocessing_work_orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  article_id uuid NOT NULL REFERENCES public.articles(id),
  article_code text NOT NULL,
  article_name text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  item_value numeric NOT NULL DEFAULT 0,
  item_order int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reprocessing_wo_input_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage reprocessing wo input" ON public.reprocessing_wo_input_items
  FOR ALL USING (company_id IN (SELECT company_id FROM public.user_role_assignments WHERE user_id = auth.uid() AND is_active = true));

CREATE TABLE public.reprocessing_wo_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id uuid NOT NULL REFERENCES public.reprocessing_work_orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  article_id uuid NOT NULL REFERENCES public.articles(id),
  article_code text NOT NULL,
  article_name text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  quantity numeric NOT NULL DEFAULT 0,
  warehouse_id uuid REFERENCES public.warehouses(id),
  unit_price numeric NOT NULL DEFAULT 0,
  item_value numeric NOT NULL DEFAULT 0,
  item_order int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reprocessing_wo_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage reprocessing wo materials" ON public.reprocessing_wo_materials
  FOR ALL USING (company_id IN (SELECT company_id FROM public.user_role_assignments WHERE user_id = auth.uid() AND is_active = true));

CREATE TABLE public.reprocessing_delivery_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  business_year_id uuid NOT NULL REFERENCES public.business_years(id),
  delivery_number text NOT NULL,
  work_order_id uuid NOT NULL REFERENCES public.reprocessing_work_orders(id),
  delivery_date text NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  production_line int NOT NULL DEFAULT 1,
  responsible_person text NOT NULL DEFAULT '',
  shift_manager_1_id uuid,
  shift_manager_2_id uuid,
  shift_manager_3_id uuid,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz,
  posted_by uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  total_kg numeric NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL
);

ALTER TABLE public.reprocessing_delivery_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage reprocessing delivery notes" ON public.reprocessing_delivery_notes
  FOR ALL USING (company_id IN (SELECT company_id FROM public.user_role_assignments WHERE user_id = auth.uid() AND is_active = true));

CREATE TABLE public.reprocessing_delivery_note_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id uuid NOT NULL REFERENCES public.reprocessing_delivery_notes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  article_id uuid NOT NULL REFERENCES public.articles(id),
  article_code text NOT NULL,
  article_name text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  kg_per_unit numeric NOT NULL DEFAULT 0,
  launched_qty numeric NOT NULL DEFAULT 0,
  qty_shift_1 numeric NOT NULL DEFAULT 0,
  qty_shift_2 numeric NOT NULL DEFAULT 0,
  qty_shift_3 numeric NOT NULL DEFAULT 0,
  qty_total numeric NOT NULL DEFAULT 0,
  delivered_kg numeric NOT NULL DEFAULT 0,
  delivered_m numeric NOT NULL DEFAULT 0,
  delivered_pcs numeric NOT NULL DEFAULT 0,
  scrap_qty numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  item_value numeric NOT NULL DEFAULT 0,
  item_order int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reprocessing_delivery_note_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage reprocessing dn items" ON public.reprocessing_delivery_note_items
  FOR ALL USING (company_id IN (SELECT company_id FROM public.user_role_assignments WHERE user_id = auth.uid() AND is_active = true));

-- ============================================
-- Functions
-- ============================================

CREATE OR REPLACE FUNCTION public.get_next_reprocessing_wo_number(_company_id uuid, _year_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _year INT;
  _max_seq INT;
  _yy TEXT;
BEGIN
  SELECT year INTO _year FROM business_years WHERE id = _year_id;
  _yy := LPAD(((_year % 100)::INT)::TEXT, 2, '0');
  SELECT COALESCE(MAX(SUBSTRING(order_number FROM 3)::INT), 0)
  INTO _max_seq
  FROM reprocessing_work_orders
  WHERE company_id = _company_id AND business_year_id = _year_id;
  RETURN _yy || LPAD((_max_seq + 1)::TEXT, 4, '0');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.close_reprocessing_work_order(_order_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_order RECORD;
  v_je_id uuid;
  v_entry_number text;
  v_item_order int := 0;
  v_total_input_value numeric := 0;
  v_total_material_value numeric := 0;
  v_warehouse_code text;
  v_mat_warehouse_code text;
BEGIN
  SELECT rwo.*, w.code as warehouse_code
  INTO v_order
  FROM reprocessing_work_orders rwo
  JOIN warehouses w ON w.id = rwo.warehouse_id
  WHERE rwo.id = _order_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'RN za preradu nije pronadjen'; END IF;
  IF v_order.status != 'launched' THEN RAISE EXCEPTION 'Samo lansirani RN mogu biti zakljuceni'; END IF;

  v_warehouse_code := v_order.warehouse_code;

  SELECT COALESCE(SUM(item_value), 0) INTO v_total_input_value
  FROM reprocessing_wo_input_items WHERE work_order_id = _order_id;

  SELECT COALESCE(SUM(item_value), 0) INTO v_total_material_value
  FROM reprocessing_wo_materials WHERE work_order_id = _order_id;

  SELECT w.code INTO v_mat_warehouse_code
  FROM reprocessing_wo_materials rwm
  JOIN warehouses w ON w.id = rwm.warehouse_id
  WHERE rwm.work_order_id = _order_id
  LIMIT 1;

  v_entry_number := 'RPR' || v_order.order_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit,
    created_by, source_document_type, source_document_id,
    posted_at, posted_by
  ) VALUES (
    v_order.company_id, v_order.business_year_id, v_entry_number,
    v_order.order_date, v_order.order_date,
    v_order.order_number,
    'Zakljucenje RN za preradu ' || v_order.order_number,
    'posted', 0, 0,
    _user_id, 'reprocessing_work_order', _order_id,
    now(), _user_id
  ) RETURNING id INTO v_je_id;

  -- Knjizenje istrebovanih GP (Tabela 2)
  IF v_total_input_value > 0 THEN
    UPDATE articles a
    SET stock = COALESCE(a.stock, 0) - rwi.quantity, updated_at = now()
    FROM reprocessing_wo_input_items rwi
    WHERE a.id = rwi.article_id AND rwi.work_order_id = _order_id;

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_order.company_id, '9600', v_item_order,
      'Istrebovani GP za preradu - RN ' || v_order.order_number,
      -v_total_input_value, 0, v_warehouse_code, v_order.order_date
    );

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_order.company_id, '9500', v_item_order,
      'Istrebovani GP za preradu - RN ' || v_order.order_number,
      0, -v_total_input_value, v_order.order_number, v_order.order_date
    );
  END IF;

  -- Knjizenje utrosenog materijala (Tabela 3)
  IF v_total_material_value > 0 THEN
    UPDATE articles a
    SET stock = COALESCE(a.stock, 0) - rwm.quantity, updated_at = now()
    FROM reprocessing_wo_materials rwm
    WHERE a.id = rwm.article_id AND rwm.work_order_id = _order_id;

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_order.company_id, '5110', v_item_order,
      'Utrosak materijala za preradu - RN ' || v_order.order_number,
      v_total_material_value, 0, v_order.order_number, v_order.order_date
    );

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_order.company_id, '1010', v_item_order,
      'Izdavanje materijala - RN ' || v_order.order_number,
      0, v_total_material_value, COALESCE(v_mat_warehouse_code, v_warehouse_code), v_order.order_date
    );

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_order.company_id, '9500', v_item_order,
      'Utrosak materijala po RN za preradu',
      v_total_material_value, 0, v_order.order_number, v_order.order_date
    );

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_order.company_id, '9100', v_item_order,
      'Smanjenje zaliha materijala - RN ' || v_order.order_number,
      0, v_total_material_value, COALESCE(v_mat_warehouse_code, v_warehouse_code), v_order.order_date
    );
  END IF;

  UPDATE journal_entries
  SET total_debit = (SELECT COALESCE(SUM(debit_amount), 0) FROM journal_entry_items WHERE journal_entry_id = v_je_id),
      total_credit = (SELECT COALESCE(SUM(credit_amount), 0) FROM journal_entry_items WHERE journal_entry_id = v_je_id)
  WHERE id = v_je_id;

  UPDATE reprocessing_work_orders
  SET status = 'closed', closed_at = now(), closed_by = _user_id, journal_entry_id = v_je_id
  WHERE id = _order_id;

  RETURN v_je_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.reopen_reprocessing_work_order(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_order RECORD;
  v_je_id uuid;
BEGIN
  SELECT * INTO v_order FROM reprocessing_work_orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RN za preradu nije pronadjen'; END IF;
  IF v_order.status != 'closed' THEN RAISE EXCEPTION 'Samo zakljuceni RN mogu biti vraceni'; END IF;

  UPDATE articles a
  SET stock = COALESCE(a.stock, 0) + rwi.quantity, updated_at = now()
  FROM reprocessing_wo_input_items rwi
  WHERE a.id = rwi.article_id AND rwi.work_order_id = _order_id;

  UPDATE articles a
  SET stock = COALESCE(a.stock, 0) + rwm.quantity, updated_at = now()
  FROM reprocessing_wo_materials rwm
  WHERE a.id = rwm.article_id AND rwm.work_order_id = _order_id;

  v_je_id := v_order.journal_entry_id;
  IF v_je_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_je_id;
    DELETE FROM journal_entries WHERE id = v_je_id;
  END IF;

  UPDATE reprocessing_work_orders
  SET status = 'launched', closed_at = NULL, closed_by = NULL, journal_entry_id = NULL
  WHERE id = _order_id;

  RETURN true;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.post_reprocessing_delivery_note(_note_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_note RECORD;
  v_item RECORD;
  v_je_id uuid;
  v_entry_number text;
  v_total_value numeric := 0;
  v_warehouse_code text;
BEGIN
  SELECT rdn.*, w.code as warehouse_code
  INTO v_note
  FROM reprocessing_delivery_notes rdn
  JOIN warehouses w ON w.id = rdn.warehouse_id
  WHERE rdn.id = _note_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Predajnica nije pronadjena'; END IF;
  IF v_note.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjizeni'; END IF;

  IF NOT EXISTS (SELECT 1 FROM reprocessing_delivery_note_items WHERE delivery_note_id = _note_id) THEN
    RAISE EXCEPTION 'Predajnica nema stavki';
  END IF;

  v_warehouse_code := v_note.warehouse_code;

  FOR v_item IN
    SELECT article_id, delivered_kg, item_value
    FROM reprocessing_delivery_note_items WHERE delivery_note_id = _note_id
  LOOP
    v_total_value := v_total_value + COALESCE(v_item.item_value, 0);
    UPDATE articles SET stock = COALESCE(stock, 0) + v_item.delivered_kg, updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  v_entry_number := 'RPD' || v_note.delivery_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit,
    created_by, source_document_type, source_document_id,
    posted_at, posted_by
  ) VALUES (
    v_note.company_id, v_note.business_year_id, v_entry_number,
    v_note.delivery_date, v_note.delivery_date,
    v_note.delivery_number,
    'Predajnica preradu ' || v_note.delivery_number,
    'posted', v_total_value, v_total_value,
    _user_id, 'reprocessing_delivery_note', _note_id,
    now(), _user_id
  ) RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, cost_center_code, document_date
  ) VALUES (
    v_je_id, v_note.company_id, '9600', 1,
    'Predaja GP u magacin - predajnica ' || v_note.delivery_number,
    v_total_value, 0, v_warehouse_code, v_note.delivery_date
  );

  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, cost_center_code, document_date
  ) VALUES (
    v_je_id, v_note.company_id, '9500', 2,
    'Predaja GP iz prerade - predajnica ' || v_note.delivery_number,
    0, v_total_value, v_note.delivery_number, v_note.delivery_date
  );

  UPDATE reprocessing_delivery_notes
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = v_je_id, total_value = v_total_value
  WHERE id = _note_id;

  RETURN v_je_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.unpost_reprocessing_delivery_note(_note_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_note RECORD;
  v_item RECORD;
  v_je_id uuid;
BEGIN
  SELECT * INTO v_note FROM reprocessing_delivery_notes WHERE id = _note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Predajnica nije pronadjena'; END IF;
  IF v_note.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjizene predajnice mogu biti ponistene'; END IF;

  FOR v_item IN
    SELECT article_id, delivered_kg
    FROM reprocessing_delivery_note_items WHERE delivery_note_id = _note_id
  LOOP
    UPDATE articles SET stock = COALESCE(stock, 0) - v_item.delivered_kg, updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  v_je_id := v_note.journal_entry_id;
  IF v_je_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_je_id;
    DELETE FROM journal_entries WHERE id = v_je_id;
  END IF;

  UPDATE reprocessing_delivery_notes
  SET status = 'draft', posted_at = NULL, posted_by = NULL, journal_entry_id = NULL
  WHERE id = _note_id;

  RETURN true;
END;
$fn$;
