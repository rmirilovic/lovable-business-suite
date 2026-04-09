
UPDATE storage.buckets SET file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'] WHERE id = 'avatars';

UPDATE storage.buckets SET file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'] WHERE id = 'company-logos';

UPDATE storage.buckets SET file_size_limit = 10485760 WHERE id = 'crm-documents';
