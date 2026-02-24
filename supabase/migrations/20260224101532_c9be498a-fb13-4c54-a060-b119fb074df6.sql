
-- Add idle timeout setting to companies table (in hours, NULL means disabled)
ALTER TABLE public.companies
ADD COLUMN idle_timeout_hours numeric DEFAULT NULL;

COMMENT ON COLUMN public.companies.idle_timeout_hours IS 'Idle timeout in hours. NULL means disabled.';
