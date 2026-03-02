
-- Table for analytical POPDV detail rows (per-document breakdown)
CREATE TABLE public.popdv_report_detail_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.popdv_reports(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  section TEXT NOT NULL,
  row_code TEXT NOT NULL,
  document_date DATE,
  document_type_number TEXT,
  partner_info TEXT,
  values JSONB NOT NULL DEFAULT '{}'::jsonb,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_popdv_detail_rows_report ON public.popdv_report_detail_rows(report_id);
CREATE INDEX idx_popdv_detail_rows_section ON public.popdv_report_detail_rows(report_id, section, row_code);

-- Enable RLS
ALTER TABLE public.popdv_report_detail_rows ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view detail rows for their company"
ON public.popdv_report_detail_rows FOR SELECT
USING (company_id IN (
  SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
));

CREATE POLICY "Users can insert detail rows for their company"
ON public.popdv_report_detail_rows FOR INSERT
WITH CHECK (company_id IN (
  SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
));

CREATE POLICY "Users can update detail rows for their company"
ON public.popdv_report_detail_rows FOR UPDATE
USING (company_id IN (
  SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
));

CREATE POLICY "Users can delete detail rows for their company"
ON public.popdv_report_detail_rows FOR DELETE
USING (company_id IN (
  SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
));
