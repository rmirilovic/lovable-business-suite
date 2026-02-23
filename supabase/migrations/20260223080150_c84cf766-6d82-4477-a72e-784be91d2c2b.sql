
-- Create delivery_orders table
CREATE TABLE public.delivery_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  order_number TEXT NOT NULL,
  order_date TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
  partner_id UUID NOT NULL REFERENCES public.partners(id),
  delivery_address TEXT,
  delivery_method TEXT,
  warehouse_id UUID REFERENCES public.warehouses(id),
  payment_method TEXT,
  contact_person TEXT,
  ordered_by TEXT,
  note TEXT,
  composed_by TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'reserved', 'shipped')),
  source_quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  delivery_note_id UUID REFERENCES public.delivery_notes(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID
);

-- Create delivery_order_items table
CREATE TABLE public.delivery_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_order_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  article_id UUID NOT NULL REFERENCES public.articles(id),
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'kom',
  quantity NUMERIC NOT NULL DEFAULT 0,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_order_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for delivery_orders
CREATE POLICY "select_delivery_orders" ON public.delivery_orders FOR SELECT
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "insert_delivery_orders" ON public.delivery_orders FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "update_delivery_orders" ON public.delivery_orders FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "delete_delivery_orders" ON public.delivery_orders FOR DELETE
  USING (has_company_access(auth.uid(), company_id));

-- RLS policies for delivery_order_items
CREATE POLICY "select_delivery_order_items" ON public.delivery_order_items FOR SELECT
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "insert_delivery_order_items" ON public.delivery_order_items FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));
CREATE POLICY "update_delivery_order_items" ON public.delivery_order_items FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "delete_delivery_order_items" ON public.delivery_order_items FOR DELETE
  USING (has_company_access(auth.uid(), company_id));

-- Trigger for updated_at
CREATE TRIGGER update_delivery_orders_updated_at
  BEFORE UPDATE ON public.delivery_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
