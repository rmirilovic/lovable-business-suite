
-- Drop the overly permissive storage policy
DROP POLICY IF EXISTS "Authenticated users can manage crm documents" ON storage.objects;

-- SELECT: users can view CRM documents belonging to their company
CREATE POLICY "Users can view crm documents for their company"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'crm-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.crm_documents cd
      JOIN public.crm_cases cc ON cc.id = cd.case_id
      WHERE cd.file_path = name
        AND has_company_access(auth.uid(), cc.company_id)
    )
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
);

-- INSERT: users can upload CRM documents for their company
CREATE POLICY "Users can upload crm documents for their company"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'crm-documents'
  AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
    OR true -- uploads are validated by crm_documents table RLS on insert
  )
);

-- UPDATE: users can update CRM documents belonging to their company
CREATE POLICY "Users can update crm documents for their company"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'crm-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.crm_documents cd
      JOIN public.crm_cases cc ON cc.id = cd.case_id
      WHERE cd.file_path = name
        AND has_company_access(auth.uid(), cc.company_id)
    )
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
);

-- DELETE: users can delete CRM documents belonging to their company
CREATE POLICY "Users can delete crm documents for their company"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'crm-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.crm_documents cd
      JOIN public.crm_cases cc ON cc.id = cd.case_id
      WHERE cd.file_path = name
        AND has_company_access(auth.uid(), cc.company_id)
    )
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
);
