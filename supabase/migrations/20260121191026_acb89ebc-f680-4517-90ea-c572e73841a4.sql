-- Add is_in_pdv column to partners table
ALTER TABLE public.partners 
ADD COLUMN is_in_pdv boolean NOT NULL DEFAULT true;