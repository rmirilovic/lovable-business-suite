DROP POLICY IF EXISTS "Users can read partner history" ON public.partner_history;

CREATE POLICY "Users can read partner history"
  ON public.partner_history
  FOR SELECT
  TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));