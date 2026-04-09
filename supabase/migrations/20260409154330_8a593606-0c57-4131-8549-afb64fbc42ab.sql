
-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Allow all authenticated access to advance_purchase_invoices" ON public.advance_purchase_invoices;
DROP POLICY IF EXISTS "Allow authenticated access to advance_purchase_invoices" ON public.advance_purchase_invoices;

-- Create proper company-scoped policies with super_admin bypass
CREATE POLICY "Users can view their company advance purchase invoices"
ON public.advance_purchase_invoices FOR SELECT TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can create their company advance purchase invoices"
ON public.advance_purchase_invoices FOR INSERT TO authenticated
WITH CHECK (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can update their company advance purchase invoices"
ON public.advance_purchase_invoices FOR UPDATE TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
)
WITH CHECK (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can delete their company advance purchase invoices"
ON public.advance_purchase_invoices FOR DELETE TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);
