-- =====================================================
-- ULAZNE FAKTURE ZA USLUGE (Service Purchase Invoices)
-- =====================================================

CREATE TABLE public.service_purchase_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  
  -- Brojevi dokumenta
  internal_number TEXT NOT NULL,
  supplier_invoice_number TEXT NOT NULL,
  
  -- Datumi
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Dobavljač - referenca
  partner_id UUID NOT NULL REFERENCES public.partners(id),
  
  -- Snapshot podaci dobavljača (kopiraju se pri izboru partnera)
  supplier_name TEXT,
  supplier_address TEXT,
  supplier_city TEXT,
  supplier_postal_code TEXT,
  supplier_pib TEXT,
  supplier_mb TEXT,
  supplier_is_in_pdv BOOLEAN NOT NULL DEFAULT true,
  
  -- Plaćanje
  supplier_bank_account TEXT,
  payment_reference TEXT,
  
  -- PDV opcije za celu fakturu
  vat_calculation_type TEXT NOT NULL DEFAULT 'standard' CHECK (vat_calculation_type IN ('standard', 'no_vat_8v2')),
  has_internal_vat_calculation BOOLEAN NOT NULL DEFAULT false,
  
  -- Iznosi
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Napomene
  note TEXT,
  internal_note TEXT,
  
  -- Status i workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  
  UNIQUE(company_id, internal_number)
);

-- Stavke ulaznih faktura za usluge
CREATE TABLE public.service_purchase_invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_purchase_invoice_id UUID NOT NULL REFERENCES public.service_purchase_invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Veza sa šifarnikom ulaznih troškova
  input_cost_id UUID REFERENCES public.input_costs(id),
  
  -- Podaci o stavci (kopiraju se iz šifarnika ili ručno unose)
  item_code TEXT,
  item_name TEXT NOT NULL,
  description TEXT,
  
  -- Organizaciona jedinica (mesto troška) za ovu stavku
  org_unit_id UUID REFERENCES public.organizational_units(id),
  
  -- Količina i cena
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'kom',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  
  -- PDV po stavci
  vat_rate NUMERIC NOT NULL DEFAULT 20,
  is_vat_deductible BOOLEAN NOT NULL DEFAULT true,
  
  -- Kalkulisani iznosi
  line_subtotal NUMERIC NOT NULL DEFAULT 0,
  line_vat NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  
  -- Redosled
  item_order INTEGER NOT NULL DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ULAZNE FAKTURE ZA ROBU/MATERIJAL (Goods Purchase Invoices)
-- =====================================================

CREATE TABLE public.goods_purchase_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  
  -- Brojevi dokumenta
  internal_number TEXT NOT NULL,
  supplier_invoice_number TEXT NOT NULL,
  
  -- Datumi
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Dobavljač - referenca
  partner_id UUID NOT NULL REFERENCES public.partners(id),
  
  -- Snapshot podaci dobavljača
  supplier_name TEXT,
  supplier_address TEXT,
  supplier_city TEXT,
  supplier_postal_code TEXT,
  supplier_pib TEXT,
  supplier_mb TEXT,
  supplier_is_in_pdv BOOLEAN NOT NULL DEFAULT true,
  
  -- Plaćanje
  supplier_bank_account TEXT,
  payment_reference TEXT,
  
  -- Magacin za sve stavke (obavezan za robu)
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  
  -- PDV opcije
  vat_calculation_type TEXT NOT NULL DEFAULT 'standard' CHECK (vat_calculation_type IN ('standard', 'no_vat_8v2')),
  has_internal_vat_calculation BOOLEAN NOT NULL DEFAULT false,
  
  -- Iznosi
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Napomene
  note TEXT,
  internal_note TEXT,
  
  -- Status i workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  
  -- Veza sa prijemnicom (kreira se pri knjiženju)
  goods_receipt_id UUID,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  
  UNIQUE(company_id, internal_number)
);

-- Stavke ulaznih faktura za robu
CREATE TABLE public.goods_purchase_invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goods_purchase_invoice_id UUID NOT NULL REFERENCES public.goods_purchase_invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Veza sa šifarnikom artikala
  article_id UUID REFERENCES public.articles(id),
  
  -- Podaci o stavci
  item_code TEXT,
  item_name TEXT NOT NULL,
  description TEXT,
  
  -- Količina i cena
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'kom',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  
  -- PDV po stavci
  vat_rate NUMERIC NOT NULL DEFAULT 20,
  is_vat_deductible BOOLEAN NOT NULL DEFAULT true,
  
  -- Kalkulisani iznosi
  line_subtotal NUMERIC NOT NULL DEFAULT 0,
  line_vat NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  
  -- Redosled
  item_order INTEGER NOT NULL DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.service_purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_purchase_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_purchase_invoice_items ENABLE ROW LEVEL SECURITY;

-- Service Purchase Invoices - SELECT
CREATE POLICY "Users can view service invoices for their companies"
ON public.service_purchase_invoices FOR SELECT
USING (public.has_company_access(auth.uid(), company_id));

-- Service Purchase Invoices - INSERT
CREATE POLICY "Users can create service invoices for their companies"
ON public.service_purchase_invoices FOR INSERT
WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- Service Purchase Invoices - UPDATE
CREATE POLICY "Users can update service invoices for their companies"
ON public.service_purchase_invoices FOR UPDATE
USING (public.has_company_access(auth.uid(), company_id));

-- Service Purchase Invoices - DELETE
CREATE POLICY "Users can delete draft service invoices"
ON public.service_purchase_invoices FOR DELETE
USING (public.has_company_access(auth.uid(), company_id) AND status = 'draft');

-- Service Purchase Invoice Items - SELECT
CREATE POLICY "Users can view service invoice items for their companies"
ON public.service_purchase_invoice_items FOR SELECT
USING (public.has_company_access(auth.uid(), company_id));

-- Service Purchase Invoice Items - INSERT
CREATE POLICY "Users can create service invoice items for their companies"
ON public.service_purchase_invoice_items FOR INSERT
WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- Service Purchase Invoice Items - UPDATE
CREATE POLICY "Users can update service invoice items for their companies"
ON public.service_purchase_invoice_items FOR UPDATE
USING (public.has_company_access(auth.uid(), company_id));

-- Service Purchase Invoice Items - DELETE
CREATE POLICY "Users can delete service invoice items for their companies"
ON public.service_purchase_invoice_items FOR DELETE
USING (public.has_company_access(auth.uid(), company_id));

-- Goods Purchase Invoices - SELECT
CREATE POLICY "Users can view goods invoices for their companies"
ON public.goods_purchase_invoices FOR SELECT
USING (public.has_company_access(auth.uid(), company_id));

-- Goods Purchase Invoices - INSERT
CREATE POLICY "Users can create goods invoices for their companies"
ON public.goods_purchase_invoices FOR INSERT
WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- Goods Purchase Invoices - UPDATE
CREATE POLICY "Users can update goods invoices for their companies"
ON public.goods_purchase_invoices FOR UPDATE
USING (public.has_company_access(auth.uid(), company_id));

-- Goods Purchase Invoices - DELETE
CREATE POLICY "Users can delete draft goods invoices"
ON public.goods_purchase_invoices FOR DELETE
USING (public.has_company_access(auth.uid(), company_id) AND status = 'draft');

-- Goods Purchase Invoice Items - SELECT
CREATE POLICY "Users can view goods invoice items for their companies"
ON public.goods_purchase_invoice_items FOR SELECT
USING (public.has_company_access(auth.uid(), company_id));

-- Goods Purchase Invoice Items - INSERT
CREATE POLICY "Users can create goods invoice items for their companies"
ON public.goods_purchase_invoice_items FOR INSERT
WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- Goods Purchase Invoice Items - UPDATE
CREATE POLICY "Users can update goods invoice items for their companies"
ON public.goods_purchase_invoice_items FOR UPDATE
USING (public.has_company_access(auth.uid(), company_id));

-- Goods Purchase Invoice Items - DELETE
CREATE POLICY "Users can delete goods invoice items for their companies"
ON public.goods_purchase_invoice_items FOR DELETE
USING (public.has_company_access(auth.uid(), company_id));

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_service_purchase_invoices_company ON public.service_purchase_invoices(company_id);
CREATE INDEX idx_service_purchase_invoices_year ON public.service_purchase_invoices(business_year_id);
CREATE INDEX idx_service_purchase_invoices_partner ON public.service_purchase_invoices(partner_id);
CREATE INDEX idx_service_purchase_invoices_status ON public.service_purchase_invoices(status);

CREATE INDEX idx_service_purchase_invoice_items_invoice ON public.service_purchase_invoice_items(service_purchase_invoice_id);
CREATE INDEX idx_service_purchase_invoice_items_input_cost ON public.service_purchase_invoice_items(input_cost_id);
CREATE INDEX idx_service_purchase_invoice_items_org_unit ON public.service_purchase_invoice_items(org_unit_id);

CREATE INDEX idx_goods_purchase_invoices_company ON public.goods_purchase_invoices(company_id);
CREATE INDEX idx_goods_purchase_invoices_year ON public.goods_purchase_invoices(business_year_id);
CREATE INDEX idx_goods_purchase_invoices_partner ON public.goods_purchase_invoices(partner_id);
CREATE INDEX idx_goods_purchase_invoices_warehouse ON public.goods_purchase_invoices(warehouse_id);
CREATE INDEX idx_goods_purchase_invoices_status ON public.goods_purchase_invoices(status);

CREATE INDEX idx_goods_purchase_invoice_items_invoice ON public.goods_purchase_invoice_items(goods_purchase_invoice_id);
CREATE INDEX idx_goods_purchase_invoice_items_article ON public.goods_purchase_invoice_items(article_id);

-- =====================================================
-- TRIGGERS FOR updated_at
-- =====================================================

CREATE TRIGGER update_service_purchase_invoices_updated_at
  BEFORE UPDATE ON public.service_purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_goods_purchase_invoices_updated_at
  BEFORE UPDATE ON public.goods_purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FUNCTION TO GET NEXT INTERNAL NUMBER
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_next_purchase_invoice_number(_company_id uuid, _year_id uuid, _invoice_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _year integer;
  _year_short text;
  _next_num integer;
  _prefix text;
BEGIN
  SELECT year INTO _year FROM business_years WHERE id = _year_id;
  _year_short := RIGHT(_year::text, 2);
  
  CASE _invoice_type
    WHEN 'service' THEN 
      _prefix := 'UF-U';
      SELECT COALESCE(MAX(
        NULLIF(regexp_replace(internal_number, '[^0-9]', '', 'g'), '')::integer
      ), 0) + 1 INTO _next_num
      FROM service_purchase_invoices
      WHERE company_id = _company_id AND business_year_id = _year_id;
    WHEN 'goods' THEN 
      _prefix := 'UF-R';
      SELECT COALESCE(MAX(
        NULLIF(regexp_replace(internal_number, '[^0-9]', '', 'g'), '')::integer
      ), 0) + 1 INTO _next_num
      FROM goods_purchase_invoices
      WHERE company_id = _company_id AND business_year_id = _year_id;
    ELSE
      _prefix := 'UF';
      _next_num := 1;
  END CASE;
  
  RETURN _prefix || '-' || _year_short || '-' || LPAD(_next_num::text, 4, '0');
END;
$$;

-- =====================================================
-- POST FUNCTIONS FOR GENERAL LEDGER
-- =====================================================

-- Post Service Purchase Invoice
CREATE OR REPLACE FUNCTION public.post_service_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice service_purchase_invoices%ROWTYPE;
  _journal_entry_id uuid;
  _journal_entry_number integer;
  _partner partners%ROWTYPE;
  _item RECORD;
  _item_order integer := 1;
  _payable_account text := '4320'; -- Obaveze prema dobavljačima
  _input_vat_account text := '2700'; -- Ulazni PDV
  _cost_account text;
  _line_amount numeric;
BEGIN
  SELECT * INTO _invoice FROM service_purchase_invoices WHERE id = _invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ulazna faktura nije pronađena';
  END IF;
  
  IF _invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi';
  END IF;
  
  IF _invoice.total_amount <= 0 THEN
    RAISE EXCEPTION 'Faktura mora imati pozitivan iznos';
  END IF;
  
  SELECT * INTO _partner FROM partners WHERE id = _invoice.partner_id;
  
  -- Get next journal entry number
  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO _journal_entry_number
  FROM journal_entries
  WHERE company_id = _invoice.company_id AND business_year_id = _invoice.business_year_id;
  
  -- Create journal entry
  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    document_number, description, status, total_debit, total_credit,
    posted_at, posted_by, source_document_type, source_document_id, created_by
  ) VALUES (
    _invoice.company_id, _invoice.business_year_id, _journal_entry_number,
    _invoice.receipt_date, _invoice.invoice_date, _invoice.internal_number,
    'Ulazna faktura usluge ' || _invoice.internal_number || ' - ' || COALESCE(_invoice.supplier_name, _partner.name),
    'posted', _invoice.total_amount, _invoice.total_amount,
    now(), _user_id, 'service_purchase_invoice', _invoice_id, _user_id
  )
  RETURNING id INTO _journal_entry_id;
  
  -- Credit: Obaveze prema dobavljaču (ukupan iznos sa PDV)
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id
  ) VALUES (
    _journal_entry_id, _invoice.company_id, _payable_account, _item_order,
    'Obaveza prema dobavljaču - ' || COALESCE(_invoice.supplier_name, _partner.name),
    0, _invoice.total_amount, _invoice.partner_id
  );
  _item_order := _item_order + 1;
  
  -- Debit: Ulazni PDV (ako je dobavljač u sistemu PDV-a i PDV je odbitni)
  IF _invoice.supplier_is_in_pdv AND _invoice.vat_calculation_type = 'standard' AND _invoice.vat_amount > 0 THEN
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, partner_id
    ) VALUES (
      _journal_entry_id, _invoice.company_id, _input_vat_account, _item_order,
      'Ulazni PDV - faktura ' || _invoice.internal_number,
      _invoice.vat_amount, 0, NULL
    );
    _item_order := _item_order + 1;
  END IF;
  
  -- Debit: Troškovi po stavkama
  FOR _item IN 
    SELECT spi.*, ic.account_code as cost_account_code, ou.code as org_unit_code
    FROM service_purchase_invoice_items spi
    LEFT JOIN input_costs ic ON ic.id = spi.input_cost_id
    LEFT JOIN organizational_units ou ON ou.id = spi.org_unit_id
    WHERE spi.service_purchase_invoice_id = _invoice_id
    ORDER BY spi.item_order
  LOOP
    _cost_account := COALESCE(_item.cost_account_code, '5100'); -- Default: Troškovi materijala
    
    -- Ako PDV nije odbitni, uključi ga u trošak
    IF _item.is_vat_deductible THEN
      _line_amount := _item.line_subtotal;
    ELSE
      _line_amount := _item.line_total;
    END IF;
    
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, partner_id, cost_center_code
    ) VALUES (
      _journal_entry_id, _invoice.company_id, _cost_account, _item_order,
      _item.item_name,
      _line_amount, 0, NULL, _item.org_unit_code
    );
    _item_order := _item_order + 1;
  END LOOP;
  
  -- Update invoice status
  UPDATE service_purchase_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id, journal_entry_id = _journal_entry_id
  WHERE id = _invoice_id;
  
  RETURN TRUE;
END;
$$;

-- Post Goods Purchase Invoice
CREATE OR REPLACE FUNCTION public.post_goods_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice goods_purchase_invoices%ROWTYPE;
  _journal_entry_id uuid;
  _journal_entry_number integer;
  _partner partners%ROWTYPE;
  _warehouse warehouses%ROWTYPE;
  _item RECORD;
  _item_order integer := 1;
  _payable_account text := '4320'; -- Obaveze prema dobavljačima
  _input_vat_account text := '2700'; -- Ulazni PDV
  _inventory_account text;
  _total_inventory_debit numeric := 0;
BEGIN
  SELECT * INTO _invoice FROM goods_purchase_invoices WHERE id = _invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ulazna faktura nije pronađena';
  END IF;
  
  IF _invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi';
  END IF;
  
  IF _invoice.total_amount <= 0 THEN
    RAISE EXCEPTION 'Faktura mora imati pozitivan iznos';
  END IF;
  
  SELECT * INTO _partner FROM partners WHERE id = _invoice.partner_id;
  SELECT * INTO _warehouse FROM warehouses WHERE id = _invoice.warehouse_id;
  
  -- Determine inventory account based on warehouse type
  -- SVK types: 1=Roba, 2=Materijal, 6=Rezervni delovi
  CASE _warehouse.svk_type
    WHEN '1' THEN _inventory_account := '1320'; -- Roba u magacinu
    WHEN '2' THEN _inventory_account := '1010'; -- Materijal
    WHEN '6' THEN _inventory_account := '1020'; -- Rezervni delovi
    WHEN '9' THEN _inventory_account := '1320'; -- Roba
    WHEN '12' THEN _inventory_account := '1320'; -- Roba
    ELSE _inventory_account := '1320'; -- Default: Roba
  END CASE;
  
  -- Calculate total inventory amount (for items where VAT is not deductible, include VAT)
  SELECT COALESCE(SUM(
    CASE WHEN is_vat_deductible THEN line_subtotal ELSE line_total END
  ), 0) INTO _total_inventory_debit
  FROM goods_purchase_invoice_items
  WHERE goods_purchase_invoice_id = _invoice_id;
  
  -- Get next journal entry number
  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO _journal_entry_number
  FROM journal_entries
  WHERE company_id = _invoice.company_id AND business_year_id = _invoice.business_year_id;
  
  -- Create journal entry
  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    document_number, description, status, total_debit, total_credit,
    posted_at, posted_by, source_document_type, source_document_id, created_by
  ) VALUES (
    _invoice.company_id, _invoice.business_year_id, _journal_entry_number,
    _invoice.receipt_date, _invoice.invoice_date, _invoice.internal_number,
    'Ulazna faktura roba ' || _invoice.internal_number || ' - ' || COALESCE(_invoice.supplier_name, _partner.name),
    'posted', _invoice.total_amount, _invoice.total_amount,
    now(), _user_id, 'goods_purchase_invoice', _invoice_id, _user_id
  )
  RETURNING id INTO _journal_entry_id;
  
  -- Credit: Obaveze prema dobavljaču (ukupan iznos sa PDV)
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id
  ) VALUES (
    _journal_entry_id, _invoice.company_id, _payable_account, _item_order,
    'Obaveza prema dobavljaču - ' || COALESCE(_invoice.supplier_name, _partner.name),
    0, _invoice.total_amount, _invoice.partner_id
  );
  _item_order := _item_order + 1;
  
  -- Debit: Ulazni PDV (ako je dobavljač u sistemu PDV-a i PDV je odbitni)
  IF _invoice.supplier_is_in_pdv AND _invoice.vat_calculation_type = 'standard' AND _invoice.vat_amount > 0 THEN
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, partner_id
    ) VALUES (
      _journal_entry_id, _invoice.company_id, _input_vat_account, _item_order,
      'Ulazni PDV - faktura ' || _invoice.internal_number,
      _invoice.vat_amount, 0, NULL
    );
    _item_order := _item_order + 1;
  END IF;
  
  -- Debit: Zalihe (sa analitikom magacina)
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id, cost_center_code
  ) VALUES (
    _journal_entry_id, _invoice.company_id, _inventory_account, _item_order,
    'Zalihe - magacin ' || _warehouse.code || ' - ' || _warehouse.name,
    _total_inventory_debit, 0, NULL, _warehouse.code
  );
  
  -- Update invoice status
  UPDATE goods_purchase_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id, journal_entry_id = _journal_entry_id
  WHERE id = _invoice_id;
  
  RETURN TRUE;
END;
$$;