-- Add supplier bank account and payment reference fields to purchase_invoices
ALTER TABLE public.purchase_invoices
ADD COLUMN supplier_bank_account text,
ADD COLUMN payment_reference text;

-- Add comments for clarity
COMMENT ON COLUMN public.purchase_invoices.supplier_bank_account IS 'Bank account number where supplier requests payment';
COMMENT ON COLUMN public.purchase_invoices.payment_reference IS 'Payment reference (Poziv na broj) from supplier invoice';