
-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert reservations for their company" ON public.warehouse_reservations;
DROP POLICY IF EXISTS "Users can view reservations for their company" ON public.warehouse_reservations;
DROP POLICY IF EXISTS "Users can update reservations for their company" ON public.warehouse_reservations;
DROP POLICY IF EXISTS "Users can delete reservations for their company" ON public.warehouse_reservations;

-- Recreate with super_admin bypass
CREATE POLICY "Users can view reservations for their company"
  ON public.warehouse_reservations FOR SELECT
  USING (
    company_id IN (SELECT ura.company_id FROM user_role_assignments ura WHERE ura.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

CREATE POLICY "Users can insert reservations for their company"
  ON public.warehouse_reservations FOR INSERT
  WITH CHECK (
    company_id IN (SELECT ura.company_id FROM user_role_assignments ura WHERE ura.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

CREATE POLICY "Users can update reservations for their company"
  ON public.warehouse_reservations FOR UPDATE
  USING (
    company_id IN (SELECT ura.company_id FROM user_role_assignments ura WHERE ura.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

CREATE POLICY "Users can delete reservations for their company"
  ON public.warehouse_reservations FOR DELETE
  USING (
    company_id IN (SELECT ura.company_id FROM user_role_assignments ura WHERE ura.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );
