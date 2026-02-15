
-- Add currency support to goods purchase invoices (UFR)
ALTER TABLE public.goods_purchase_invoices
ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'RSD',
ADD COLUMN exchange_rate NUMERIC NOT NULL DEFAULT 1;

-- Add currency support to service purchase invoices (UFU)
ALTER TABLE public.service_purchase_invoices
ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'RSD',
ADD COLUMN exchange_rate NUMERIC NOT NULL DEFAULT 1;

-- Add foreign currency price to goods purchase invoice items
ALTER TABLE public.goods_purchase_invoice_items
ADD COLUMN foreign_unit_price NUMERIC NOT NULL DEFAULT 0;

-- Add foreign currency price to service purchase invoice items
ALTER TABLE public.service_purchase_invoice_items
ADD COLUMN foreign_unit_price NUMERIC NOT NULL DEFAULT 0;
