
ALTER TABLE public.popdv_report_detail_rows 
ADD COLUMN IF NOT EXISTS supplier_document_number text;
