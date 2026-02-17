
-- Work Orders (Radni nalozi)
CREATE TABLE public.work_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  order_number TEXT NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline_date DATE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  issued_by TEXT NOT NULL DEFAULT '',
  production_note TEXT,
  plant_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  launched_at TIMESTAMPTZ,
  launched_by UUID,
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, order_number)
);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view work_orders" ON public.work_orders FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert work_orders" ON public.work_orders FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update work_orders" ON public.work_orders FOR UPDATE USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete work_orders" ON public.work_orders FOR DELETE USING (has_company_access(auth.uid(), company_id) AND status = 'draft');

-- Work Order Items (Stavke - gotovi proizvodi)
CREATE TABLE public.work_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  article_id UUID NOT NULL REFERENCES public.articles(id),
  article_code TEXT NOT NULL,
  article_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kom',
  variant_id UUID REFERENCES public.material_norm_variants(id),
  variant_name TEXT,
  launched_qty NUMERIC NOT NULL DEFAULT 0,
  kg_per_unit NUMERIC NOT NULL DEFAULT 0,
  launched_kg NUMERIC NOT NULL DEFAULT 0,
  launched_m NUMERIC NOT NULL DEFAULT 0,
  launched_pcs NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  launched_value NUMERIC NOT NULL DEFAULT 0,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view work_order_items" ON public.work_order_items FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert work_order_items" ON public.work_order_items FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update work_order_items" ON public.work_order_items FOR UPDATE USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete work_order_items" ON public.work_order_items FOR DELETE USING (has_company_access(auth.uid(), company_id));

-- Work Order Materials (Potreban materijal)
CREATE TABLE public.work_order_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  article_id UUID NOT NULL REFERENCES public.articles(id),
  article_code TEXT NOT NULL,
  article_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  norm_qty NUMERIC NOT NULL DEFAULT 0,
  approved_qty NUMERIC NOT NULL DEFAULT 0,
  warehouse_id UUID REFERENCES public.warehouses(id),
  unit_price NUMERIC NOT NULL DEFAULT 0,
  material_value NUMERIC NOT NULL DEFAULT 0,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_order_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view work_order_materials" ON public.work_order_materials FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert work_order_materials" ON public.work_order_materials FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update work_order_materials" ON public.work_order_materials FOR UPDATE USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete work_order_materials" ON public.work_order_materials FOR DELETE USING (has_company_access(auth.uid(), company_id));

-- Trigger for updated_at on work_orders
CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
