
DROP POLICY IF EXISTS "Users can upload crm documents for their company" ON storage.objects;

CREATE POLICY "Users can upload crm documents for their company"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'crm-documents'
  AND (
    has_company_access(auth.uid(), (storage.foldername(name))[1]::uuid)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
);
