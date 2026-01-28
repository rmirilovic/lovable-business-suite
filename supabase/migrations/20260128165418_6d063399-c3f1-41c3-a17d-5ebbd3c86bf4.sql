-- Add module for purchase invoices
INSERT INTO modules (code, name, description, module_type, parent_code, sort_order)
VALUES ('nabavka.ulazne_fakture', 'Ulazne fakture', 'Upravljanje ulaznim fakturama', 'nabavka', 'nabavka', 20)
ON CONFLICT (code) DO NOTHING;

-- Drop old policies for purchase_invoices
DROP POLICY IF EXISTS "Users can view purchase invoices for their companies" ON purchase_invoices;
DROP POLICY IF EXISTS "Users can create purchase invoices for their companies" ON purchase_invoices;
DROP POLICY IF EXISTS "Users can update purchase invoices for their companies" ON purchase_invoices;
DROP POLICY IF EXISTS "Users can delete draft purchase invoices for their companies" ON purchase_invoices;

-- Create new policies using can_user_read/can_user_write functions
CREATE POLICY "Users with read access can view purchase invoices"
  ON purchase_invoices FOR SELECT
  USING (can_user_read(auth.uid(), company_id, 'nabavka.ulazne_fakture', org_unit_id));

CREATE POLICY "Users with write access can insert purchase invoices"
  ON purchase_invoices FOR INSERT
  WITH CHECK (can_user_write(auth.uid(), company_id, 'nabavka.ulazne_fakture', org_unit_id));

CREATE POLICY "Users with write access can update purchase invoices"
  ON purchase_invoices FOR UPDATE
  USING (can_user_write(auth.uid(), company_id, 'nabavka.ulazne_fakture', org_unit_id));

CREATE POLICY "Users with write access can delete draft purchase invoices"
  ON purchase_invoices FOR DELETE
  USING (can_user_write(auth.uid(), company_id, 'nabavka.ulazne_fakture', org_unit_id) AND status = 'draft');

-- Drop old policies for purchase_invoice_items  
DROP POLICY IF EXISTS "Users can view purchase invoice items for their companies" ON purchase_invoice_items;
DROP POLICY IF EXISTS "Users can create purchase invoice items for their companies" ON purchase_invoice_items;
DROP POLICY IF EXISTS "Users can update purchase invoice items for their companies" ON purchase_invoice_items;
DROP POLICY IF EXISTS "Users can delete purchase invoice items for their companies" ON purchase_invoice_items;

-- Create new policies for items using can_user_read/can_user_write
CREATE POLICY "Users with read access can view purchase invoice items"
  ON purchase_invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_invoices pi 
      WHERE pi.id = purchase_invoice_items.purchase_invoice_id
      AND can_user_read(auth.uid(), pi.company_id, 'nabavka.ulazne_fakture', pi.org_unit_id)
    )
  );

CREATE POLICY "Users with write access can insert purchase invoice items"
  ON purchase_invoice_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_invoices pi 
      WHERE pi.id = purchase_invoice_items.purchase_invoice_id
      AND can_user_write(auth.uid(), pi.company_id, 'nabavka.ulazne_fakture', pi.org_unit_id)
    )
  );

CREATE POLICY "Users with write access can update purchase invoice items"
  ON purchase_invoice_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM purchase_invoices pi 
      WHERE pi.id = purchase_invoice_items.purchase_invoice_id
      AND can_user_write(auth.uid(), pi.company_id, 'nabavka.ulazne_fakture', pi.org_unit_id)
    )
  );

CREATE POLICY "Users with write access can delete purchase invoice items"
  ON purchase_invoice_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM purchase_invoices pi 
      WHERE pi.id = purchase_invoice_items.purchase_invoice_id
      AND can_user_write(auth.uid(), pi.company_id, 'nabavka.ulazne_fakture', pi.org_unit_id)
    )
  );