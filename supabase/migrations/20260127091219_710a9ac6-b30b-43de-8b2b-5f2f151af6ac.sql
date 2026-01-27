-- Add header note field to quotes table
ALTER TABLE public.quotes 
ADD COLUMN header_note TEXT;