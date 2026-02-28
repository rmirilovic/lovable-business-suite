
-- Add payment data fields to advance_invoices
ALTER TABLE public.advance_invoices
  ADD COLUMN payment_date date DEFAULT NULL,
  ADD COLUMN payment_amount numeric DEFAULT 0,
  ADD COLUMN payment_reference text DEFAULT NULL;
