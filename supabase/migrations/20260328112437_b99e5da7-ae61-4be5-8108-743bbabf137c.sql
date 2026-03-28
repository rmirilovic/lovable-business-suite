ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS work_time_percent integer NOT NULL DEFAULT 100;