
INSERT INTO public.modules (code, name, module_type, parent_code, sort_order, description, is_active) VALUES
  ('osnovna_sredstva', 'Osnovna sredstva', 'osnovna_sredstva', NULL, 750, 'Upravljanje osnovnim sredstvima', true),
  ('osnovna_sredstva.evidencija', 'Evidencija OS', 'osnovna_sredstva', 'osnovna_sredstva', 751, 'Pregled i unos osnovnih sredstava', true),
  ('osnovna_sredstva.grupe', 'Grupe OS', 'osnovna_sredstva', 'osnovna_sredstva', 752, 'Amortizacione grupe', true),
  ('osnovna_sredstva.amortizacija', 'Obračun amortizacije', 'osnovna_sredstva', 'osnovna_sredstva', 753, 'Obračun amortizacije', true),
  ('osnovna_sredstva.popis', 'Popisna lista OS', 'osnovna_sredstva', 'osnovna_sredstva', 754, 'Popisna lista osnovnih sredstava', true);
