
-- Add daily regres and meal amounts to payroll parameters
ALTER TABLE public.payroll_parameters 
  ADD COLUMN IF NOT EXISTS regres_daily numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_daily numeric NOT NULL DEFAULT 0;

-- Add monthly transport amount to employees
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS transport_monthly numeric NOT NULL DEFAULT 0;

-- Add regres column to payroll_calculation_items
ALTER TABLE public.payroll_calculation_items 
  ADD COLUMN IF NOT EXISTS regres numeric NOT NULL DEFAULT 0;
