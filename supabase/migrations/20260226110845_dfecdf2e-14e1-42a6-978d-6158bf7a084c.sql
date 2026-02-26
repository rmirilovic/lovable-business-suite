
-- ========================================
-- ADVANCE INVOICES (Avansni računi)
-- ========================================

CREATE TABLE public.advance_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  business_year_id uuid NOT NULL REFERENCES public.business_years(id),
  org_unit_id uuid REFERENCES public.organizational_units(id),
  advance_number text NOT NULL,
  advance_date text NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
  due_date text,
  partner_id uuid NOT NULL REFERENCES public.partners(id),
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  note text,
  internal_note text,
  header_note text,
  currency text NOT NULL DEFAULT 'RSD',
  payment_means_code text NOT NULL DEFAULT '30',
  partner_country_code text NOT NULL DEFAULT 'RS',
  partner_jbkjs text,
  contract_reference text,
  -- Partner snapshot
  partner_name text,
  partner_address text,
  partner_city text,
  partner_postal_code text,
  partner_pib text,
  partner_mb text,
  composed_by text,
  -- Posting
  journal_entry_id uuid,
  posted_at timestamptz,
  posted_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, business_year_id, advance_number)
);

ALTER TABLE public.advance_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view advance invoices"
  ON public.advance_invoices FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can create advance invoices"
  ON public.advance_invoices FOR INSERT
  WITH CHECK (can_user_write(auth.uid(), company_id, 'prodaja.fakture', org_unit_id));

CREATE POLICY "Users can update draft advance invoices"
  ON public.advance_invoices FOR UPDATE
  USING (status = 'draft' AND can_user_write(auth.uid(), company_id, 'prodaja.fakture', org_unit_id));

CREATE POLICY "Admins can delete draft advance invoices"
  ON public.advance_invoices FOR DELETE
  USING (status = 'draft' AND (has_role(auth.uid(), 'super_admin') OR is_local_admin_for_company(auth.uid(), company_id)));

-- Advance invoice items (simpler: no article reference, no discount)
CREATE TABLE public.advance_invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advance_invoice_id uuid NOT NULL REFERENCES public.advance_invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  item_order integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'kom',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 20,
  tax_category_code text NOT NULL DEFAULT 'S',
  tax_exemption_reason text,
  line_subtotal numeric NOT NULL DEFAULT 0,
  line_vat numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advance_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view advance invoice items"
  ON public.advance_invoice_items FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage advance invoice items"
  ON public.advance_invoice_items FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update advance invoice items"
  ON public.advance_invoice_items FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete advance invoice items"
  ON public.advance_invoice_items FOR DELETE
  USING (has_company_access(auth.uid(), company_id));

-- ========================================
-- CREDIT NOTES (Knjižna odobrenja)
-- ========================================

CREATE TABLE public.credit_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  business_year_id uuid NOT NULL REFERENCES public.business_years(id),
  org_unit_id uuid REFERENCES public.organizational_units(id),
  credit_note_number text NOT NULL,
  credit_note_date text NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
  due_date text,
  partner_id uuid NOT NULL REFERENCES public.partners(id),
  source_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  billing_reference_number text,
  billing_reference_date text,
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  note text,
  internal_note text,
  header_note text,
  currency text NOT NULL DEFAULT 'RSD',
  payment_means_code text NOT NULL DEFAULT '30',
  partner_country_code text NOT NULL DEFAULT 'RS',
  partner_jbkjs text,
  -- Partner snapshot
  partner_name text,
  partner_address text,
  partner_city text,
  partner_postal_code text,
  partner_pib text,
  partner_mb text,
  composed_by text,
  -- Posting
  journal_entry_id uuid,
  posted_at timestamptz,
  posted_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, business_year_id, credit_note_number)
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view credit notes"
  ON public.credit_notes FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can create credit notes"
  ON public.credit_notes FOR INSERT
  WITH CHECK (can_user_write(auth.uid(), company_id, 'prodaja.fakture', org_unit_id));

CREATE POLICY "Users can update draft credit notes"
  ON public.credit_notes FOR UPDATE
  USING (status = 'draft' AND can_user_write(auth.uid(), company_id, 'prodaja.fakture', org_unit_id));

CREATE POLICY "Admins can delete draft credit notes"
  ON public.credit_notes FOR DELETE
  USING (status = 'draft' AND (has_role(auth.uid(), 'super_admin') OR is_local_admin_for_company(auth.uid(), company_id)));

-- Credit note items (same structure as invoice items)
CREATE TABLE public.credit_note_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_note_id uuid NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  item_order integer NOT NULL DEFAULT 0,
  article_id uuid REFERENCES public.articles(id),
  item_code text,
  item_name text NOT NULL,
  unit text NOT NULL DEFAULT 'kom',
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 20,
  tax_category_code text NOT NULL DEFAULT 'S',
  tax_exemption_reason text,
  line_subtotal numeric NOT NULL DEFAULT 0,
  line_vat numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view credit note items"
  ON public.credit_note_items FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage credit note items"
  ON public.credit_note_items FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update credit note items"
  ON public.credit_note_items FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete credit note items"
  ON public.credit_note_items FOR DELETE
  USING (has_company_access(auth.uid(), company_id));
