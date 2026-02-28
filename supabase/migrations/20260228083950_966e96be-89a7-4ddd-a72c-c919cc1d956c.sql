
ALTER TABLE public.advance_invoices
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) DEFAULT NULL;
