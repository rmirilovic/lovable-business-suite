
-- Drop old policies
DROP POLICY IF EXISTS "Users can view payment orders for their company" ON public.payment_orders;
DROP POLICY IF EXISTS "Users can insert payment orders for their company" ON public.payment_orders;
DROP POLICY IF EXISTS "Users can update payment orders for their company" ON public.payment_orders;
DROP POLICY IF EXISTS "Users can delete payment orders for their company" ON public.payment_orders;

-- Create policies using has_company_access with super_admin bypass
CREATE POLICY "Users can view payment orders for their company"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert payment orders for their company"
  ON public.payment_orders FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update payment orders for their company"
  ON public.payment_orders FOR UPDATE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete payment orders for their company"
  ON public.payment_orders FOR DELETE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
