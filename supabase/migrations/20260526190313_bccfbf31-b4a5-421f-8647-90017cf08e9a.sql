
-- Payroll calculation items: drop overly broad policies
DROP POLICY IF EXISTS payroll_calc_items_select ON public.payroll_calculation_items;
DROP POLICY IF EXISTS payroll_calc_items_insert ON public.payroll_calculation_items;
DROP POLICY IF EXISTS payroll_calc_items_update ON public.payroll_calculation_items;
DROP POLICY IF EXISTS payroll_calc_items_delete ON public.payroll_calculation_items;

CREATE POLICY payroll_calculation_items_insert ON public.payroll_calculation_items
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR is_local_admin_for_company(auth.uid(), company_id)
    OR get_user_access_level(auth.uid(), company_id, 'zarade.obracun') <> 'none'::access_level
    OR get_user_access_level(auth.uid(), company_id, 'zarade') <> 'none'::access_level
  );

CREATE POLICY payroll_calculation_items_update ON public.payroll_calculation_items
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR is_local_admin_for_company(auth.uid(), company_id)
    OR get_user_access_level(auth.uid(), company_id, 'zarade.obracun') <> 'none'::access_level
    OR get_user_access_level(auth.uid(), company_id, 'zarade') <> 'none'::access_level
  );

CREATE POLICY payroll_calculation_items_delete ON public.payroll_calculation_items
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR is_local_admin_for_company(auth.uid(), company_id)
    OR get_user_access_level(auth.uid(), company_id, 'zarade.obracun') <> 'none'::access_level
    OR get_user_access_level(auth.uid(), company_id, 'zarade') <> 'none'::access_level
  );

-- Payroll calculations: tighten write policies
DROP POLICY IF EXISTS payroll_calculations_insert ON public.payroll_calculations;
DROP POLICY IF EXISTS payroll_calculations_update ON public.payroll_calculations;
DROP POLICY IF EXISTS payroll_calculations_delete ON public.payroll_calculations;

CREATE POLICY payroll_calculations_insert ON public.payroll_calculations
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR is_local_admin_for_company(auth.uid(), company_id)
    OR get_user_access_level(auth.uid(), company_id, 'zarade.obracun') <> 'none'::access_level
    OR get_user_access_level(auth.uid(), company_id, 'zarade') <> 'none'::access_level
  );

CREATE POLICY payroll_calculations_update ON public.payroll_calculations
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR is_local_admin_for_company(auth.uid(), company_id)
    OR get_user_access_level(auth.uid(), company_id, 'zarade.obracun') <> 'none'::access_level
    OR get_user_access_level(auth.uid(), company_id, 'zarade') <> 'none'::access_level
  );

CREATE POLICY payroll_calculations_delete ON public.payroll_calculations
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR is_local_admin_for_company(auth.uid(), company_id)
    OR get_user_access_level(auth.uid(), company_id, 'zarade.obracun') <> 'none'::access_level
    OR get_user_access_level(auth.uid(), company_id, 'zarade') <> 'none'::access_level
  );

-- PP-PDV returns: enforce module check on writes
DROP POLICY IF EXISTS "Users can insert pp_pdv_returns for their company" ON public.pp_pdv_returns;
DROP POLICY IF EXISTS "Users can update pp_pdv_returns for their company" ON public.pp_pdv_returns;
DROP POLICY IF EXISTS "Users can delete draft pp_pdv_returns for their company" ON public.pp_pdv_returns;

CREATE POLICY pp_pdv_returns_insert ON public.pp_pdv_returns
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR is_local_admin_for_company(auth.uid(), company_id)
    OR get_user_access_level(auth.uid(), company_id, 'racunovodstvo') <> 'none'::access_level
  );

CREATE POLICY pp_pdv_returns_update ON public.pp_pdv_returns
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR is_local_admin_for_company(auth.uid(), company_id)
    OR get_user_access_level(auth.uid(), company_id, 'racunovodstvo') <> 'none'::access_level
  );

CREATE POLICY pp_pdv_returns_delete ON public.pp_pdv_returns
  FOR DELETE TO authenticated
  USING (
    (status = 'draft')
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR is_local_admin_for_company(auth.uid(), company_id)
      OR get_user_access_level(auth.uid(), company_id, 'racunovodstvo') <> 'none'::access_level
    )
  );

-- Active sessions: allow local admins to view/terminate sessions in their companies
CREATE POLICY "Local admins can view company sessions" ON public.active_sessions
  FOR SELECT TO authenticated
  USING (is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Local admins can delete company sessions" ON public.active_sessions
  FOR DELETE TO authenticated
  USING (is_local_admin_for_company(auth.uid(), company_id));
