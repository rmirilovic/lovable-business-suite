
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_number text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  jmbg text,
  date_of_birth date,
  gender text CHECK (gender IN ('M', 'F')),
  address text,
  city text,
  postal_code text,
  phone text,
  email text,
  education_level text,
  job_title text,
  org_unit_id uuid REFERENCES public.organizational_units(id) ON DELETE SET NULL,
  employment_date date,
  employment_type text DEFAULT 'neodredjeno' CHECK (employment_type IN ('neodredjeno', 'odredjeno', 'probni', 'privremeni')),
  contract_end_date date,
  work_experience_years integer DEFAULT 0,
  work_experience_months integer DEFAULT 0,
  bank_account text,
  is_active boolean DEFAULT true,
  status text DEFAULT 'active' CHECK (status IN ('active', 'terminated', 'suspended', 'maternity')),
  termination_date date,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, employee_number)
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select" ON public.employees
  FOR SELECT TO authenticated
  USING (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "employees_insert" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "employees_update" ON public.employees
  FOR UPDATE TO authenticated
  USING (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "employees_delete" ON public.employees
  FOR DELETE TO authenticated
  USING (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );
