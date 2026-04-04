
-- Customs clearances header
CREATE TABLE IF NOT EXISTS public.customs_clearances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clearance_number text NOT NULL,
  clearance_date date NOT NULL DEFAULT CURRENT_DATE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  business_year_id uuid NOT NULL REFERENCES public.business_years(id),
  source_invoice_id uuid NOT NULL REFERENCES public.goods_purchase_invoices(id),
  jci_number text,
  jci_date date,
  customs_office_code text,
  source_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  destination_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  exchange_rate numeric NOT NULL DEFAULT 1,
  currency text NOT NULL DEFAULT 'RSD',
  customs_duty_amount numeric NOT NULL DEFAULT 0,
  excise_amount numeric NOT NULL DEFAULT 0,
  invoice_value_rsd numeric NOT NULL DEFAULT 0,
  additional_costs_total numeric NOT NULL DEFAULT 0,
  customs_base numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 20,
  vat_base numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_cost_value numeric NOT NULL DEFAULT 0,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  transfer_id uuid REFERENCES public.inter_warehouse_transfers(id) ON DELETE SET NULL,
  customs_duty_account text,
  excise_account text,
  vat_account text,
  customs_obligation_account text,
  source_warehouse_account text,
  destination_warehouse_account text,
  status text NOT NULL DEFAULT 'draft',
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz,
  posted_by uuid
);

-- Customs clearance items
CREATE TABLE IF NOT EXISTS public.customs_clearance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customs_clearance_id uuid NOT NULL REFERENCES public.customs_clearances(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  article_id uuid REFERENCES public.articles(id),
  item_code text,
  item_name text NOT NULL,
  unit text NOT NULL DEFAULT 'kom',
  source_item_id uuid,
  available_quantity numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 0,
  invoice_price numeric NOT NULL DEFAULT 0,
  invoice_price_rsd numeric NOT NULL DEFAULT 0,
  invoice_value_rsd numeric NOT NULL DEFAULT 0,
  allocated_costs numeric NOT NULL DEFAULT 0,
  allocated_customs_duty numeric NOT NULL DEFAULT 0,
  allocated_excise numeric NOT NULL DEFAULT 0,
  customs_base numeric NOT NULL DEFAULT 0,
  vat_base numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  cost_price numeric NOT NULL DEFAULT 0,
  cost_value numeric NOT NULL DEFAULT 0,
  item_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Customs clearance costs
CREATE TABLE IF NOT EXISTS public.customs_clearance_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customs_clearance_id uuid NOT NULL REFERENCES public.customs_clearances(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  distribution_method text NOT NULL DEFAULT 'by_value',
  partner_id uuid REFERENCES public.partners(id),
  account_code text,
  item_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customs_clearances_company ON public.customs_clearances(company_id);
CREATE INDEX IF NOT EXISTS idx_customs_clearances_business_year ON public.customs_clearances(business_year_id);
CREATE INDEX IF NOT EXISTS idx_customs_clearances_source_invoice ON public.customs_clearances(source_invoice_id);
CREATE INDEX IF NOT EXISTS idx_customs_clearance_items_clearance ON public.customs_clearance_items(customs_clearance_id);
CREATE INDEX IF NOT EXISTS idx_customs_clearance_costs_clearance ON public.customs_clearance_costs(customs_clearance_id);

-- RLS
ALTER TABLE public.customs_clearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customs_clearance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customs_clearance_costs ENABLE ROW LEVEL SECURITY;

-- RLS: customs_clearances
CREATE POLICY "cc_select" ON public.customs_clearances FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "cc_insert" ON public.customs_clearances FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "cc_update" ON public.customs_clearances FOR UPDATE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "cc_delete" ON public.customs_clearances FOR DELETE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- RLS: customs_clearance_items
CREATE POLICY "cci_select" ON public.customs_clearance_items FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "cci_insert" ON public.customs_clearance_items FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "cci_update" ON public.customs_clearance_items FOR UPDATE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "cci_delete" ON public.customs_clearance_items FOR DELETE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- RLS: customs_clearance_costs
CREATE POLICY "ccc_select" ON public.customs_clearance_costs FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "ccc_insert" ON public.customs_clearance_costs FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "ccc_update" ON public.customs_clearance_costs FOR UPDATE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "ccc_delete" ON public.customs_clearance_costs FOR DELETE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_customs_clearances_updated_at
  BEFORE UPDATE ON public.customs_clearances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
