-- Add 'approved' status to document_status enum
ALTER TYPE public.document_status ADD VALUE IF NOT EXISTS 'approved' AFTER 'draft';

-- Add approved_by and approved_at columns to quotes table
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;