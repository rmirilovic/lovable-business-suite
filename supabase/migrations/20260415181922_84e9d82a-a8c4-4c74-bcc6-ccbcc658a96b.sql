
-- Drop existing permissive policies on payment_codes
DROP POLICY IF EXISTS "Users can view payment_codes" ON public.payment_codes;
DROP POLICY IF EXISTS "Users can insert payment_codes" ON public.payment_codes;
DROP POLICY IF EXISTS "Users can update payment_codes" ON public.payment_codes;
DROP POLICY IF EXISTS "Users can delete payment_codes" ON public.payment_codes;
DROP POLICY IF EXISTS "Authenticated users can view payment_codes" ON public.payment_codes;
DROP POLICY IF EXISTS "Authenticated users can insert payment_codes" ON public.payment_codes;
DROP POLICY IF EXISTS "Authenticated users can update payment_codes" ON public.payment_codes;
DROP POLICY IF EXISTS "Authenticated users can delete payment_codes" ON public.payment_codes;

-- Create company-scoped policies
CREATE POLICY "Users can view payment_codes for their company"
ON public.payment_codes FOR SELECT TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can insert payment_codes for their company"
ON public.payment_codes FOR INSERT TO authenticated
WITH CHECK (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can update payment_codes for their company"
ON public.payment_codes FOR UPDATE TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
)
WITH CHECK (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can delete payment_codes for their company"
ON public.payment_codes FOR DELETE TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);
