
DROP POLICY IF EXISTS "Users can upload crm documents for their company" ON storage.objects;

CREATE POLICY "Users can upload crm documents for their company"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'crm-documents'
);
