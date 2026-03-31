
-- Enum for change types
CREATE TYPE public.fixed_asset_change_type AS ENUM (
  'acquisition', 'depreciation', 'write_off', 'disposal', 
  'revaluation', 'value_adjustment', 'transfer'
);

-- Fixed asset groups (amortizacione grupe)
CREATE TABLE public.fixed_asset_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  depreciation_rate NUMERIC NOT NULL DEFAULT 0,
  account_code TEXT DEFAULT '022',
  depreciation_expense_account TEXT DEFAULT '540',
  accumulated_depreciation_account TEXT DEFAULT '029',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

ALTER TABLE public.fixed_asset_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_asset_groups_select" ON public.fixed_asset_groups
  FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "fixed_asset_groups_insert" ON public.fixed_asset_groups
  FOR INSERT TO authenticated
  WITH CHECK (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "fixed_asset_groups_update" ON public.fixed_asset_groups
  FOR UPDATE TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "fixed_asset_groups_delete" ON public.fixed_asset_groups
  FOR DELETE TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Fixed assets
CREATE TABLE public.fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  inventory_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  group_id UUID REFERENCES public.fixed_asset_groups(id),
  acquisition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  activation_date DATE,
  acquisition_value NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC NOT NULL DEFAULT 0,
  accumulated_depreciation NUMERIC NOT NULL DEFAULT 0,
  residual_value NUMERIC NOT NULL DEFAULT 0,
  depreciation_rate NUMERIC NOT NULL DEFAULT 0,
  useful_life_months INT,
  status TEXT NOT NULL DEFAULT 'active',
  location TEXT,
  responsible_person TEXT,
  supplier_id UUID REFERENCES public.partners(id),
  invoice_reference TEXT,
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_assets_select" ON public.fixed_assets
  FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "fixed_assets_insert" ON public.fixed_assets
  FOR INSERT TO authenticated
  WITH CHECK (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "fixed_assets_update" ON public.fixed_assets
  FOR UPDATE TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "fixed_assets_delete" ON public.fixed_assets
  FOR DELETE TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Fixed asset changes
CREATE TABLE public.fixed_asset_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fixed_asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  change_type public.fixed_asset_change_type NOT NULL,
  change_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  document_reference TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fixed_asset_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_asset_changes_select" ON public.fixed_asset_changes
  FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "fixed_asset_changes_insert" ON public.fixed_asset_changes
  FOR INSERT TO authenticated
  WITH CHECK (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "fixed_asset_changes_update" ON public.fixed_asset_changes
  FOR UPDATE TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "fixed_asset_changes_delete" ON public.fixed_asset_changes
  FOR DELETE TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Triggers for updated_at
CREATE TRIGGER set_fixed_asset_groups_updated_at
  BEFORE UPDATE ON public.fixed_asset_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_fixed_assets_updated_at
  BEFORE UPDATE ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
