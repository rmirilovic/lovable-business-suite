-- Drop the integer-based check constraint
ALTER TABLE public.popdv_report_cells DROP CONSTRAINT popdv_report_cells_section_check;

-- Change section column from integer to text
ALTER TABLE public.popdv_report_cells ALTER COLUMN section TYPE text USING section::text;