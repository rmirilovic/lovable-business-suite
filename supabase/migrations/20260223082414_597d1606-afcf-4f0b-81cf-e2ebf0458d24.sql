ALTER TABLE public.delivery_order_items ADD COLUMN unit_price numeric NOT NULL DEFAULT 0;
ALTER TABLE public.delivery_order_items ADD COLUMN line_total numeric NOT NULL DEFAULT 0;