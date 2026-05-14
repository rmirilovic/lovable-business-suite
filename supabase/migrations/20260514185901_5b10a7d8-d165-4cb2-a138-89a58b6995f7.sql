-- 1) Restrict modules SELECT to authenticated users only
DROP POLICY IF EXISTS "Everyone can view modules" ON public.modules;
CREATE POLICY "Authenticated users can view modules"
ON public.modules
FOR SELECT
TO authenticated
USING (true);

-- 2) mail-attachments: restrict SELECT and DELETE to users with access to the owning company
--    Files are stored as: <company_id>/<incoming_mail_id>/<filename>
DROP POLICY IF EXISTS "Authenticated users can view mail attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete mail attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload mail attachments" ON storage.objects;

CREATE POLICY "Company members can view mail attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'mail-attachments'
  AND public.has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Company members can upload mail attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mail-attachments'
  AND public.has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Company members can delete mail attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'mail-attachments'
  AND public.has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 3) company-logos: restrict write operations to super_admin (managed via Admin panel only).
--    Drop the broad public SELECT policy: bucket remains `public=true`, so public URLs continue to work
--    without granting `LIST` on storage.objects (which the broad SELECT exposes).
DROP POLICY IF EXISTS "Public can view company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete company logos" ON storage.objects;

CREATE POLICY "Super admins can upload company logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "Super admins can update company logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "Super admins can delete company logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
);