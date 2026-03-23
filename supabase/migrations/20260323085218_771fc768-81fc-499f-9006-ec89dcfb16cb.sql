INSERT INTO public.modules (code, name, module_type, parent_code, sort_order, description, is_active) VALUES
  ('zarade', 'Zarade', 'zarade', NULL, 85, 'Modul za upravljanje zaradama i kadrovskom evidencijom', true),
  ('zarade.zaposleni', 'Zaposleni', 'zarade', 'zarade', 1, 'Evidencija zaposlenih', true);