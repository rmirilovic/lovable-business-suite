
-- Drop existing policies
DROP POLICY "Users can view detail rows for their company" ON public.popdv_report_detail_rows;
DROP POLICY "Users can insert detail rows for their company" ON public.popdv_report_detail_rows;
DROP POLICY "Users can update detail rows for their company" ON public.popdv_report_detail_rows;
DROP POLICY "Users can delete detail rows for their company" ON public.popdv_report_detail_rows;

-- Recreate with same pattern as popdv_reports
CREATE POLICY "Users can view detail rows for their company"
ON public.popdv_report_detail_rows FOR SELECT
USING (has_company_access(auth.uid(), company_id) OR EXISTS (
  SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'
));

CREATE POLICY "Users can insert detail rows for their company"
ON public.popdv_report_detail_rows FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id) OR EXISTS (
  SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'
));

CREATE POLICY "Users can update detail rows for their company"
ON public.popdv_report_detail_rows FOR UPDATE
USING (has_company_access(auth.uid(), company_id) OR EXISTS (
  SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'
));

CREATE POLICY "Users can delete detail rows for their company"
ON public.popdv_report_detail_rows FOR DELETE
USING (has_company_access(auth.uid(), company_id) OR EXISTS (
  SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'
));
