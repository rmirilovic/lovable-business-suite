-- Add partner snapshot and composed_by columns to invoices (like quotes have)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS partner_name text,
  ADD COLUMN IF NOT EXISTS partner_address text,
  ADD COLUMN IF NOT EXISTS partner_city text,
  ADD COLUMN IF NOT EXISTS partner_postal_code text,
  ADD COLUMN IF NOT EXISTS partner_pib text,
  ADD COLUMN IF NOT EXISTS partner_mb text,
  ADD COLUMN IF NOT EXISTS composed_by text,
  ADD COLUMN IF NOT EXISTS header_note text;