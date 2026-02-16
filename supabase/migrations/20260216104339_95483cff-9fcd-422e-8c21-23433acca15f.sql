
-- Material consumption norms (one per finished product SVK=9)
CREATE TABLE public.material_norms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  article_id UUID NOT NULL REFERENCES public.articles(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, article_id)
);

ALTER TABLE public.material_norms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view material_norms for their company"
  ON public.material_norms FOR SELECT
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can insert material_norms for their company"
  ON public.material_norms FOR INSERT
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can update material_norms for their company"
  ON public.material_norms FOR UPDATE
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can delete material_norms for their company"
  ON public.material_norms FOR DELETE
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

-- Norm variants (multiple per norm)
CREATE TABLE public.material_norm_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  norm_id UUID NOT NULL REFERENCES public.material_norms(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  variant_number INT NOT NULL DEFAULT 1,
  variant_name TEXT NOT NULL DEFAULT 'Varijanta 1',
  is_default BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(norm_id, variant_number)
);

ALTER TABLE public.material_norm_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view material_norm_variants for their company"
  ON public.material_norm_variants FOR SELECT
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can insert material_norm_variants for their company"
  ON public.material_norm_variants FOR INSERT
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can update material_norm_variants for their company"
  ON public.material_norm_variants FOR UPDATE
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can delete material_norm_variants for their company"
  ON public.material_norm_variants FOR DELETE
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

-- Norm items (materials SVK=2 in each variant)
CREATE TABLE public.material_norm_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID NOT NULL REFERENCES public.material_norm_variants(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  article_id UUID NOT NULL REFERENCES public.articles(id),
  article_code TEXT NOT NULL,
  article_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kom',
  qty_per_kg NUMERIC(15,6) NOT NULL DEFAULT 0,
  qty_per_m NUMERIC(15,6) NOT NULL DEFAULT 0,
  qty_per_pc NUMERIC(15,6) NOT NULL DEFAULT 0,
  item_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.material_norm_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view material_norm_items for their company"
  ON public.material_norm_items FOR SELECT
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can insert material_norm_items for their company"
  ON public.material_norm_items FOR INSERT
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can update material_norm_items for their company"
  ON public.material_norm_items FOR UPDATE
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE POLICY "Users can delete material_norm_items for their company"
  ON public.material_norm_items FOR DELETE
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

-- Trigger for updated_at on material_norms
CREATE TRIGGER update_material_norms_updated_at
  BEFORE UPDATE ON public.material_norms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on material_norm_variants
CREATE TRIGGER update_material_norm_variants_updated_at
  BEFORE UPDATE ON public.material_norm_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
