-- Add RLS policy for local admins to view profiles of users in their companies
CREATE POLICY "Local admins can view profiles of users in their companies" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_companies uc1
    JOIN public.user_companies uc2 ON uc1.company_id = uc2.company_id
    WHERE uc1.user_id = auth.uid() 
    AND uc1.is_local_admin = true
    AND uc2.user_id = profiles.id
  )
);