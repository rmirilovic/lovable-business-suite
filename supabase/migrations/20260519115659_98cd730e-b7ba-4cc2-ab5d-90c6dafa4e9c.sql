
-- ============================================================
-- 1) employee_deductions: ukloni preširoku SELECT polisu i sve ostale preširoke polise
-- ============================================================
DROP POLICY IF EXISTS "Users can view employee_deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "Users can insert employee_deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "Users can update employee_deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "Users can delete employee_deductions" ON public.employee_deductions;

CREATE POLICY "employee_deductions_insert" ON public.employee_deductions
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.obracun'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "employee_deductions_update" ON public.employee_deductions
FOR UPDATE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.obracun'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "employee_deductions_delete" ON public.employee_deductions
FOR DELETE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.obracun'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

-- ============================================================
-- 2) employee_absences: zameni preširoke polise modul-uslovljenim
-- ============================================================
DROP POLICY IF EXISTS "absences_select" ON public.employee_absences;
DROP POLICY IF EXISTS "absences_insert" ON public.employee_absences;
DROP POLICY IF EXISTS "absences_update" ON public.employee_absences;
DROP POLICY IF EXISTS "absences_delete" ON public.employee_absences;

CREATE POLICY "absences_select" ON public.employee_absences
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.zaposleni'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "absences_insert" ON public.employee_absences
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.zaposleni'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "absences_update" ON public.employee_absences
FOR UPDATE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.zaposleni'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "absences_delete" ON public.employee_absences
FOR DELETE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.zaposleni'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

-- ============================================================
-- 3) employee_leave_funds: zameni preširoke polise modul-uslovljenim
-- ============================================================
DROP POLICY IF EXISTS "leave_funds_select" ON public.employee_leave_funds;
DROP POLICY IF EXISTS "leave_funds_insert" ON public.employee_leave_funds;
DROP POLICY IF EXISTS "leave_funds_update" ON public.employee_leave_funds;
DROP POLICY IF EXISTS "leave_funds_delete" ON public.employee_leave_funds;

CREATE POLICY "leave_funds_select" ON public.employee_leave_funds
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.zaposleni'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "leave_funds_insert" ON public.employee_leave_funds
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.zaposleni'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "leave_funds_update" ON public.employee_leave_funds
FOR UPDATE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.zaposleni'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "leave_funds_delete" ON public.employee_leave_funds
FOR DELETE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.zaposleni'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

-- ============================================================
-- 4) employees: ograniči INSERT/UPDATE/DELETE na modul zarade.zaposleni
-- ============================================================
DROP POLICY IF EXISTS "employees_insert" ON public.employees;
DROP POLICY IF EXISTS "employees_update" ON public.employees;
DROP POLICY IF EXISTS "employees_delete" ON public.employees;

CREATE POLICY "employees_insert" ON public.employees
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.zaposleni'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "employees_update" ON public.employees
FOR UPDATE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.zaposleni'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "employees_delete" ON public.employees
FOR DELETE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.zaposleni'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

-- ============================================================
-- 5) payroll_calculation_deductions: ukloni preširoke polise
-- ============================================================
DROP POLICY IF EXISTS "Users can view payroll_calculation_deductions" ON public.payroll_calculation_deductions;
DROP POLICY IF EXISTS "Users can insert payroll_calculation_deductions" ON public.payroll_calculation_deductions;
DROP POLICY IF EXISTS "Users can update payroll_calculation_deductions" ON public.payroll_calculation_deductions;
DROP POLICY IF EXISTS "Users can delete payroll_calculation_deductions" ON public.payroll_calculation_deductions;

CREATE POLICY "payroll_calc_deductions_select" ON public.payroll_calculation_deductions
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.obracun'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "payroll_calc_deductions_insert" ON public.payroll_calculation_deductions
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.obracun'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "payroll_calc_deductions_update" ON public.payroll_calculation_deductions
FOR UPDATE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.obracun'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "payroll_calc_deductions_delete" ON public.payroll_calculation_deductions
FOR DELETE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.obracun'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

-- ============================================================
-- 6) pp_pdv_returns: ukloni preširoku SELECT polisu (uža već postoji)
-- ============================================================
DROP POLICY IF EXISTS "Users can view pp_pdv_returns for their company" ON public.pp_pdv_returns;

-- ============================================================
-- 7) work_hours: ukloni preširoke polise i dodaj modul-uslovljene
-- ============================================================
DROP POLICY IF EXISTS "Users can view work_hours for their company" ON public.work_hours;
DROP POLICY IF EXISTS "Users can insert work_hours for their company" ON public.work_hours;
DROP POLICY IF EXISTS "Users can update work_hours for their company" ON public.work_hours;
DROP POLICY IF EXISTS "Users can delete work_hours for their company" ON public.work_hours;

CREATE POLICY "work_hours_select" ON public.work_hours
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.obracun'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "work_hours_insert" ON public.work_hours
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.obracun'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "work_hours_update" ON public.work_hours
FOR UPDATE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.obracun'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);

CREATE POLICY "work_hours_delete" ON public.work_hours
FOR DELETE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_local_admin_for_company(auth.uid(), company_id)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade.obracun'::text) <> 'none'::access_level)
  OR (get_user_access_level(auth.uid(), company_id, 'zarade'::text) <> 'none'::access_level)
);
