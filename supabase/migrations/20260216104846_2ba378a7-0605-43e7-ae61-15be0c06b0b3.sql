
-- Drop wrong policies and recreate with has_company_access

-- material_norms
DROP POLICY IF EXISTS "Users can view material_norms for their company" ON public.material_norms;
DROP POLICY IF EXISTS "Users can insert material_norms for their company" ON public.material_norms;
DROP POLICY IF EXISTS "Users can update material_norms for their company" ON public.material_norms;
DROP POLICY IF EXISTS "Users can delete material_norms for their company" ON public.material_norms;

CREATE POLICY "Users can view material_norms for their company" ON public.material_norms FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert material_norms for their company" ON public.material_norms FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update material_norms for their company" ON public.material_norms FOR UPDATE USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete material_norms for their company" ON public.material_norms FOR DELETE USING (has_company_access(auth.uid(), company_id));

-- material_norm_variants
DROP POLICY IF EXISTS "Users can view material_norm_variants for their company" ON public.material_norm_variants;
DROP POLICY IF EXISTS "Users can insert material_norm_variants for their company" ON public.material_norm_variants;
DROP POLICY IF EXISTS "Users can update material_norm_variants for their company" ON public.material_norm_variants;
DROP POLICY IF EXISTS "Users can delete material_norm_variants for their company" ON public.material_norm_variants;

CREATE POLICY "Users can view material_norm_variants for their company" ON public.material_norm_variants FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert material_norm_variants for their company" ON public.material_norm_variants FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update material_norm_variants for their company" ON public.material_norm_variants FOR UPDATE USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete material_norm_variants for their company" ON public.material_norm_variants FOR DELETE USING (has_company_access(auth.uid(), company_id));

-- material_norm_items
DROP POLICY IF EXISTS "Users can view material_norm_items for their company" ON public.material_norm_items;
DROP POLICY IF EXISTS "Users can insert material_norm_items for their company" ON public.material_norm_items;
DROP POLICY IF EXISTS "Users can update material_norm_items for their company" ON public.material_norm_items;
DROP POLICY IF EXISTS "Users can delete material_norm_items for their company" ON public.material_norm_items;

CREATE POLICY "Users can view material_norm_items for their company" ON public.material_norm_items FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert material_norm_items for their company" ON public.material_norm_items FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update material_norm_items for their company" ON public.material_norm_items FOR UPDATE USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete material_norm_items for their company" ON public.material_norm_items FOR DELETE USING (has_company_access(auth.uid(), company_id));
