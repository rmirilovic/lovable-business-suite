
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS composed_by TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS approved_by_name TEXT;
