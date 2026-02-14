-- Drop old policies
DROP POLICY IF EXISTS "Users can view price adjustments for their company" ON price_adjustments;
DROP POLICY IF EXISTS "Users can insert price adjustments for their company" ON price_adjustments;
DROP POLICY IF EXISTS "Users can update price adjustments for their company" ON price_adjustments;
DROP POLICY IF EXISTS "Users can delete draft price adjustments" ON price_adjustments;

-- Recreate using has_company_access
CREATE POLICY "Users can view price adjustments for their company"
  ON price_adjustments FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert price adjustments for their company"
  ON price_adjustments FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update price adjustments for their company"
  ON price_adjustments FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete draft price adjustments"
  ON price_adjustments FOR DELETE
  USING (status = 'draft' AND has_company_access(auth.uid(), company_id));

-- Same for price_adjustment_items
DROP POLICY IF EXISTS "Users can view price adjustment items for their company" ON price_adjustment_items;
DROP POLICY IF EXISTS "Users can insert price adjustment items for their company" ON price_adjustment_items;
DROP POLICY IF EXISTS "Users can update price adjustment items for their company" ON price_adjustment_items;
DROP POLICY IF EXISTS "Users can delete price adjustment items for their company" ON price_adjustment_items;

CREATE POLICY "Users can view price adjustment items for their company"
  ON price_adjustment_items FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert price adjustment items for their company"
  ON price_adjustment_items FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update price adjustment items for their company"
  ON price_adjustment_items FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete price adjustment items for their company"
  ON price_adjustment_items FOR DELETE
  USING (has_company_access(auth.uid(), company_id));