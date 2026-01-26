-- Register delivery notes module with correct module_type
INSERT INTO modules (code, name, description, module_type, parent_code, sort_order)
VALUES ('prodaja.otpremnice', 'Otpremnice', 'Upravljanje otpremnicama', 'prodaja', 'prodaja', 3)
ON CONFLICT (code) DO NOTHING;