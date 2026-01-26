-- Dodaj polja za snapshot podataka kupca u ponudi
-- Ova polja se mogu editovati nezavisno od originalnog partnera
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS partner_name text,
ADD COLUMN IF NOT EXISTS partner_address text,
ADD COLUMN IF NOT EXISTS partner_city text,
ADD COLUMN IF NOT EXISTS partner_postal_code text,
ADD COLUMN IF NOT EXISTS partner_pib text,
ADD COLUMN IF NOT EXISTS partner_mb text;

-- Popuni postojeće ponude sa podacima iz partnera
UPDATE public.quotes q
SET 
  partner_name = p.name,
  partner_address = p.address,
  partner_city = p.city,
  partner_postal_code = p.postal_code,
  partner_pib = p.pib,
  partner_mb = p.mb
FROM public.partners p
WHERE q.partner_id = p.id
AND q.partner_name IS NULL;