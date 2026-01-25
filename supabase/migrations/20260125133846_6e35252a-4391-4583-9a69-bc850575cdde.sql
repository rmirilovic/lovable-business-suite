-- Enum za tip konta
CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- Enum za status dokumenta
CREATE TYPE public.document_status AS ENUM ('draft', 'posted', 'cancelled');

-- Kontni plan
CREATE TABLE public.chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type account_type NOT NULL,
  parent_code TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_posting_allowed BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Nalozi za knjiženje (zaglavlje)
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id UUID NOT NULL REFERENCES public.business_years(id) ON DELETE RESTRICT,
  org_unit_id UUID REFERENCES public.organizational_units(id),
  entry_number INTEGER NOT NULL,
  entry_date DATE NOT NULL,
  document_date DATE,
  document_number TEXT,
  description TEXT NOT NULL,
  status document_status NOT NULL DEFAULT 'draft',
  total_debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  source_document_type TEXT,
  source_document_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, business_year_id, entry_number)
);

-- Stavke naloga za knjiženje
CREATE TABLE public.journal_entry_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  item_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  debit_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  partner_id UUID REFERENCES public.partners(id),
  cost_center_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indeksi za performanse
CREATE INDEX idx_chart_of_accounts_company ON public.chart_of_accounts(company_id);
CREATE INDEX idx_chart_of_accounts_code ON public.chart_of_accounts(company_id, code);
CREATE INDEX idx_chart_of_accounts_parent ON public.chart_of_accounts(company_id, parent_code);
CREATE INDEX idx_journal_entries_company_year ON public.journal_entries(company_id, business_year_id);
CREATE INDEX idx_journal_entries_date ON public.journal_entries(entry_date);
CREATE INDEX idx_journal_entries_status ON public.journal_entries(status);
CREATE INDEX idx_journal_entry_items_entry ON public.journal_entry_items(journal_entry_id);
CREATE INDEX idx_journal_entry_items_account ON public.journal_entry_items(account_code);

-- RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_items ENABLE ROW LEVEL SECURITY;

-- Kontni plan politike
CREATE POLICY "Users can view chart of accounts from their companies"
  ON public.chart_of_accounts FOR SELECT
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can insert chart of accounts"
  ON public.chart_of_accounts FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can update chart of accounts"
  ON public.chart_of_accounts FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin') OR public.is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete chart of accounts"
  ON public.chart_of_accounts FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin') OR public.is_local_admin_for_company(auth.uid(), company_id));

-- Nalozi za knjiženje politike
CREATE POLICY "Users can view journal entries from their companies"
  ON public.journal_entries FOR SELECT
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users with write access can insert journal entries"
  ON public.journal_entries FOR INSERT
  WITH CHECK (public.can_user_write(auth.uid(), company_id, 'racunovodstvo.nalozi', org_unit_id));

CREATE POLICY "Users can update draft journal entries"
  ON public.journal_entries FOR UPDATE
  USING (status = 'draft' AND public.can_user_write(auth.uid(), company_id, 'racunovodstvo.nalozi', org_unit_id));

CREATE POLICY "Admins can delete draft journal entries"
  ON public.journal_entries FOR DELETE
  USING (status = 'draft' AND (public.has_role(auth.uid(), 'super_admin') OR public.is_local_admin_for_company(auth.uid(), company_id)));

-- Stavke naloga politike
CREATE POLICY "Users can view journal entry items from their companies"
  ON public.journal_entry_items FOR SELECT
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert journal entry items"
  ON public.journal_entry_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.journal_entries je 
    WHERE je.id = journal_entry_id 
    AND je.status = 'draft'
    AND public.can_user_write(auth.uid(), je.company_id, 'racunovodstvo.nalozi', je.org_unit_id)
  ));

CREATE POLICY "Users can update journal entry items"
  ON public.journal_entry_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.journal_entries je 
    WHERE je.id = journal_entry_id 
    AND je.status = 'draft'
    AND public.can_user_write(auth.uid(), je.company_id, 'racunovodstvo.nalozi', je.org_unit_id)
  ));

CREATE POLICY "Users can delete journal entry items"
  ON public.journal_entry_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.journal_entries je 
    WHERE je.id = journal_entry_id 
    AND je.status = 'draft'
    AND public.can_user_write(auth.uid(), je.company_id, 'racunovodstvo.nalozi', je.org_unit_id)
  ));

-- Trigger za updated_at
CREATE TRIGGER update_chart_of_accounts_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Funkcija za knjiženje naloga
CREATE OR REPLACE FUNCTION public.post_journal_entry(_entry_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entry journal_entries%ROWTYPE;
  _debit_sum NUMERIC;
  _credit_sum NUMERIC;
BEGIN
  -- Dohvati nalog
  SELECT * INTO _entry FROM journal_entries WHERE id = _entry_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nalog za knjiženje nije pronađen';
  END IF;
  
  IF _entry.status != 'draft' THEN
    RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi';
  END IF;
  
  -- Proveri balans
  SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
  INTO _debit_sum, _credit_sum
  FROM journal_entry_items
  WHERE journal_entry_id = _entry_id;
  
  IF _debit_sum != _credit_sum THEN
    RAISE EXCEPTION 'Duguje (%) i potražuje (%) moraju biti jednaki', _debit_sum, _credit_sum;
  END IF;
  
  IF _debit_sum = 0 THEN
    RAISE EXCEPTION 'Nalog mora imati stavke';
  END IF;
  
  -- Proknjiži
  UPDATE journal_entries
  SET status = 'posted',
      posted_at = now(),
      posted_by = _user_id,
      total_debit = _debit_sum,
      total_credit = _credit_sum
  WHERE id = _entry_id;
  
  RETURN TRUE;
END;
$$;

-- Funkcija za sledeći broj naloga
CREATE OR REPLACE FUNCTION public.get_next_journal_entry_number(_company_id UUID, _year_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(entry_number), 0) + 1
  FROM journal_entries
  WHERE company_id = _company_id AND business_year_id = _year_id
$$;