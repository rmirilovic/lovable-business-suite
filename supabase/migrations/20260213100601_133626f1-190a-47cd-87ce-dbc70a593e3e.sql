-- Fix RLS policies on calculation_ufu_links to use has_company_access function
DROP POLICY IF EXISTS "Users can view calculation_ufu_links" ON public.calculation_ufu_links;
DROP POLICY IF EXISTS "Users can insert calculation_ufu_links" ON public.calculation_ufu_links;
DROP POLICY IF EXISTS "Users can delete calculation_ufu_links" ON public.calculation_ufu_links;

CREATE POLICY "Users can view calculation_ufu_links" 
ON public.calculation_ufu_links FOR SELECT 
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert calculation_ufu_links" 
ON public.calculation_ufu_links FOR INSERT 
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete calculation_ufu_links" 
ON public.calculation_ufu_links FOR DELETE 
USING (has_company_access(auth.uid(), company_id));