
-- Add eFaktura fields to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_type_code text NOT NULL DEFAULT '380',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'RSD',
  ADD COLUMN IF NOT EXISTS payment_means_code text NOT NULL DEFAULT '30',
  ADD COLUMN IF NOT EXISTS partner_country_code text NOT NULL DEFAULT 'RS',
  ADD COLUMN IF NOT EXISTS partner_jbkjs text NULL;

-- Add comment for invoice_type_code values
COMMENT ON COLUMN public.invoices.invoice_type_code IS '380=regular, 381=credit note, 386=advance';
COMMENT ON COLUMN public.invoices.payment_means_code IS '30=bank transfer, 10=cash, 42=bank account, 48=card, 49=direct debit';

-- Add tax category to invoice items
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS tax_category_code text NOT NULL DEFAULT 'S',
  ADD COLUMN IF NOT EXISTS tax_exemption_reason text NULL;

COMMENT ON COLUMN public.invoice_items.tax_category_code IS 'S=standard, E=exempt, O=outside scope, AE=reverse charge';
