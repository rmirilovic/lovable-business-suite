
-- Add mesto_prometa, datum_prometa and bank_account_id to invoices
ALTER TABLE public.invoices
  ADD COLUMN mesto_prometa text,
  ADD COLUMN datum_prometa date,
  ADD COLUMN bank_account_id uuid REFERENCES public.bank_accounts(id);
