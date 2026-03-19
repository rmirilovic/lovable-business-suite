
INSERT INTO public.modules (code, name, module_type, parent_code, sort_order, is_active)
VALUES 
  ('pisarnica.predmeti', 'Predmeti (CRM)', 'pisarnica', 'pisarnica', 40, true)
ON CONFLICT DO NOTHING;
