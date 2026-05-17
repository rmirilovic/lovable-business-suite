
-- 1) Restrict SELECT on payroll / employee tables to admins or users with 'zarade' module access
-- employees
DROP POLICY IF EXISTS employees_select ON public.employees;
CREATE POLICY employees_select ON public.employees
FOR SELECT USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.is_local_admin_for_company(auth.uid(), company_id)
  OR public.get_user_access_level(auth.uid(), company_id, 'zarade.zaposleni') <> 'none'::access_level
  OR public.get_user_access_level(auth.uid(), company_id, 'zarade') <> 'none'::access_level
);

-- payroll_calculations
DROP POLICY IF EXISTS payroll_calculations_select ON public.payroll_calculations;
CREATE POLICY payroll_calculations_select ON public.payroll_calculations
FOR SELECT USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.is_local_admin_for_company(auth.uid(), company_id)
  OR public.get_user_access_level(auth.uid(), company_id, 'zarade.obracun') <> 'none'::access_level
  OR public.get_user_access_level(auth.uid(), company_id, 'zarade') <> 'none'::access_level
);

-- payroll_calculation_items
DROP POLICY IF EXISTS payroll_calculation_items_select ON public.payroll_calculation_items;
CREATE POLICY payroll_calculation_items_select ON public.payroll_calculation_items
FOR SELECT USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.is_local_admin_for_company(auth.uid(), company_id)
  OR public.get_user_access_level(auth.uid(), company_id, 'zarade.obracun') <> 'none'::access_level
  OR public.get_user_access_level(auth.uid(), company_id, 'zarade') <> 'none'::access_level
);

-- employee_deductions
DROP POLICY IF EXISTS employee_deductions_select ON public.employee_deductions;
CREATE POLICY employee_deductions_select ON public.employee_deductions
FOR SELECT USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.is_local_admin_for_company(auth.uid(), company_id)
  OR public.get_user_access_level(auth.uid(), company_id, 'zarade.obracun') <> 'none'::access_level
  OR public.get_user_access_level(auth.uid(), company_id, 'zarade') <> 'none'::access_level
);

-- 2) Restrict SELECT on pp_pdv_returns (contains JMBG) to admins or users with 'racunovodstvo' access
DROP POLICY IF EXISTS pp_pdv_returns_select ON public.pp_pdv_returns;
CREATE POLICY pp_pdv_returns_select ON public.pp_pdv_returns
FOR SELECT USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.is_local_admin_for_company(auth.uid(), company_id)
  OR public.get_user_access_level(auth.uid(), company_id, 'racunovodstvo') <> 'none'::access_level
);

-- 3) login_audit_log: remove UPDATE policy (audit logs must be immutable)
DROP POLICY IF EXISTS "Users can update company on their own login logs" ON public.login_audit_log;

-- 4) Drop duplicate {public}-role CRM policies (keep {authenticated} ones)
DROP POLICY IF EXISTS "Users can manage crm_workflow for their company" ON public.crm_workflow;
DROP POLICY IF EXISTS "Users can manage crm_communications for their company" ON public.crm_communications;
DROP POLICY IF EXISTS "Users can manage crm_documents for their company" ON public.crm_documents;
