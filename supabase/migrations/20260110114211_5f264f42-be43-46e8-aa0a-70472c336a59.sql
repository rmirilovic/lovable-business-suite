-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload logos
CREATE POLICY "Authenticated users can upload company logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-logos');

-- Allow public read access to logos
CREATE POLICY "Public can view company logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update company logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'company-logos');

-- Allow authenticated users to delete logos
CREATE POLICY "Authenticated users can delete company logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'company-logos');