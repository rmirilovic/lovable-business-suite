
ALTER TABLE public.payroll_parameters
  ADD COLUMN IF NOT EXISTS seniority_bonus_rate numeric NOT NULL DEFAULT 0.4;

ALTER TABLE public.payroll_calculation_items
  ADD COLUMN IF NOT EXISTS seniority_bonus numeric NOT NULL DEFAULT 0;
