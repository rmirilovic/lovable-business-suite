INSERT INTO public.modules (code, name, module_type, parent_code, sort_order, description, is_active)
VALUES ('pisarnica.predmeti.predodela', 'Predodela predmeta', 'pisarnica', 'pisarnica.predmeti', 10, 'Pravo zaduženog operatera da predodeli predmet drugom korisniku', true)
ON CONFLICT DO NOTHING;