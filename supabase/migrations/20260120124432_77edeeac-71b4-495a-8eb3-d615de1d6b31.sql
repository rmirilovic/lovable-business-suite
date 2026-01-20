-- Add payment_priority column to partners table
-- Values: 1 = I prioritet, 2 = II prioritet, 3 = III prioritet, NULL = nije definisano
ALTER TABLE public.partners 
ADD COLUMN payment_priority smallint DEFAULT NULL;