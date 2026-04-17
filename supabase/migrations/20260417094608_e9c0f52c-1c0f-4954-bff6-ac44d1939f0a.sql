
-- ============================================================
-- MODUL: ZATVARANJE POSLOVNE GODINE
-- ============================================================

ALTER TABLE public.business_years
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid;

CREATE TABLE IF NOT EXISTS public.year_closing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id uuid NOT NULL REFERENCES public.business_years(id) ON DELETE CASCADE,
  step text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  result jsonb,
  notes text,
  executed_at timestamptz NOT NULL DEFAULT now(),
  executed_by uuid NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ycl_year ON public.year_closing_log(business_year_id, executed_at DESC);

ALTER TABLE public.year_closing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view closing log"
  ON public.year_closing_log FOR SELECT
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Members can insert closing log"
  ON public.year_closing_log FOR INSERT
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- ============================================================
-- 3) Provera preduslova
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_year_closing_prerequisites(_year_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_year int;
  v_drafts_je int;
  v_drafts_inv int;
  v_drafts_pinv int;
  v_drafts_bs int;
  v_diff_balance numeric;
BEGIN
  SELECT company_id, year INTO v_company_id, v_year FROM public.business_years WHERE id = _year_id;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Year not found'; END IF;
  IF NOT public.has_company_access(auth.uid(), v_company_id) THEN RAISE EXCEPTION 'Access denied'; END IF;

  SELECT count(*) INTO v_drafts_je FROM public.journal_entries WHERE business_year_id = _year_id AND status = 'draft';
  SELECT count(*) INTO v_drafts_inv FROM public.invoices WHERE business_year_id = _year_id AND status = 'draft';
  SELECT count(*) INTO v_drafts_pinv FROM public.purchase_invoices WHERE business_year_id = _year_id AND status = 'draft';
  SELECT count(*) INTO v_drafts_bs FROM public.bank_statements WHERE business_year_id = _year_id AND status = 'draft';

  SELECT COALESCE(SUM(jei.debit_amount - jei.credit_amount),0)
    INTO v_diff_balance
  FROM public.journal_entry_items jei
  JOIN public.journal_entries je ON je.id = jei.journal_entry_id
  WHERE je.business_year_id = _year_id AND je.status = 'posted';

  RETURN jsonb_build_object(
    'year', v_year,
    'date_from', make_date(v_year,1,1),
    'date_to', make_date(v_year,12,31),
    'checks', jsonb_build_array(
      jsonb_build_object('key','journal_drafts','label','Svi nalozi GK proknjiženi','ok', v_drafts_je = 0, 'detail', v_drafts_je || ' nacrta'),
      jsonb_build_object('key','invoices_drafts','label','Sve izlazne fakture proknjižene','ok', v_drafts_inv = 0, 'detail', v_drafts_inv || ' nacrta'),
      jsonb_build_object('key','purchase_drafts','label','Sve ulazne fakture proknjižene','ok', v_drafts_pinv = 0, 'detail', v_drafts_pinv || ' nacrta'),
      jsonb_build_object('key','bank_drafts','label','Svi bankovni izvodi proknjiženi','ok', v_drafts_bs = 0, 'detail', v_drafts_bs || ' nacrta'),
      jsonb_build_object('key','gl_balanced','label','GK je u ravnoteži (Σ duguje = Σ potražuje)','ok', abs(v_diff_balance) < 0.01, 'detail', 'Razlika: ' || round(v_diff_balance,2)::text)
    )
  );
END;
$$;

-- ============================================================
-- 4a) ZL-1: Zatvaranje rashoda (klasa 5) -> 710
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_closing_entry_expenses(_year_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_year int;
  v_entry_id uuid;
  v_entry_number text;
  v_user uuid := auth.uid();
  v_total numeric := 0;
  v_order int := 1;
  r record;
BEGIN
  SELECT company_id, year INTO v_company_id, v_year FROM public.business_years WHERE id = _year_id;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Year not found'; END IF;
  IF NOT public.has_company_access(v_user, v_company_id) THEN RAISE EXCEPTION 'Access denied'; END IF;

  SELECT public.get_next_journal_entry_number(v_company_id, _year_id) INTO v_entry_number;

  INSERT INTO public.journal_entries(company_id, business_year_id, entry_number, entry_date, description, status, created_by, source_document_type)
  VALUES (v_company_id, _year_id, v_entry_number, make_date(v_year,12,31),
          'ZAKLJUČNI LIST 1: Zatvaranje rashoda (klasa 5) → 710', 'draft', v_user, 'year_closing_expenses')
  RETURNING id INTO v_entry_id;

  FOR r IN
    SELECT jei.account_code, SUM(jei.debit_amount - jei.credit_amount) AS bal
    FROM public.journal_entry_items jei
    JOIN public.journal_entries je ON je.id = jei.journal_entry_id
    WHERE je.business_year_id = _year_id AND je.status = 'posted'
      AND jei.account_code LIKE '5%'
    GROUP BY jei.account_code
    HAVING ABS(SUM(jei.debit_amount - jei.credit_amount)) > 0.005
    ORDER BY jei.account_code
  LOOP
    INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
    VALUES (v_entry_id, v_company_id, r.account_code, v_order, 'Zatvaranje rashoda', 0, r.bal);
    v_order := v_order + 1;
    v_total := v_total + r.bal;
  END LOOP;

  IF v_total > 0 THEN
    INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
    VALUES (v_entry_id, v_company_id, '710', v_order, 'Prenos rashoda', v_total, 0);
  END IF;

  UPDATE public.journal_entries SET
    total_debit = (SELECT COALESCE(SUM(debit_amount),0) FROM public.journal_entry_items WHERE journal_entry_id = v_entry_id),
    total_credit = (SELECT COALESCE(SUM(credit_amount),0) FROM public.journal_entry_items WHERE journal_entry_id = v_entry_id)
  WHERE id = v_entry_id;

  INSERT INTO public.year_closing_log(company_id, business_year_id, step, result, executed_by)
  VALUES (v_company_id, _year_id, 'closing_expenses', jsonb_build_object('entry_id', v_entry_id, 'entry_number', v_entry_number, 'total', v_total), v_user);

  RETURN v_entry_id;
END;
$$;

-- ============================================================
-- 4b) ZL-2: Zatvaranje prihoda (klasa 6) -> 720
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_closing_entry_revenues(_year_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_year int;
  v_entry_id uuid;
  v_entry_number text;
  v_user uuid := auth.uid();
  v_total numeric := 0;
  v_order int := 1;
  r record;
BEGIN
  SELECT company_id, year INTO v_company_id, v_year FROM public.business_years WHERE id = _year_id;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Year not found'; END IF;
  IF NOT public.has_company_access(v_user, v_company_id) THEN RAISE EXCEPTION 'Access denied'; END IF;

  SELECT public.get_next_journal_entry_number(v_company_id, _year_id) INTO v_entry_number;

  INSERT INTO public.journal_entries(company_id, business_year_id, entry_number, entry_date, description, status, created_by, source_document_type)
  VALUES (v_company_id, _year_id, v_entry_number, make_date(v_year,12,31),
          'ZAKLJUČNI LIST 2: Zatvaranje prihoda (klasa 6) → 720', 'draft', v_user, 'year_closing_revenues')
  RETURNING id INTO v_entry_id;

  FOR r IN
    SELECT jei.account_code, SUM(jei.credit_amount - jei.debit_amount) AS bal
    FROM public.journal_entry_items jei
    JOIN public.journal_entries je ON je.id = jei.journal_entry_id
    WHERE je.business_year_id = _year_id AND je.status = 'posted'
      AND jei.account_code LIKE '6%'
    GROUP BY jei.account_code
    HAVING ABS(SUM(jei.credit_amount - jei.debit_amount)) > 0.005
    ORDER BY jei.account_code
  LOOP
    INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
    VALUES (v_entry_id, v_company_id, r.account_code, v_order, 'Zatvaranje prihoda', r.bal, 0);
    v_order := v_order + 1;
    v_total := v_total + r.bal;
  END LOOP;

  IF v_total > 0 THEN
    INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
    VALUES (v_entry_id, v_company_id, '720', v_order, 'Prenos prihoda', 0, v_total);
  END IF;

  UPDATE public.journal_entries SET
    total_debit = (SELECT COALESCE(SUM(debit_amount),0) FROM public.journal_entry_items WHERE journal_entry_id = v_entry_id),
    total_credit = (SELECT COALESCE(SUM(credit_amount),0) FROM public.journal_entry_items WHERE journal_entry_id = v_entry_id)
  WHERE id = v_entry_id;

  INSERT INTO public.year_closing_log(company_id, business_year_id, step, result, executed_by)
  VALUES (v_company_id, _year_id, 'closing_revenues', jsonb_build_object('entry_id', v_entry_id, 'entry_number', v_entry_number, 'total', v_total), v_user);

  RETURN v_entry_id;
END;
$$;

-- ============================================================
-- 4c) ZL-3: Utvrđivanje rezultata
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_closing_entry_result(_year_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_year int;
  v_entry_id uuid;
  v_entry_number text;
  v_user uuid := auth.uid();
  v_revenues numeric := 0;
  v_expenses numeric := 0;
  v_profit numeric;
  v_order int := 1;
BEGIN
  SELECT company_id, year INTO v_company_id, v_year FROM public.business_years WHERE id = _year_id;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Year not found'; END IF;
  IF NOT public.has_company_access(v_user, v_company_id) THEN RAISE EXCEPTION 'Access denied'; END IF;

  SELECT COALESCE(SUM(jei.credit_amount - jei.debit_amount),0) INTO v_revenues
  FROM public.journal_entry_items jei
  JOIN public.journal_entries je ON je.id = jei.journal_entry_id
  WHERE je.business_year_id = _year_id AND je.status IN ('posted','draft')
    AND jei.account_code = '720';

  SELECT COALESCE(SUM(jei.debit_amount - jei.credit_amount),0) INTO v_expenses
  FROM public.journal_entry_items jei
  JOIN public.journal_entries je ON je.id = jei.journal_entry_id
  WHERE je.business_year_id = _year_id AND je.status IN ('posted','draft')
    AND jei.account_code = '710';

  v_profit := v_revenues - v_expenses;

  SELECT public.get_next_journal_entry_number(v_company_id, _year_id) INTO v_entry_number;

  INSERT INTO public.journal_entries(company_id, business_year_id, entry_number, entry_date, description, status, created_by, source_document_type)
  VALUES (v_company_id, _year_id, v_entry_number, make_date(v_year,12,31),
          CASE WHEN v_profit >= 0
               THEN 'ZAKLJUČNI LIST 3: Utvrđivanje rezultata - DOBITAK ' || round(v_profit,2)
               ELSE 'ZAKLJUČNI LIST 3: Utvrđivanje rezultata - GUBITAK ' || round(abs(v_profit),2) END,
          'draft', v_user, 'year_closing_result')
  RETURNING id INTO v_entry_id;

  IF v_profit >= 0 THEN
    IF v_expenses > 0 THEN
      INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_company_id, '720', v_order, 'Zatvaranje 720 prema rashodima', v_expenses, 0); v_order := v_order + 1;
      INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_company_id, '710', v_order, 'Zatvaranje 710', 0, v_expenses); v_order := v_order + 1;
    END IF;
    IF v_profit > 0.005 THEN
      INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_company_id, '720', v_order, 'Prenos dobitka tekuće godine', v_profit, 0); v_order := v_order + 1;
      INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_company_id, '341', v_order, 'Neraspoređena dobit tekuće godine', 0, v_profit);
    END IF;
  ELSE
    IF v_revenues > 0 THEN
      INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_company_id, '720', v_order, 'Zatvaranje 720', v_revenues, 0); v_order := v_order + 1;
      INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_company_id, '710', v_order, 'Zatvaranje 710 prema prihodima', 0, v_revenues); v_order := v_order + 1;
    END IF;
    IF abs(v_profit) > 0.005 THEN
      INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_company_id, '351', v_order, 'Gubitak tekuće godine', abs(v_profit), 0); v_order := v_order + 1;
      INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_company_id, '710', v_order, 'Pokriće gubitka iz 710', 0, abs(v_profit));
    END IF;
  END IF;

  UPDATE public.journal_entries SET
    total_debit = (SELECT COALESCE(SUM(debit_amount),0) FROM public.journal_entry_items WHERE journal_entry_id = v_entry_id),
    total_credit = (SELECT COALESCE(SUM(credit_amount),0) FROM public.journal_entry_items WHERE journal_entry_id = v_entry_id)
  WHERE id = v_entry_id;

  INSERT INTO public.year_closing_log(company_id, business_year_id, step, result, executed_by)
  VALUES (v_company_id, _year_id, 'closing_result', jsonb_build_object('entry_id', v_entry_id, 'entry_number', v_entry_number, 'revenues', v_revenues, 'expenses', v_expenses, 'profit', v_profit), v_user);

  RETURN v_entry_id;
END;
$$;

-- ============================================================
-- 5) Početno stanje GK u novoj godini
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_opening_balance(_old_year_id uuid, _new_year_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_old_year int;
  v_new_year int;
  v_entry_id uuid;
  v_entry_number text;
  v_user uuid := auth.uid();
  v_order int := 1;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  r record;
BEGIN
  SELECT company_id, year INTO v_company_id, v_old_year FROM public.business_years WHERE id = _old_year_id;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Stara godina ne postoji'; END IF;
  IF NOT public.has_company_access(v_user, v_company_id) THEN RAISE EXCEPTION 'Access denied'; END IF;

  SELECT year INTO v_new_year FROM public.business_years WHERE id = _new_year_id AND company_id = v_company_id;
  IF v_new_year IS NULL THEN RAISE EXCEPTION 'Nova godina ne postoji ili pripada drugoj firmi'; END IF;
  IF v_new_year <> v_old_year + 1 THEN RAISE EXCEPTION 'Nova godina mora biti %, dobijena %', v_old_year+1, v_new_year; END IF;

  SELECT public.get_next_journal_entry_number(v_company_id, _new_year_id) INTO v_entry_number;

  INSERT INTO public.journal_entries(company_id, business_year_id, entry_number, entry_date, description, status, created_by, source_document_type)
  VALUES (v_company_id, _new_year_id, v_entry_number, make_date(v_new_year,1,1),
          'POČETNO STANJE - prenos iz godine ' || v_old_year, 'draft', v_user, 'year_opening_balance')
  RETURNING id INTO v_entry_id;

  -- Konta sa partner-analitikom (klase 20, 43, 15, 29) - jedan red po (konto, partner)
  FOR r IN
    SELECT jei.account_code, jei.partner_id,
           SUM(jei.debit_amount - jei.credit_amount) AS bal
    FROM public.journal_entry_items jei
    JOIN public.journal_entries je ON je.id = jei.journal_entry_id
    WHERE je.business_year_id = _old_year_id AND je.status = 'posted'
      AND substr(jei.account_code,1,2) IN ('20','43','15','29')
    GROUP BY jei.account_code, jei.partner_id
    HAVING ABS(SUM(jei.debit_amount - jei.credit_amount)) > 0.005
    ORDER BY jei.account_code, jei.partner_id NULLS LAST
  LOOP
    IF r.bal > 0 THEN
      INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount, partner_id)
      VALUES (v_entry_id, v_company_id, r.account_code, v_order, 'Početno stanje', r.bal, 0, r.partner_id);
      v_total_debit := v_total_debit + r.bal;
    ELSE
      INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount, partner_id)
      VALUES (v_entry_id, v_company_id, r.account_code, v_order, 'Početno stanje', 0, -r.bal, r.partner_id);
      v_total_credit := v_total_credit - r.bal;
    END IF;
    v_order := v_order + 1;
  END LOOP;

  -- Ostala bilansna konta (klase 0,1,2,3,4 ALI bez 20,43,15,29) - zbirno po kontu
  FOR r IN
    SELECT jei.account_code,
           SUM(jei.debit_amount - jei.credit_amount) AS bal
    FROM public.journal_entry_items jei
    JOIN public.journal_entries je ON je.id = jei.journal_entry_id
    WHERE je.business_year_id = _old_year_id AND je.status = 'posted'
      AND substr(jei.account_code,1,1) IN ('0','1','2','3','4')
      AND substr(jei.account_code,1,2) NOT IN ('20','43','15','29')
    GROUP BY jei.account_code
    HAVING ABS(SUM(jei.debit_amount - jei.credit_amount)) > 0.005
    ORDER BY jei.account_code
  LOOP
    IF r.bal > 0 THEN
      INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_company_id, r.account_code, v_order, 'Početno stanje', r.bal, 0);
      v_total_debit := v_total_debit + r.bal;
    ELSE
      INSERT INTO public.journal_entry_items(journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_company_id, r.account_code, v_order, 'Početno stanje', 0, -r.bal);
      v_total_credit := v_total_credit - r.bal;
    END IF;
    v_order := v_order + 1;
  END LOOP;

  UPDATE public.journal_entries SET
    total_debit = (SELECT COALESCE(SUM(debit_amount),0) FROM public.journal_entry_items WHERE journal_entry_id = v_entry_id),
    total_credit = (SELECT COALESCE(SUM(credit_amount),0) FROM public.journal_entry_items WHERE journal_entry_id = v_entry_id)
  WHERE id = v_entry_id;

  INSERT INTO public.year_closing_log(company_id, business_year_id, step, result, executed_by)
  VALUES (v_company_id, _old_year_id, 'opening_balance',
          jsonb_build_object('entry_id', v_entry_id, 'entry_number', v_entry_number,
                             'new_year_id', _new_year_id,
                             'total_debit', v_total_debit, 'total_credit', v_total_credit,
                             'difference', v_total_debit - v_total_credit), v_user);

  RETURN v_entry_id;
END;
$$;

-- ============================================================
-- 6) Pregled početnog stanja magacina
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_warehouse_opening_stock_preview(_old_year_id uuid)
RETURNS TABLE(
  warehouse_id uuid, warehouse_code text, warehouse_name text,
  article_id uuid, article_code text, article_name text, unit text,
  qty numeric, value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_year int;
  v_date_to date;
  w record;
BEGIN
  SELECT company_id, year INTO v_company_id, v_year FROM public.business_years WHERE id = _old_year_id;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Year not found'; END IF;
  IF NOT public.has_company_access(auth.uid(), v_company_id) THEN RAISE EXCEPTION 'Access denied'; END IF;
  v_date_to := make_date(v_year,12,31);

  FOR w IN SELECT id, code, name FROM public.warehouses WHERE company_id = v_company_id AND is_active = true ORDER BY code
  LOOP
    RETURN QUERY
    SELECT w.id, w.code, w.name,
           s.article_id, s.article_code, s.article_name, s.unit,
           s.balance_qty, s.balance_value
    FROM public.get_warehouse_stock(v_company_id, w.id, NULL, v_date_to) s
    WHERE s.balance_qty > 0;
  END LOOP;
END;
$$;

-- ============================================================
-- 7) Zaključavanje godine
-- ============================================================
CREATE OR REPLACE FUNCTION public.lock_business_year(_year_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_user uuid := auth.uid();
BEGIN
  SELECT company_id INTO v_company_id FROM public.business_years WHERE id = _year_id;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Year not found'; END IF;
  IF NOT public.has_company_access(v_user, v_company_id) THEN RAISE EXCEPTION 'Access denied'; END IF;

  UPDATE public.business_years
  SET is_closed = true,
      is_active = false,
      closed_at = now(),
      closed_by = v_user
  WHERE id = _year_id;

  INSERT INTO public.year_closing_log(company_id, business_year_id, step, result, executed_by)
  VALUES (v_company_id, _year_id, 'lock_year', jsonb_build_object('locked_at', now()), v_user);
END;
$$;
