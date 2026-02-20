
-- Fix RLS policies for all reprocessing tables to allow super_admin users

-- reprocessing_work_orders
DROP POLICY IF EXISTS "Users can manage reprocessing work orders" ON public.reprocessing_work_orders;
CREATE POLICY "Users can manage reprocessing work orders"
ON public.reprocessing_work_orders
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_role_assignments WHERE user_id = auth.uid() AND is_active = true
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_role_assignments WHERE user_id = auth.uid() AND is_active = true
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- reprocessing_wo_output_items
DROP POLICY IF EXISTS "Users can manage reprocessing wo output" ON public.reprocessing_wo_output_items;
CREATE POLICY "Users can manage reprocessing wo output"
ON public.reprocessing_wo_output_items
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_role_assignments WHERE user_id = auth.uid() AND is_active = true
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_role_assignments WHERE user_id = auth.uid() AND is_active = true
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- reprocessing_wo_input_items
DROP POLICY IF EXISTS "Users can manage reprocessing wo input" ON public.reprocessing_wo_input_items;
CREATE POLICY "Users can manage reprocessing wo input"
ON public.reprocessing_wo_input_items
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_role_assignments WHERE user_id = auth.uid() AND is_active = true
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_role_assignments WHERE user_id = auth.uid() AND is_active = true
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- reprocessing_wo_materials
DROP POLICY IF EXISTS "Users can manage reprocessing wo materials" ON public.reprocessing_wo_materials;
CREATE POLICY "Users can manage reprocessing wo materials"
ON public.reprocessing_wo_materials
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_role_assignments WHERE user_id = auth.uid() AND is_active = true
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_role_assignments WHERE user_id = auth.uid() AND is_active = true
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- reprocessing_delivery_notes
DROP POLICY IF EXISTS "Users can manage reprocessing delivery notes" ON public.reprocessing_delivery_notes;
CREATE POLICY "Users can manage reprocessing delivery notes"
ON public.reprocessing_delivery_notes
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_role_assignments WHERE user_id = auth.uid() AND is_active = true
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_role_assignments WHERE user_id = auth.uid() AND is_active = true
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- reprocessing_delivery_note_items
DROP POLICY IF EXISTS "Users can manage reprocessing dn items" ON public.reprocessing_delivery_note_items;
CREATE POLICY "Users can manage reprocessing dn items"
ON public.reprocessing_delivery_note_items
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_role_assignments WHERE user_id = auth.uid() AND is_active = true
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_role_assignments WHERE user_id = auth.uid() AND is_active = true
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);
