
-- Add contracted_salary to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS contracted_salary numeric NOT NULL DEFAULT 0;

-- Add sick_leave_employer_rate to payroll_parameters (default 65%)
ALTER TABLE public.payroll_parameters ADD COLUMN IF NOT EXISTS sick_leave_employer_rate numeric NOT NULL DEFAULT 65;

-- Add compensation_rate to employee_absences (for RFZO: 65 or 100)
ALTER TABLE public.employee_absences ADD COLUMN IF NOT EXISTS compensation_rate numeric DEFAULT NULL;
