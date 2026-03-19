
DROP POLICY IF EXISTS "Users can manage crm_types for their company" ON public.crm_types;

CREATE POLICY "Users can manage crm_types for their company" ON public.crm_types
FOR ALL USING (
  company_id IN (SELECT uc.company_id FROM user_companies uc WHERE uc.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
) WITH CHECK (
  company_id IN (SELECT uc.company_id FROM user_companies uc WHERE uc.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
);

-- Fix same issue for other CRM tables
DROP POLICY IF EXISTS "Users can manage crm_cases for their company" ON public.crm_cases;
CREATE POLICY "Users can manage crm_cases for their company" ON public.crm_cases
FOR ALL USING (
  company_id IN (SELECT uc.company_id FROM user_companies uc WHERE uc.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
) WITH CHECK (
  company_id IN (SELECT uc.company_id FROM user_companies uc WHERE uc.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
);

DROP POLICY IF EXISTS "Users can manage crm_workflow for their company" ON public.crm_workflow;
CREATE POLICY "Users can manage crm_workflow for their company" ON public.crm_workflow
FOR ALL USING (
  case_id IN (SELECT id FROM crm_cases WHERE company_id IN (SELECT uc.company_id FROM user_companies uc WHERE uc.user_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
) WITH CHECK (
  case_id IN (SELECT id FROM crm_cases WHERE company_id IN (SELECT uc.company_id FROM user_companies uc WHERE uc.user_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
);

DROP POLICY IF EXISTS "Users can manage crm_communications for their company" ON public.crm_communications;
CREATE POLICY "Users can manage crm_communications for their company" ON public.crm_communications
FOR ALL USING (
  case_id IN (SELECT id FROM crm_cases WHERE company_id IN (SELECT uc.company_id FROM user_companies uc WHERE uc.user_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
) WITH CHECK (
  case_id IN (SELECT id FROM crm_cases WHERE company_id IN (SELECT uc.company_id FROM user_companies uc WHERE uc.user_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
);

DROP POLICY IF EXISTS "Users can manage crm_documents for their company" ON public.crm_documents;
CREATE POLICY "Users can manage crm_documents for their company" ON public.crm_documents
FOR ALL USING (
  case_id IN (SELECT id FROM crm_cases WHERE company_id IN (SELECT uc.company_id FROM user_companies uc WHERE uc.user_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
) WITH CHECK (
  case_id IN (SELECT id FROM crm_cases WHERE company_id IN (SELECT uc.company_id FROM user_companies uc WHERE uc.user_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
);
