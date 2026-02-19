-- Drop old restrictive policy
DROP POLICY IF EXISTS "Users can view document history for their companies" ON public.document_history;

-- Create new policy using has_company_access (same pattern as other tables)
CREATE POLICY "Users can view document history for their companies"
ON public.document_history
FOR SELECT
USING (has_company_access(auth.uid(), company_id));
