
ALTER TABLE public.advance_invoices
ADD COLUMN IF NOT EXISTS tax_category_code TEXT NOT NULL DEFAULT 'S',
ADD COLUMN IF NOT EXISTS tax_exemption_reason TEXT DEFAULT NULL;
