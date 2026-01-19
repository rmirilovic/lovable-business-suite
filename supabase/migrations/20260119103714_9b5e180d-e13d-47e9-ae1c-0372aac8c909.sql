-- Create enum for warehouse types (similar to SVK)
CREATE TYPE warehouse_type AS ENUM ('1', '2', '6', '9');

-- Create warehouses table
CREATE TABLE public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  warehouse_type warehouse_type NOT NULL DEFAULT '1',
  accountant TEXT,
  inventory_account TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Enable RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view warehouses from their companies"
ON public.warehouses
FOR SELECT
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can insert warehouses"
ON public.warehouses
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can update warehouses"
ON public.warehouses
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete warehouses"
ON public.warehouses
FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

-- Trigger for updated_at
CREATE TRIGGER update_warehouses_updated_at
BEFORE UPDATE ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();