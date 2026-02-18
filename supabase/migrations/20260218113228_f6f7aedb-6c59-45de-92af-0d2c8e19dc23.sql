
-- Create production_delivery_notes table
CREATE TABLE public.production_delivery_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  delivery_number TEXT NOT NULL,
  work_order_id UUID REFERENCES public.work_orders(id),
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  production_line INTEGER NOT NULL DEFAULT 1,
  shift_manager_1_id UUID REFERENCES public.shift_managers(id),
  shift_manager_2_id UUID REFERENCES public.shift_managers(id),
  shift_manager_3_id UUID REFERENCES public.shift_managers(id),
  note TEXT,
  responsible_person TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  total_kg NUMERIC NOT NULL DEFAULT 0,
  total_value NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE public.production_delivery_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view production delivery notes"
  ON public.production_delivery_notes FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert production delivery notes"
  ON public.production_delivery_notes FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update production delivery notes"
  ON public.production_delivery_notes FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete draft production delivery notes"
  ON public.production_delivery_notes FOR DELETE
  USING (has_company_access(auth.uid(), company_id) AND status = 'draft');

-- Create production_delivery_note_items table
CREATE TABLE public.production_delivery_note_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id UUID NOT NULL REFERENCES public.production_delivery_notes(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  article_id UUID NOT NULL REFERENCES public.articles(id),
  article_code TEXT NOT NULL,
  article_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kom',
  kg_per_unit NUMERIC NOT NULL DEFAULT 0,
  launched_qty NUMERIC NOT NULL DEFAULT 0,
  qty_shift_1 NUMERIC NOT NULL DEFAULT 0,
  qty_shift_2 NUMERIC NOT NULL DEFAULT 0,
  qty_shift_3 NUMERIC NOT NULL DEFAULT 0,
  qty_total NUMERIC NOT NULL DEFAULT 0,
  delivered_kg NUMERIC NOT NULL DEFAULT 0,
  delivered_m NUMERIC NOT NULL DEFAULT 0,
  delivered_pcs NUMERIC NOT NULL DEFAULT 0,
  scrap_qty NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  item_value NUMERIC NOT NULL DEFAULT 0,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.production_delivery_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pdn items"
  ON public.production_delivery_note_items FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert pdn items"
  ON public.production_delivery_note_items FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update pdn items"
  ON public.production_delivery_note_items FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete pdn items"
  ON public.production_delivery_note_items FOR DELETE
  USING (has_company_access(auth.uid(), company_id));

-- Trigger for updated_at
CREATE TRIGGER update_production_delivery_notes_updated_at
  BEFORE UPDATE ON public.production_delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
