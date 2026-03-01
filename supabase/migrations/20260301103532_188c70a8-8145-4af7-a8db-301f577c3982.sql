
-- Add VAT period type to companies
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS vat_period_type text NOT NULL DEFAULT 'monthly'
CHECK (vat_period_type IN ('monthly', 'quarterly'));

-- POPDV report header
CREATE TABLE public.popdv_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  business_year_id uuid NOT NULL REFERENCES public.business_years(id),
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_label text NOT NULL, -- e.g. "Januar 2026" or "Q1 2026"
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  finalized_by uuid,
  note text,
  UNIQUE(company_id, business_year_id, period_start)
);

-- POPDV report cells (each cell in the form)
CREATE TABLE public.popdv_report_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.popdv_reports(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  section integer NOT NULL CHECK (section BETWEEN 1 AND 11),
  row_code text NOT NULL,       -- e.g. "1.1", "1.2", "5.3.1"
  column_code text NOT NULL,    -- e.g. "osnov", "pdv", "ukupno"
  auto_value numeric NOT NULL DEFAULT 0,
  manual_override numeric,      -- NULL means use auto_value
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id, row_code, column_code)
);

-- Enable RLS
ALTER TABLE public.popdv_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popdv_report_cells ENABLE ROW LEVEL SECURITY;

-- RLS policies for popdv_reports
CREATE POLICY "Users can view POPDV reports for their companies"
ON public.popdv_reports FOR SELECT
USING (
  public.has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can insert POPDV reports for their companies"
ON public.popdv_reports FOR INSERT
WITH CHECK (
  public.has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can update POPDV reports for their companies"
ON public.popdv_reports FOR UPDATE
USING (
  public.has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can delete draft POPDV reports for their companies"
ON public.popdv_reports FOR DELETE
USING (
  status = 'draft' AND (
    public.has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
);

-- RLS policies for popdv_report_cells
CREATE POLICY "Users can view POPDV cells for their companies"
ON public.popdv_report_cells FOR SELECT
USING (
  public.has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can insert POPDV cells for their companies"
ON public.popdv_report_cells FOR INSERT
WITH CHECK (
  public.has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can update POPDV cells for their companies"
ON public.popdv_report_cells FOR UPDATE
USING (
  public.has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can delete POPDV cells for their companies"
ON public.popdv_report_cells FOR DELETE
USING (
  public.has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- Trigger for updated_at
CREATE TRIGGER update_popdv_reports_updated_at
BEFORE UPDATE ON public.popdv_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_popdv_report_cells_updated_at
BEFORE UPDATE ON public.popdv_report_cells
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
