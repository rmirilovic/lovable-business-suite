
INSERT INTO role_permissions (role_id, module_code, access_level, can_post, can_unpost)
SELECT r.id, m.code, 'write', true, true
FROM roles r
CROSS JOIN modules m
WHERE m.code IN ('zarade', 'zarade.zaposleni')
ON CONFLICT DO NOTHING;
