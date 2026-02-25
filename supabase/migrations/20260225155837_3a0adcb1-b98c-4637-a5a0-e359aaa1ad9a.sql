
-- Add bank_account_id and payment_method to quotes
ALTER TABLE public.quotes
  ADD COLUMN bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN payment_method VARCHAR(127);
