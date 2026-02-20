
ALTER TABLE public.reprocessing_wo_input_items
ADD COLUMN warehouse_id UUID REFERENCES public.warehouses(id) DEFAULT NULL;
