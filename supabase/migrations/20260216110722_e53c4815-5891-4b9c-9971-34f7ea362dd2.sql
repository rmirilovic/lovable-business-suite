
-- Remove status from material_norms
ALTER TABLE public.material_norms DROP COLUMN status;
ALTER TABLE public.material_norms DROP COLUMN approved_at;
ALTER TABLE public.material_norms DROP COLUMN approved_by;

-- Add status to material_norm_variants
ALTER TABLE public.material_norm_variants ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE public.material_norm_variants ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE public.material_norm_variants ADD COLUMN approved_by UUID;
