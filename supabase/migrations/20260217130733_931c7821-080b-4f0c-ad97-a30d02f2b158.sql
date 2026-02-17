
INSERT INTO public.modules (code, name, module_type, parent_code)
VALUES ('proizvodnja.trebovanja', 'Trebovanja materijala', 'proizvodnja', 'proizvodnja')
ON CONFLICT (code) DO NOTHING;
