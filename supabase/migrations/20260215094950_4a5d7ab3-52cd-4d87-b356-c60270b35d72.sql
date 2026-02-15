
-- Fix RLS policies for inter_warehouse_transfers to use has_company_access function
DROP POLICY IF EXISTS "Users can view transfers for their companies" ON inter_warehouse_transfers;
DROP POLICY IF EXISTS "Users can insert transfers for their companies" ON inter_warehouse_transfers;
DROP POLICY IF EXISTS "Users can update transfers for their companies" ON inter_warehouse_transfers;
DROP POLICY IF EXISTS "Users can delete transfers for their companies" ON inter_warehouse_transfers;

CREATE POLICY "Users can view transfers for their companies" ON inter_warehouse_transfers FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert transfers for their companies" ON inter_warehouse_transfers FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update transfers for their companies" ON inter_warehouse_transfers FOR UPDATE USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete transfers for their companies" ON inter_warehouse_transfers FOR DELETE USING (has_company_access(auth.uid(), company_id));

-- Fix RLS policies for inter_warehouse_transfer_items too
DROP POLICY IF EXISTS "Users can view transfer items for their companies" ON inter_warehouse_transfer_items;
DROP POLICY IF EXISTS "Users can insert transfer items for their companies" ON inter_warehouse_transfer_items;
DROP POLICY IF EXISTS "Users can update transfer items for their companies" ON inter_warehouse_transfer_items;
DROP POLICY IF EXISTS "Users can delete transfer items for their companies" ON inter_warehouse_transfer_items;

CREATE POLICY "Users can view transfer items for their companies" ON inter_warehouse_transfer_items FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert transfer items for their companies" ON inter_warehouse_transfer_items FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update transfer items for their companies" ON inter_warehouse_transfer_items FOR UPDATE USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete transfer items for their companies" ON inter_warehouse_transfer_items FOR DELETE USING (has_company_access(auth.uid(), company_id));
