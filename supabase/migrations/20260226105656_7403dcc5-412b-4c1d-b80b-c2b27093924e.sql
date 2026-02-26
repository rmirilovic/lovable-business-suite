
-- Add billing reference fields for credit notes (381) referencing original invoices
-- and contract/order reference for advance invoices (386)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS billing_reference_number text,
  ADD COLUMN IF NOT EXISTS billing_reference_date text,
  ADD COLUMN IF NOT EXISTS contract_reference text;
