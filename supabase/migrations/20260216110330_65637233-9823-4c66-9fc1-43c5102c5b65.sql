
ALTER TABLE public.material_norms ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE public.material_norms ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE public.material_norms ADD COLUMN approved_by UUID;
