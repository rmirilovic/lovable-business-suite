-- Create goods_receipts table (Prijemnice)
CREATE TABLE public.goods_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id UUID NOT NULL REFERENCES public.business_years(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  receipt_number TEXT NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_invoice_id UUID REFERENCES public.goods_purchase_invoices(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create goods_receipt_items table
CREATE TABLE public.goods_receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  item_code TEXT,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kom',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for goods_receipts
CREATE POLICY "Users can view goods_receipts for their companies"
ON public.goods_receipts FOR SELECT
USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert goods_receipts for their companies"
ON public.goods_receipts FOR INSERT
WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update goods_receipts for their companies"
ON public.goods_receipts FOR UPDATE
USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete goods_receipts for their companies"
ON public.goods_receipts FOR DELETE
USING (public.has_company_access(auth.uid(), company_id));

-- RLS policies for goods_receipt_items
CREATE POLICY "Users can view goods_receipt_items for their companies"
ON public.goods_receipt_items FOR SELECT
USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert goods_receipt_items for their companies"
ON public.goods_receipt_items FOR INSERT
WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update goods_receipt_items for their companies"
ON public.goods_receipt_items FOR UPDATE
USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete goods_receipt_items for their companies"
ON public.goods_receipt_items FOR DELETE
USING (public.has_company_access(auth.uid(), company_id));

-- Create updated_at trigger
CREATE TRIGGER update_goods_receipts_updated_at
  BEFORE UPDATE ON public.goods_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();