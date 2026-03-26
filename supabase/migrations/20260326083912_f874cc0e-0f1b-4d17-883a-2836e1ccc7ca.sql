
-- Create absence type enum (if not exists, use DO block)
DO $$ BEGIN
  CREATE TYPE public.absence_type AS ENUM ('godisnji_odmor', 'bolovanje', 'placeno_odsustvo', 'neplaceno_odsustvo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Employee absences table
CREATE TABLE IF NOT EXISTS public.employee_absences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  absence_type public.absence_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  work_days INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leave fund per employee per year
CREATE TABLE IF NOT EXISTS public.employee_leave_funds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_days INTEGER NOT NULL DEFAULT 20,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, employee_id, year)
);

-- Add default leave days to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS leave_days_default INTEGER NOT NULL DEFAULT 20;

-- Enable RLS
ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leave_funds ENABLE ROW LEVEL SECURITY;

-- RLS policies for employee_absences
CREATE POLICY "absences_select" ON public.employee_absences
  FOR SELECT TO authenticated
  USING (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "absences_insert" ON public.employee_absences
  FOR INSERT TO authenticated
  WITH CHECK (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "absences_update" ON public.employee_absences
  FOR UPDATE TO authenticated
  USING (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "absences_delete" ON public.employee_absences
  FOR DELETE TO authenticated
  USING (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- RLS policies for employee_leave_funds
CREATE POLICY "leave_funds_select" ON public.employee_leave_funds
  FOR SELECT TO authenticated
  USING (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "leave_funds_insert" ON public.employee_leave_funds
  FOR INSERT TO authenticated
  WITH CHECK (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "leave_funds_update" ON public.employee_leave_funds
  FOR UPDATE TO authenticated
  USING (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "leave_funds_delete" ON public.employee_leave_funds
  FOR DELETE TO authenticated
  USING (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );
