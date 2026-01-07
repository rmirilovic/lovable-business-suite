-- Kreiraj enum za Standardnu vrstu knjiženja
CREATE TYPE public.svk_type AS ENUM ('0', '1', '2', '6', '8', '9');

-- Dodaj nova polja u tabelu articles
ALTER TABLE public.articles
ADD COLUMN svk public.svk_type DEFAULT '1',
ADD COLUMN kg_po_jm numeric(12,3) DEFAULT 0,
ADD COLUMN kol_mas numeric DEFAULT 1;