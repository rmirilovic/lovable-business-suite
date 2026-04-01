INSERT INTO public.modules (code, name, module_type, parent_code, sort_order, description, is_active) VALUES
  ('sifarnici.partneri.pregled', 'Pregled partnera', 'sifarnici', 'sifarnici.partneri', 121, 'Pregled šifarnika partnera', true),
  ('sifarnici.partneri.kreiranje', 'Kreiranje partnera', 'sifarnici', 'sifarnici.partneri', 122, 'Kreiranje novih partnera', true),
  ('sifarnici.partneri.izmena', 'Izmena partnera', 'sifarnici', 'sifarnici.partneri', 123, 'Izmena postojećih partnera', true),
  ('sifarnici.partneri.brisanje', 'Brisanje partnera', 'sifarnici', 'sifarnici.partneri', 124, 'Brisanje partnera', true),
  ('sifarnici.partneri.istorija', 'Istorija izmena partnera', 'sifarnici', 'sifarnici.partneri', 125, 'Pregled istorije izmena partnera', true)
ON CONFLICT (code) DO UPDATE SET name=excluded.name, parent_code=excluded.parent_code, sort_order=excluded.sort_order, description=excluded.description, is_active=excluded.is_active;