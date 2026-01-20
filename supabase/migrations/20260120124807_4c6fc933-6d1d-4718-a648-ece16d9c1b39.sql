-- Update default values for partners table
ALTER TABLE public.partners 
ALTER COLUMN payment_priority SET DEFAULT 3;

ALTER TABLE public.partners 
ALTER COLUMN country SET DEFAULT 'Srbija';