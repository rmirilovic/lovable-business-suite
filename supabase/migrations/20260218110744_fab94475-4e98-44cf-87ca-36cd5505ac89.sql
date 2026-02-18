
-- Create shift_managers table with exactly 3 rows
CREATE TABLE public.shift_managers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  slot_number integer NOT NULL CHECK (slot_number IN (1, 2, 3)),
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (company_id, slot_number)
);

-- Enable RLS
ALTER TABLE public.shift_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shift_managers for their companies"
ON public.shift_managers FOR SELECT
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update shift_managers for their companies"
ON public.shift_managers FOR UPDATE
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert shift_managers for their companies"
ON public.shift_managers FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

-- No DELETE policy intentionally - records should not be deleted

-- Trigger for updated_at
CREATE TRIGGER update_shift_managers_updated_at
BEFORE UPDATE ON public.shift_managers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
