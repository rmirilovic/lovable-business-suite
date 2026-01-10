-- Allow local admins to update their companies
CREATE POLICY "Local admins can update their companies" 
ON public.companies 
FOR UPDATE 
USING (is_local_admin_for_company(auth.uid(), id))
WITH CHECK (is_local_admin_for_company(auth.uid(), id));