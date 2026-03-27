-- Add missing zarade submodules to modules table
INSERT INTO public.modules (code, name, module_type, parent_code, sort_order, description, is_active) VALUES
  ('zarade.obracun', 'Obračun zarada', 'zarade', 'zarade', 2, 'Obračun zarada i parametri', true)
ON CONFLICT (code) DO NOTHING;

-- Add role_permissions for zarade submodules for all existing roles that have zarade access
INSERT INTO role_permissions (role_id, module_code, access_level, can_post, can_unpost)
SELECT rp.role_id, m.code, 'write', true, true
FROM role_permissions rp
CROSS JOIN modules m
WHERE rp.module_code = 'zarade'
  AND m.code IN ('zarade.obracun', 'zarade.odsustva', 'zarade.kalendar', 'zarade.fond_odmora')
ON CONFLICT DO NOTHING;