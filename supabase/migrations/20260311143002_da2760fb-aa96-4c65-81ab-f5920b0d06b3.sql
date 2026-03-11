
-- Tabela NBS šifara plaćanja (referentna, bez company_id)
CREATE TABLE public.nbs_payment_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS - dostupno svim autentifikovanim korisnicima (samo čitanje)
ALTER TABLE public.nbs_payment_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read NBS payment codes"
  ON public.nbs_payment_codes FOR SELECT TO authenticated USING (true);

-- Bezgotovinska plaćanja (2xx)
INSERT INTO public.nbs_payment_codes (code, name) VALUES
  ('220', 'Promet robe i usluga – međufazna potrošnja'),
  ('221', 'Promet robe i usluga – finalna potrošnja'),
  ('222', 'Usluge javnih preduzeća'),
  ('223', 'Investicije u objekte i opremu'),
  ('224', 'Investicije – ostalo'),
  ('225', 'Zakupnine za korišćenje nepokretnosti i pokretnih stvari u državnoj svojini'),
  ('226', 'Zakupnine za korišćenje nepokretnosti i pokretnih stvari (oporezive)'),
  ('227', 'Subvencije, regresi i premije sa posebnih računa'),
  ('228', 'Subvencije, regresi i premije sa ostalih računa'),
  ('231', 'Carine i druge uvozne dažbine'),
  ('240', 'Zarade i druga primanja zaposlenih'),
  ('241', 'Neoporeziva primanja zaposlenih, socijalna i druga davanja izuzeta od oporezivanja'),
  ('242', 'Naknade zarada na teret poslodavca'),
  ('244', 'Isplate preko omladinskih i studentskih zadruga'),
  ('245', 'Penzije'),
  ('246', 'Obustave od penzija i zarada'),
  ('247', 'Druga socijalna davanja (nadoknade)'),
  ('248', 'Prihodi od vlasništva'),
  ('249', 'Zarade po drugim osnovama'),
  ('253', 'Uplata tekućih prihoda'),
  ('254', 'Uplata poreza i doprinosa po odbitku'),
  ('257', 'Povraćaj više naplaćenih ili pogrešno naplaćenih tekućih prihoda'),
  ('258', 'Preknjižavanje više uplaćenih ili pogrešno uplaćenih tekućih prihoda'),
  ('260', 'Premije osiguranja i naknada štete'),
  ('261', 'Raspored tekućih prihoda'),
  ('262', 'Transferi u okviru državnih organa'),
  ('263', 'Ostali transferi'),
  ('264', 'Prenos sredstava iz budžeta za obezbeđenje povraćaja više naplaćenih tekućih prihoda'),
  ('265', 'Uplata pazara'),
  ('266', 'Isplata gotovine'),
  ('270', 'Kratkoročni krediti'),
  ('271', 'Dugoročni krediti'),
  ('272', 'Aktivna kamata'),
  ('273', 'Polaganje oročenih depozita'),
  ('275', 'Ostali plasmani'),
  ('276', 'Otplata kratkoročnih kredita'),
  ('277', 'Otplata dugoročnih kredita'),
  ('278', 'Povraćaj oročenih depozita'),
  ('279', 'Pasivna kamata'),
  ('280', 'Eskont hartija od vrednosti'),
  ('281', 'Pozajmice osnivača za likvidnost'),
  ('282', 'Povraćaj pozajmice za likvidnost osnivaču'),
  ('283', 'Naplata čekova građana'),
  ('284', 'Platne kartice'),
  ('285', 'Menjački poslovi'),
  ('286', 'Kupoprodaja deviza'),
  ('287', 'Donacije i sponzorstva'),
  ('288', 'Donacije iz međunarodnih ugovora'),
  ('289', 'Transakcije po nalogu građana'),
  ('290', 'Druge transakcije');
