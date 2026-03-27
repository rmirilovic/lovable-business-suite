
-- Payroll parameters (tax rates, contribution rates)
CREATE TABLE public.payroll_parameters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  valid_from DATE NOT NULL DEFAULT '2025-01-01',
  valid_to DATE,
  income_tax_rate NUMERIC NOT NULL DEFAULT 10,
  pio_employee_rate NUMERIC NOT NULL DEFAULT 14,
  pio_employer_rate NUMERIC NOT NULL DEFAULT 11.5,
  health_employee_rate NUMERIC NOT NULL DEFAULT 5.15,
  health_employer_rate NUMERIC NOT NULL DEFAULT 5.15,
  unemployment_rate NUMERIC NOT NULL DEFAULT 0.75,
  non_taxable_amount NUMERIC NOT NULL DEFAULT 25000,
  min_base_pio NUMERIC NOT NULL DEFAULT 40880,
  max_base_pio NUMERIC NOT NULL DEFAULT 584440,
  min_base_health NUMERIC NOT NULL DEFAULT 40880,
  is_active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_parameters_select" ON public.payroll_parameters
  FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "payroll_parameters_insert" ON public.payroll_parameters
  FOR INSERT TO authenticated
  WITH CHECK (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "payroll_parameters_update" ON public.payroll_parameters
  FOR UPDATE TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "payroll_parameters_delete" ON public.payroll_parameters
  FOR DELETE TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Payroll calculation types enum
CREATE TYPE public.payroll_calculation_type AS ENUM (
  'redovna_zarada',
  'ugovor_o_delu',
  'autorski_ugovor',
  'vlasnik',
  'penzioner'
);

-- Payroll calculations header
CREATE TABLE public.payroll_calculations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  calculation_number TEXT NOT NULL,
  calculation_type public.payroll_calculation_type NOT NULL DEFAULT 'redovna_zarada',
  calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  parameter_id UUID REFERENCES public.payroll_parameters(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  total_gross NUMERIC NOT NULL DEFAULT 0,
  total_net NUMERIC NOT NULL DEFAULT 0,
  total_tax NUMERIC NOT NULL DEFAULT 0,
  total_employee_contributions NUMERIC NOT NULL DEFAULT 0,
  total_employer_contributions NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  total_meal_allowance NUMERIC NOT NULL DEFAULT 0,
  total_transport_allowance NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID NOT NULL,
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_calculations_select" ON public.payroll_calculations
  FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "payroll_calculations_insert" ON public.payroll_calculations
  FOR INSERT TO authenticated
  WITH CHECK (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "payroll_calculations_update" ON public.payroll_calculations
  FOR UPDATE TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "payroll_calculations_delete" ON public.payroll_calculations
  FOR DELETE TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Payroll calculation items (per employee)
CREATE TABLE public.payroll_calculation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_id UUID NOT NULL REFERENCES public.payroll_calculations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  employee_number TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  gross_salary NUMERIC NOT NULL DEFAULT 0,
  non_taxable_amount NUMERIC NOT NULL DEFAULT 0,
  tax_base NUMERIC NOT NULL DEFAULT 0,
  income_tax NUMERIC NOT NULL DEFAULT 0,
  pio_employee NUMERIC NOT NULL DEFAULT 0,
  pio_employer NUMERIC NOT NULL DEFAULT 0,
  health_employee NUMERIC NOT NULL DEFAULT 0,
  health_employer NUMERIC NOT NULL DEFAULT 0,
  unemployment NUMERIC NOT NULL DEFAULT 0,
  total_employee_contributions NUMERIC NOT NULL DEFAULT 0,
  total_employer_contributions NUMERIC NOT NULL DEFAULT 0,
  net_salary NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  working_days INTEGER NOT NULL DEFAULT 0,
  worked_days INTEGER NOT NULL DEFAULT 0,
  hours_regular NUMERIC NOT NULL DEFAULT 0,
  hours_overtime NUMERIC NOT NULL DEFAULT 0,
  meal_allowance NUMERIC NOT NULL DEFAULT 0,
  transport_allowance NUMERIC NOT NULL DEFAULT 0,
  other_additions NUMERIC NOT NULL DEFAULT 0,
  other_deductions NUMERIC NOT NULL DEFAULT 0,
  item_order INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_calculation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_calc_items_select" ON public.payroll_calculation_items
  FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "payroll_calc_items_insert" ON public.payroll_calculation_items
  FOR INSERT TO authenticated
  WITH CHECK (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "payroll_calc_items_update" ON public.payroll_calculation_items
  FOR UPDATE TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "payroll_calc_items_delete" ON public.payroll_calculation_items
  FOR DELETE TO authenticated
  USING (has_company_access(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Trigger to recalculate totals
CREATE OR REPLACE FUNCTION public.recalculate_payroll_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.payroll_calculations SET
    total_gross = COALESCE((SELECT SUM(gross_salary) FROM public.payroll_calculation_items WHERE calculation_id = COALESCE(NEW.calculation_id, OLD.calculation_id)), 0),
    total_net = COALESCE((SELECT SUM(net_salary) FROM public.payroll_calculation_items WHERE calculation_id = COALESCE(NEW.calculation_id, OLD.calculation_id)), 0),
    total_tax = COALESCE((SELECT SUM(income_tax) FROM public.payroll_calculation_items WHERE calculation_id = COALESCE(NEW.calculation_id, OLD.calculation_id)), 0),
    total_employee_contributions = COALESCE((SELECT SUM(total_employee_contributions) FROM public.payroll_calculation_items WHERE calculation_id = COALESCE(NEW.calculation_id, OLD.calculation_id)), 0),
    total_employer_contributions = COALESCE((SELECT SUM(total_employer_contributions) FROM public.payroll_calculation_items WHERE calculation_id = COALESCE(NEW.calculation_id, OLD.calculation_id)), 0),
    total_cost = COALESCE((SELECT SUM(total_cost) FROM public.payroll_calculation_items WHERE calculation_id = COALESCE(NEW.calculation_id, OLD.calculation_id)), 0),
    total_meal_allowance = COALESCE((SELECT SUM(meal_allowance) FROM public.payroll_calculation_items WHERE calculation_id = COALESCE(NEW.calculation_id, OLD.calculation_id)), 0),
    total_transport_allowance = COALESCE((SELECT SUM(transport_allowance) FROM public.payroll_calculation_items WHERE calculation_id = COALESCE(NEW.calculation_id, OLD.calculation_id)), 0),
    updated_at = now()
  WHERE id = COALESCE(NEW.calculation_id, OLD.calculation_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER recalculate_payroll_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payroll_calculation_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_payroll_totals();
