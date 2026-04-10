CREATE POLICY "Local admins can view login audit logs for their company"
ON public.login_audit_log
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_companies.user_id = auth.uid()
      AND user_companies.company_id = login_audit_log.company_id
      AND user_companies.is_local_admin = true
  )
);