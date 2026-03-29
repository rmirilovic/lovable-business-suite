
-- Employee deductions master table
CREATE TABLE public.employee_deductions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  deduction_type TEXT NOT NULL DEFAULT 'ostale_obustave',
  description TEXT NOT NULL DEFAULT '',
  creditor_name TEXT,
  reference_number TEXT,
  amount_per_installment NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  total_installments INTEGER NOT NULL DEFAULT 0,
  paid_installments INTEGER NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_credit BOOLEAN NOT NULL DEFAULT false,
  start_date DATE,
  end_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employee_deductions" ON public.employee_deductions FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert employee_deductions" ON public.employee_deductions FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update employee_deductions" ON public.employee_deductions FOR UPDATE USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete employee_deductions" ON public.employee_deductions FOR DELETE USING (has_company_access(auth.uid(), company_id));

-- Deduction items applied in a specific payroll calculation
CREATE TABLE public.payroll_calculation_deductions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  calculation_id UUID NOT NULL REFERENCES public.payroll_calculations(id) ON DELETE CASCADE,
  calculation_item_id UUID NOT NULL REFERENCES public.payroll_calculation_items(id) ON DELETE CASCADE,
  employee_deduction_id UUID NOT NULL REFERENCES public.employee_deductions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  deduction_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  installment_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_calculation_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payroll_calculation_deductions" ON public.payroll_calculation_deductions FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert payroll_calculation_deductions" ON public.payroll_calculation_deductions FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update payroll_calculation_deductions" ON public.payroll_calculation_deductions FOR UPDATE USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete payroll_calculation_deductions" ON public.payroll_calculation_deductions FOR DELETE USING (has_company_access(auth.uid(), company_id));
