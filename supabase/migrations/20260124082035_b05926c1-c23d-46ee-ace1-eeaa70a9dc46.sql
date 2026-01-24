-- Create organizational_units table
CREATE TABLE public.organizational_units (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on code per company
CREATE UNIQUE INDEX organizational_units_company_code_idx ON public.organizational_units(company_id, code);

-- Create index on parent_code for tree queries
CREATE INDEX organizational_units_parent_code_idx ON public.organizational_units(company_id, parent_code);

-- Enable Row Level Security
ALTER TABLE public.organizational_units ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view organizational units from their companies" 
ON public.organizational_units 
FOR SELECT 
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can insert organizational units" 
ON public.organizational_units 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can update organizational units" 
ON public.organizational_units 
FOR UPDATE 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete organizational units" 
ON public.organizational_units 
FOR DELETE 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_organizational_units_updated_at
BEFORE UPDATE ON public.organizational_units
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();