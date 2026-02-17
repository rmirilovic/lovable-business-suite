
-- Create material_requisitions table
CREATE TABLE public.material_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  requisition_number TEXT NOT NULL,
  requisition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  work_order_id UUID REFERENCES public.work_orders(id),
  note TEXT,
  issued_by TEXT NOT NULL DEFAULT '',
  received_by TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, business_year_id, requisition_number)
);

CREATE TABLE public.material_requisition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES public.material_requisitions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  article_id UUID NOT NULL REFERENCES public.articles(id),
  article_code TEXT NOT NULL,
  article_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kom',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  item_value NUMERIC NOT NULL DEFAULT 0,
  item_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.material_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_requisition_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_material_requisitions" ON public.material_requisitions
  FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "insert_material_requisitions" ON public.material_requisitions
  FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "update_material_requisitions" ON public.material_requisitions
  FOR UPDATE USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "delete_material_requisitions" ON public.material_requisitions
  FOR DELETE USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "select_material_requisition_items" ON public.material_requisition_items
  FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "insert_material_requisition_items" ON public.material_requisition_items
  FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "update_material_requisition_items" ON public.material_requisition_items
  FOR UPDATE USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "delete_material_requisition_items" ON public.material_requisition_items
  FOR DELETE USING (has_company_access(auth.uid(), company_id));

NOTIFY pgrst, 'reload schema';
