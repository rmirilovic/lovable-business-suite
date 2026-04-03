-- Add customs warehouse fields to warehouses table
ALTER TABLE public.warehouses 
  ADD COLUMN IF NOT EXISTS is_customs_warehouse boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customs_office_code text,
  ADD COLUMN IF NOT EXISTS customs_warehouse_code text;

-- Add customs fields to goods_purchase_invoices table
ALTER TABLE public.goods_purchase_invoices
  ADD COLUMN IF NOT EXISTS customs_declaration_number text,
  ADD COLUMN IF NOT EXISTS customs_declaration_date date,
  ADD COLUMN IF NOT EXISTS customs_office_code text;