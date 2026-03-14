
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view incoming mail for their company" ON incoming_mail;
DROP POLICY IF EXISTS "Users can insert incoming mail" ON incoming_mail;
DROP POLICY IF EXISTS "Users can update incoming mail" ON incoming_mail;
DROP POLICY IF EXISTS "Users can delete incoming mail" ON incoming_mail;

-- Recreate with super_admin bypass
CREATE POLICY "Users can view incoming mail for their company" ON incoming_mail
FOR SELECT TO authenticated
USING (
  company_id IN (SELECT ura.company_id FROM user_role_assignments ura WHERE ura.user_id = auth.uid() AND ura.is_active = true)
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
);

CREATE POLICY "Users can insert incoming mail" ON incoming_mail
FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (SELECT ura.company_id FROM user_role_assignments ura WHERE ura.user_id = auth.uid() AND ura.is_active = true)
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
);

CREATE POLICY "Users can update incoming mail" ON incoming_mail
FOR UPDATE TO authenticated
USING (
  company_id IN (SELECT ura.company_id FROM user_role_assignments ura WHERE ura.user_id = auth.uid() AND ura.is_active = true)
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
);

CREATE POLICY "Users can delete incoming mail" ON incoming_mail
FOR DELETE TO authenticated
USING (
  company_id IN (SELECT ura.company_id FROM user_role_assignments ura WHERE ura.user_id = auth.uid() AND ura.is_active = true)
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
);
