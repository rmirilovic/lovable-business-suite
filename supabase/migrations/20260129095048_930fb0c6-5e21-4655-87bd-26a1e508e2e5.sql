-- Create input_costs table for expense types on purchase invoices
CREATE TABLE public.input_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  account_code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  is_vat_deductible BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Enable RLS
ALTER TABLE public.input_costs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view input_costs for their companies"
  ON public.input_costs FOR SELECT
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert input_costs for their companies"
  ON public.input_costs FOR INSERT
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update input_costs for their companies"
  ON public.input_costs FOR UPDATE
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete input_costs for their companies"
  ON public.input_costs FOR DELETE
  USING (public.has_company_access(auth.uid(), company_id));

-- Trigger for updated_at
CREATE TRIGGER update_input_costs_updated_at
  BEFORE UPDATE ON public.input_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_input_costs_company_id ON public.input_costs(company_id);
CREATE INDEX idx_input_costs_account_code ON public.input_costs(account_code);