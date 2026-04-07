
CREATE TABLE public.customs_clearance_posting_schema (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customs_duty_account TEXT,
  customs_obligation_account TEXT,
  excise_account TEXT,
  vat_account TEXT DEFAULT '2700',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

ALTER TABLE public.customs_clearance_posting_schema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage their company posting schema"
ON public.customs_clearance_posting_schema
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
