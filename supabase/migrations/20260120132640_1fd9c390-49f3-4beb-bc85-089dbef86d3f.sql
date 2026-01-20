-- Extend PIB and MB fields to 31 characters for partners table
ALTER TABLE public.partners 
ALTER COLUMN pib TYPE varchar(31);

ALTER TABLE public.partners 
ALTER COLUMN mb TYPE varchar(31);