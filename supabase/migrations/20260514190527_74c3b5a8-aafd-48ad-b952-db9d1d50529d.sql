
CREATE TABLE public.production_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  code INTEGER NOT NULL CHECK (code BETWEEN 1 AND 99),
  name VARCHAR(63) NOT NULL,
  production_type VARCHAR(15) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  UNIQUE(company_id, code)
);

ALTER TABLE public.production_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_lines_select" ON public.production_lines FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "production_lines_insert" ON public.production_lines FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "production_lines_update" ON public.production_lines FOR UPDATE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "production_lines_delete" ON public.production_lines FOR DELETE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_production_lines_updated_at
  BEFORE UPDATE ON public.production_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit history table
CREATE TABLE public.production_lines_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_line_id UUID NOT NULL,
  company_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.production_lines_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_lines_history_select" ON public.production_lines_history FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "production_lines_history_insert" ON public.production_lines_history FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE OR REPLACE FUNCTION public.log_production_lines_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.production_lines_history (production_line_id, company_id, action, new_data, changed_by)
    VALUES (NEW.id, NEW.company_id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.production_lines_history (production_line_id, company_id, action, old_data, new_data, changed_by)
    VALUES (NEW.id, NEW.company_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.production_lines_history (production_line_id, company_id, action, old_data, changed_by)
    VALUES (OLD.id, OLD.company_id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_production_lines_history
  AFTER INSERT OR UPDATE OR DELETE ON public.production_lines
  FOR EACH ROW EXECUTE FUNCTION public.log_production_lines_history();
