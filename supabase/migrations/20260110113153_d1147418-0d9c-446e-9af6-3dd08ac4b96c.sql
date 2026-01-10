-- Dodavanje novih kolona u tabelu companies
-- Preimenovanje city u mesto i dodavanje ostalih polja

-- Rename city to mesto (keeping for backward compatibility, we'll update in code)
-- Actually, city column stays as is for now, we add new columns

-- Adresni podaci
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS mesto_prometa text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS municipality_code text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS municipality text;

-- Podaci o delatnosti
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS activity_code text;

-- Podaci o odgovornoj osobi
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS responsible_person_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS responsible_person_email text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS responsible_person_jmbg text;

-- API ključevi za fiskalizaciju
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS api_token text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS api_demo_token text;

-- Napomene za dokumente
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS invoice_note_1 text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS invoice_note_2 text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS quote_note_1 text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS quote_note_2 text;

-- Logo i tekst za memorandum
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_text text;