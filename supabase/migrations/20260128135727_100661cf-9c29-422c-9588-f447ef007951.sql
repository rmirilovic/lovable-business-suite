-- Create purchase_invoices table
CREATE TABLE public.purchase_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id UUID NOT NULL REFERENCES public.business_years(id) ON DELETE CASCADE,
  org_unit_id UUID REFERENCES public.organizational_units(id),
  warehouse_id UUID REFERENCES public.warehouses(id),
  
  -- Internal tracking number (our numbering)
  internal_number VARCHAR(50) NOT NULL,
  -- Supplier's invoice number
  supplier_invoice_number VARCHAR(100) NOT NULL,
  
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  
  partner_id UUID NOT NULL REFERENCES public.partners(id),
  
  status document_status NOT NULL DEFAULT 'draft',
  
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  note TEXT,
  internal_note TEXT,
  
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create purchase_invoice_items table
CREATE TABLE public.purchase_invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  item_order INTEGER NOT NULL DEFAULT 1,
  article_id UUID REFERENCES public.articles(id),
  item_code VARCHAR(50),
  item_name VARCHAR(255) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'kom',
  quantity NUMERIC(15,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,4) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  
  line_subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_vat NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for purchase_invoices
CREATE POLICY "Users can view purchase invoices for their companies"
ON public.purchase_invoices FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create purchase invoices for their companies"
ON public.purchase_invoices FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update purchase invoices for their companies"
ON public.purchase_invoices FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete draft purchase invoices for their companies"
ON public.purchase_invoices FOR DELETE
USING (
  company_id IN (
    SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()
  )
  AND status = 'draft'
);

-- RLS policies for purchase_invoice_items
CREATE POLICY "Users can view purchase invoice items for their companies"
ON public.purchase_invoice_items FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create purchase invoice items for their companies"
ON public.purchase_invoice_items FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update purchase invoice items for their companies"
ON public.purchase_invoice_items FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete purchase invoice items for their companies"
ON public.purchase_invoice_items FOR DELETE
USING (
  company_id IN (
    SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()
  )
);

-- Create indexes
CREATE INDEX idx_purchase_invoices_company ON public.purchase_invoices(company_id);
CREATE INDEX idx_purchase_invoices_year ON public.purchase_invoices(business_year_id);
CREATE INDEX idx_purchase_invoices_partner ON public.purchase_invoices(partner_id);
CREATE INDEX idx_purchase_invoices_status ON public.purchase_invoices(status);
CREATE INDEX idx_purchase_invoice_items_invoice ON public.purchase_invoice_items(purchase_invoice_id);

-- Trigger for updated_at
CREATE TRIGGER update_purchase_invoices_updated_at
BEFORE UPDATE ON public.purchase_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();