-- Faza 1: Ino izlazne fakture — dodavanje polja na partnere i fakture

-- Partneri: ISO-2 kod zemlje + default valuta za inostrane partnere
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'RS',
  ADD COLUMN IF NOT EXISTS default_currency TEXT NOT NULL DEFAULT 'RSD';

-- Fakture: kurs, RSD ekvivalenti, JCI i isporučni uslovi
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subtotal_rsd NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount_rsd NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount_rsd NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jci_number TEXT,
  ADD COLUMN IF NOT EXISTS jci_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_terms TEXT;

-- Backfill RSD ekvivalenata za postojeće (RSD) fakture
UPDATE public.invoices
SET subtotal_rsd = subtotal,
    vat_amount_rsd = vat_amount,
    total_amount_rsd = total_amount
WHERE subtotal_rsd = 0 AND total_amount_rsd = 0;

COMMENT ON COLUMN public.partners.country_code IS 'ISO-2 kod zemlje partnera (RS, DE, IT, ...). Koristi se za ino partnere.';
COMMENT ON COLUMN public.partners.default_currency IS 'Podrazumevana valuta za fakture izdate ovom partneru (RSD, EUR, USD, ...).';
COMMENT ON COLUMN public.invoices.exchange_rate IS 'Srednji kurs NBS na datum prometa. 1 za RSD fakture.';
COMMENT ON COLUMN public.invoices.subtotal_rsd IS 'Osnovica u RSD (jednako subtotal za RSD fakture).';
COMMENT ON COLUMN public.invoices.vat_amount_rsd IS 'Iznos PDV u RSD.';
COMMENT ON COLUMN public.invoices.total_amount_rsd IS 'Ukupan iznos fakture u RSD.';
COMMENT ON COLUMN public.invoices.jci_number IS 'Broj JCI / MRN izvozne deklaracije (samo za izvozne fakture).';
COMMENT ON COLUMN public.invoices.jci_date IS 'Datum carinjenja JCI (datum nastanka poreske obaveze za izvoz).';
COMMENT ON COLUMN public.invoices.delivery_terms IS 'Incoterms (EXW, FCA, CIP, ...) — opciono za izvozne fakture.';