-- First, create a SECURITY DEFINER function to check local admin status without triggering RLS
CREATE OR REPLACE FUNCTION public.is_local_admin_for_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = _user_id 
      AND company_id = _company_id 
      AND is_local_admin = true
  )
$$;

-- Drop the problematic recursive policy on user_companies
DROP POLICY IF EXISTS "Local admins can manage company users" ON public.user_companies;

-- Recreate it using the SECURITY DEFINER function to avoid recursion
CREATE POLICY "Local admins can manage company users"
ON public.user_companies
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin') 
  OR public.is_local_admin_for_company(auth.uid(), company_id)
);

-- Also fix the business_years policy that may have the same issue
DROP POLICY IF EXISTS "Local admins can manage business years" ON public.business_years;

CREATE POLICY "Local admins can manage business years"
ON public.business_years
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin') 
  OR public.is_local_admin_for_company(auth.uid(), company_id)
);