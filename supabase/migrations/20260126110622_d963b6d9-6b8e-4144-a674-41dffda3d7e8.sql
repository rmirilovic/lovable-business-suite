-- ===========================================
-- FAZA 3: PRODAJA - Korak 1: Osnovne tabele
-- ===========================================

-- 1. Dodaj PDV stopu na artikle
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 20;

-- 2. Enum za tipove dokumenata prodaje
DO $$ BEGIN
  CREATE TYPE public.sales_document_type AS ENUM ('quote', 'invoice', 'delivery_note');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Tabela za ponude (quotes) - SAMOSTALNA
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id uuid NOT NULL REFERENCES public.business_years(id),
  org_unit_id uuid REFERENCES public.organizational_units(id),
  
  quote_number text NOT NULL,
  quote_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  
  partner_id uuid NOT NULL REFERENCES public.partners(id),
  
  status document_status NOT NULL DEFAULT 'draft',
  
  converted_to_invoice_id uuid, -- FK dodaje se kasnije
  converted_at timestamptz,
  
  subtotal numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  
  note text,
  internal_note text,
  
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(company_id, business_year_id, quote_number)
);

-- 4. Stavke ponude
CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  
  item_order integer NOT NULL DEFAULT 0,
  article_id uuid REFERENCES public.articles(id),
  
  item_code text,
  item_name text NOT NULL,
  unit text NOT NULL DEFAULT 'kom',
  
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 20,
  
  line_subtotal numeric NOT NULL DEFAULT 0,
  line_vat numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  
  description text,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Tabela za otpremnice (delivery notes) - MORA BITI PRE INVOICES
CREATE TABLE public.delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id uuid NOT NULL REFERENCES public.business_years(id),
  org_unit_id uuid REFERENCES public.organizational_units(id),
  warehouse_id uuid REFERENCES public.warehouses(id),
  
  delivery_number text NOT NULL,
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  
  partner_id uuid NOT NULL REFERENCES public.partners(id),
  
  status document_status NOT NULL DEFAULT 'draft',
  posted_at timestamptz,
  posted_by uuid,
  
  invoice_id uuid, -- FK dodaje se kasnije
  
  note text,
  internal_note text,
  
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(company_id, business_year_id, delivery_number)
);

-- 6. Stavke otpremnice
CREATE TABLE public.delivery_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id uuid NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  
  item_order integer NOT NULL DEFAULT 0,
  
  article_id uuid NOT NULL REFERENCES public.articles(id),
  item_code text NOT NULL,
  item_name text NOT NULL,
  unit text NOT NULL DEFAULT 'kom',
  
  quantity numeric NOT NULL DEFAULT 1,
  
  description text,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Tabela za fakture (invoices)
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id uuid NOT NULL REFERENCES public.business_years(id),
  org_unit_id uuid REFERENCES public.organizational_units(id),
  
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  
  partner_id uuid NOT NULL REFERENCES public.partners(id),
  
  status document_status NOT NULL DEFAULT 'draft',
  posted_at timestamptz,
  posted_by uuid,
  
  source_quote_id uuid REFERENCES public.quotes(id),
  source_delivery_note_id uuid REFERENCES public.delivery_notes(id),
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  
  subtotal numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  
  note text,
  internal_note text,
  
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(company_id, business_year_id, invoice_number)
);

-- 8. Stavke fakture
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  
  item_order integer NOT NULL DEFAULT 0,
  
  article_id uuid REFERENCES public.articles(id),
  item_code text,
  item_name text NOT NULL,
  unit text NOT NULL DEFAULT 'kom',
  
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 20,
  
  line_subtotal numeric NOT NULL DEFAULT 0,
  line_vat numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  
  description text,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Dodaj cross-reference foreign keys
ALTER TABLE public.quotes
ADD CONSTRAINT quotes_converted_to_invoice_id_fkey 
FOREIGN KEY (converted_to_invoice_id) REFERENCES public.invoices(id);

ALTER TABLE public.delivery_notes
ADD CONSTRAINT delivery_notes_invoice_id_fkey 
FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

-- 10. Enable RLS na svim tabelama
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies za Quotes
CREATE POLICY "Users can view quotes from their companies" 
ON public.quotes FOR SELECT 
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users with write access can insert quotes" 
ON public.quotes FOR INSERT 
WITH CHECK (can_user_write(auth.uid(), company_id, 'prodaja.ponude', org_unit_id));

CREATE POLICY "Users can update draft quotes" 
ON public.quotes FOR UPDATE 
USING (status = 'draft' AND can_user_write(auth.uid(), company_id, 'prodaja.ponude', org_unit_id));

CREATE POLICY "Admins can delete draft quotes" 
ON public.quotes FOR DELETE 
USING (status = 'draft' AND (has_role(auth.uid(), 'super_admin') OR is_local_admin_for_company(auth.uid(), company_id)));

-- 12. RLS Policies za Quote Items
CREATE POLICY "Users can view quote items from their companies" 
ON public.quote_items FOR SELECT 
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage quote items" 
ON public.quote_items FOR ALL 
USING (EXISTS (
  SELECT 1 FROM quotes q 
  WHERE q.id = quote_items.quote_id 
    AND q.status = 'draft' 
    AND can_user_write(auth.uid(), q.company_id, 'prodaja.ponude', q.org_unit_id)
));

-- 13. RLS Policies za Invoices
CREATE POLICY "Users can view invoices from their companies" 
ON public.invoices FOR SELECT 
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users with write access can insert invoices" 
ON public.invoices FOR INSERT 
WITH CHECK (can_user_write(auth.uid(), company_id, 'prodaja.fakture', org_unit_id));

CREATE POLICY "Users can update draft invoices" 
ON public.invoices FOR UPDATE 
USING (status = 'draft' AND can_user_write(auth.uid(), company_id, 'prodaja.fakture', org_unit_id));

CREATE POLICY "Admins can delete draft invoices" 
ON public.invoices FOR DELETE 
USING (status = 'draft' AND (has_role(auth.uid(), 'super_admin') OR is_local_admin_for_company(auth.uid(), company_id)));

-- 14. RLS Policies za Invoice Items
CREATE POLICY "Users can view invoice items from their companies" 
ON public.invoice_items FOR SELECT 
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage invoice items" 
ON public.invoice_items FOR ALL 
USING (EXISTS (
  SELECT 1 FROM invoices i 
  WHERE i.id = invoice_items.invoice_id 
    AND i.status = 'draft' 
    AND can_user_write(auth.uid(), i.company_id, 'prodaja.fakture', i.org_unit_id)
));

-- 15. RLS Policies za Delivery Notes
CREATE POLICY "Users can view delivery notes from their companies" 
ON public.delivery_notes FOR SELECT 
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users with write access can insert delivery notes" 
ON public.delivery_notes FOR INSERT 
WITH CHECK (can_user_write(auth.uid(), company_id, 'prodaja.otpremnice', org_unit_id));

CREATE POLICY "Users can update draft delivery notes" 
ON public.delivery_notes FOR UPDATE 
USING (status = 'draft' AND can_user_write(auth.uid(), company_id, 'prodaja.otpremnice', org_unit_id));

CREATE POLICY "Admins can delete draft delivery notes" 
ON public.delivery_notes FOR DELETE 
USING (status = 'draft' AND (has_role(auth.uid(), 'super_admin') OR is_local_admin_for_company(auth.uid(), company_id)));

-- 16. RLS Policies za Delivery Note Items
CREATE POLICY "Users can view delivery note items from their companies" 
ON public.delivery_note_items FOR SELECT 
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage delivery note items" 
ON public.delivery_note_items FOR ALL 
USING (EXISTS (
  SELECT 1 FROM delivery_notes dn 
  WHERE dn.id = delivery_note_items.delivery_note_id 
    AND dn.status = 'draft' 
    AND can_user_write(auth.uid(), dn.company_id, 'prodaja.otpremnice', dn.org_unit_id)
));

-- 17. Funkcija za generisanje broja dokumenta
CREATE OR REPLACE FUNCTION public.get_next_document_number(
  _company_id uuid,
  _year_id uuid,
  _doc_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year integer;
  _next_num integer;
  _prefix text;
BEGIN
  SELECT year INTO _year FROM business_years WHERE id = _year_id;
  
  CASE _doc_type
    WHEN 'quote' THEN _prefix := 'PON';
    WHEN 'invoice' THEN _prefix := 'FAK';
    WHEN 'delivery_note' THEN _prefix := 'OTP';
    ELSE _prefix := 'DOK';
  END CASE;
  
  CASE _doc_type
    WHEN 'quote' THEN
      SELECT COALESCE(MAX(
        NULLIF(regexp_replace(quote_number, '[^0-9]', '', 'g'), '')::integer
      ), 0) + 1 INTO _next_num
      FROM quotes
      WHERE company_id = _company_id AND business_year_id = _year_id;
    WHEN 'invoice' THEN
      SELECT COALESCE(MAX(
        NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '')::integer
      ), 0) + 1 INTO _next_num
      FROM invoices
      WHERE company_id = _company_id AND business_year_id = _year_id;
    WHEN 'delivery_note' THEN
      SELECT COALESCE(MAX(
        NULLIF(regexp_replace(delivery_number, '[^0-9]', '', 'g'), '')::integer
      ), 0) + 1 INTO _next_num
      FROM delivery_notes
      WHERE company_id = _company_id AND business_year_id = _year_id;
    ELSE
      _next_num := 1;
  END CASE;
  
  RETURN _prefix || '-' || _year || '-' || LPAD(_next_num::text, 4, '0');
END;
$$;

-- 18. Dodaj module za prodaju
INSERT INTO public.modules (code, name, module_type, parent_code, sort_order, description)
VALUES 
  ('prodaja', 'Prodaja', 'prodaja', NULL, 50, 'Modul prodaje'),
  ('prodaja.ponude', 'Ponude', 'prodaja', 'prodaja', 51, 'Upravljanje ponudama'),
  ('prodaja.fakture', 'Fakture', 'prodaja', 'prodaja', 52, 'Upravljanje izlaznim fakturama'),
  ('prodaja.otpremnice', 'Otpremnice', 'prodaja', 'prodaja', 53, 'Upravljanje otpremnicama')
ON CONFLICT (code) DO NOTHING;

-- 19. Trigger za ažuriranje updated_at
CREATE OR REPLACE FUNCTION public.update_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.update_sales_updated_at();

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_sales_updated_at();

CREATE TRIGGER update_delivery_notes_updated_at
BEFORE UPDATE ON public.delivery_notes
FOR EACH ROW EXECUTE FUNCTION public.update_sales_updated_at();

-- 20. Indeksi za performanse
CREATE INDEX idx_quotes_company_year ON public.quotes(company_id, business_year_id);
CREATE INDEX idx_quotes_partner ON public.quotes(partner_id);
CREATE INDEX idx_quotes_status ON public.quotes(status);

CREATE INDEX idx_invoices_company_year ON public.invoices(company_id, business_year_id);
CREATE INDEX idx_invoices_partner ON public.invoices(partner_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);

CREATE INDEX idx_delivery_notes_company_year ON public.delivery_notes(company_id, business_year_id);
CREATE INDEX idx_delivery_notes_partner ON public.delivery_notes(partner_id);
CREATE INDEX idx_delivery_notes_status ON public.delivery_notes(status);