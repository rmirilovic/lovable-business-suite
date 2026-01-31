-- Add org_unit_id column to service_purchase_invoices
ALTER TABLE public.service_purchase_invoices
ADD COLUMN org_unit_id UUID REFERENCES public.organizational_units(id) ON DELETE SET NULL;