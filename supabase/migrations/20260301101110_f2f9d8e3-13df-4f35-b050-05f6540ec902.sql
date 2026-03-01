
-- Add missing columns to credit_notes to match advance_invoices structure
ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id),
  ADD COLUMN IF NOT EXISTS tax_category_code TEXT NOT NULL DEFAULT 'S',
  ADD COLUMN IF NOT EXISTS tax_exemption_reason TEXT,
  ADD COLUMN IF NOT EXISTS contract_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_date DATE,
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;
