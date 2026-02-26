
-- Add tax category fields to invoices table (invoice-level, applies to all items)
ALTER TABLE public.invoices
  ADD COLUMN tax_category_code text NOT NULL DEFAULT 'S',
  ADD COLUMN tax_exemption_reason text;
