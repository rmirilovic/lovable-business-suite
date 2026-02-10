
-- =============================================
-- FAZA 1: Veze kalkulacija ↔ UFR ↔ UFU
-- =============================================

-- 1. Flag na kontnom planu: "zavisni trošak nabavke"
ALTER TABLE public.chart_of_accounts 
ADD COLUMN is_procurement_cost boolean NOT NULL DEFAULT false;

-- 2. Kalkulacija → UFR veza (jedna UFR po kalkulaciji)
ALTER TABLE public.purchase_price_calculations 
ADD COLUMN source_goods_invoice_id uuid REFERENCES goods_purchase_invoices(id);

-- 3. Junction tabela: kalkulacija ↔ više UFU
CREATE TABLE public.calculation_ufu_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_id uuid NOT NULL REFERENCES purchase_price_calculations(id) ON DELETE CASCADE,
  service_invoice_id uuid NOT NULL REFERENCES service_purchase_invoices(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(calculation_id, service_invoice_id),
  UNIQUE(service_invoice_id) -- UFU može biti samo u jednoj kalkulaciji
);

ALTER TABLE public.calculation_ufu_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calculation_ufu_links"
ON public.calculation_ufu_links FOR SELECT
USING (company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert calculation_ufu_links"
ON public.calculation_ufu_links FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete calculation_ufu_links"
ON public.calculation_ufu_links FOR DELETE
USING (company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid()));

-- 4. Dodati source reference na calculation_additional_costs
ALTER TABLE public.calculation_additional_costs
ADD COLUMN source_ufu_id uuid REFERENCES service_purchase_invoices(id),
ADD COLUMN source_ufu_item_id uuid REFERENCES service_purchase_invoice_items(id);

-- 5. Labele na dokumentima: linked_calculation_id
ALTER TABLE public.goods_receipts
ADD COLUMN linked_calculation_id uuid REFERENCES purchase_price_calculations(id) ON DELETE SET NULL;

ALTER TABLE public.goods_purchase_invoices
ADD COLUMN linked_calculation_id uuid REFERENCES purchase_price_calculations(id) ON DELETE SET NULL;

-- 6. Zaštita: sprečiti unpost prijemnice ako je vezana za kalkulaciju
CREATE OR REPLACE FUNCTION public.unpost_goods_receipt(_receipt_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_receipt goods_receipts%ROWTYPE;
  v_item RECORD;
  v_calc_number text;
BEGIN
  SELECT * INTO v_receipt FROM goods_receipts WHERE id = _receipt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prijemnica nije pronađena'; END IF;
  IF v_receipt.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjižene prijemnice mogu biti poništene'; END IF;
  IF v_receipt.source_invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'Prijemnica kreirana iz ulazne fakture se ne može poništiti ovde. Poništite fakturu.';
  END IF;

  -- Check if linked to a calculation
  IF v_receipt.linked_calculation_id IS NOT NULL THEN
    SELECT calculation_number INTO v_calc_number 
    FROM purchase_price_calculations WHERE id = v_receipt.linked_calculation_id;
    RAISE EXCEPTION 'Prijemnica je vezana za kalkulaciju %. Obrišite kalkulaciju pre poništavanja.', COALESCE(v_calc_number, '');
  END IF;

  FOR v_item IN 
    SELECT article_id, quantity FROM goods_receipt_items 
    WHERE goods_receipt_id = _receipt_id AND article_id IS NOT NULL
  LOOP
    UPDATE articles SET stock = COALESCE(stock, 0) - v_item.quantity, updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  UPDATE goods_receipts
  SET status = 'draft', posted_at = NULL, posted_by = NULL, updated_at = now()
  WHERE id = _receipt_id;

  RETURN _receipt_id;
END;
$function$;

-- 7. Zaštita: sprečiti unpost UFR ako je vezana za kalkulaciju
CREATE OR REPLACE FUNCTION public.unpost_goods_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_journal_entry_id UUID;
  v_goods_receipt_id UUID;
  v_status TEXT;
  v_item RECORD;
  v_calc_number text;
  v_linked_calc_id uuid;
BEGIN
  SELECT status, journal_entry_id, goods_receipt_id, linked_calculation_id
  INTO v_status, v_journal_entry_id, v_goods_receipt_id, v_linked_calc_id
  FROM goods_purchase_invoices WHERE id = _invoice_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Ulazna faktura nije pronađena'; END IF;
  IF v_status != 'posted' THEN RAISE EXCEPTION 'Samo proknjižene fakture mogu biti poništene'; END IF;

  -- Check if linked to a calculation
  IF v_linked_calc_id IS NOT NULL THEN
    SELECT calculation_number INTO v_calc_number 
    FROM purchase_price_calculations WHERE id = v_linked_calc_id;
    RAISE EXCEPTION 'Faktura je vezana za kalkulaciju %. Obrišite kalkulaciju pre poništavanja.', COALESCE(v_calc_number, '');
  END IF;

  IF v_goods_receipt_id IS NULL THEN
    SELECT id INTO v_goods_receipt_id FROM goods_receipts WHERE source_invoice_id = _invoice_id;
  END IF;

  UPDATE goods_purchase_invoices
  SET status = 'draft', posted_at = NULL, posted_by = NULL, journal_entry_id = NULL,
      goods_receipt_id = NULL, updated_at = now()
  WHERE id = _invoice_id;

  IF v_journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_journal_entry_id;
  ELSE
    FOR v_item IN
      SELECT id FROM journal_entries 
      WHERE source_document_type = 'goods_purchase_invoice' AND source_document_id = _invoice_id
    LOOP
      DELETE FROM journal_entry_items WHERE journal_entry_id = v_item.id;
      DELETE FROM journal_entries WHERE id = v_item.id;
    END LOOP;
  END IF;

  IF v_goods_receipt_id IS NOT NULL THEN
    FOR v_item IN 
      SELECT gri.article_id, gri.quantity FROM goods_receipt_items gri
      JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
      WHERE gri.goods_receipt_id = v_goods_receipt_id AND gri.article_id IS NOT NULL AND gr.status = 'posted'
    LOOP
      UPDATE articles SET stock = COALESCE(stock, 0) - v_item.quantity, updated_at = now()
      WHERE id = v_item.article_id;
    END LOOP;
    DELETE FROM goods_receipt_items WHERE goods_receipt_id = v_goods_receipt_id;
    DELETE FROM goods_receipts WHERE id = v_goods_receipt_id;
  END IF;

  RETURN TRUE;
END;
$function$;

-- 8. Zaštita: sprečiti unpost UFU ako je vezana za kalkulaciju
CREATE OR REPLACE FUNCTION public.unpost_service_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice RECORD;
  v_journal_entry_id uuid;
  v_access_level text;
  v_calc_number text;
BEGIN
  SELECT * INTO v_invoice FROM service_purchase_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF v_invoice.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjižene fakture mogu biti poništene'; END IF;

  -- Check if linked to a calculation
  SELECT pc.calculation_number INTO v_calc_number
  FROM calculation_ufu_links cul
  JOIN purchase_price_calculations pc ON pc.id = cul.calculation_id
  WHERE cul.service_invoice_id = _invoice_id
  LIMIT 1;
  
  IF v_calc_number IS NOT NULL THEN
    RAISE EXCEPTION 'Faktura je vezana za kalkulaciju %. Obrišite kalkulaciju pre poništavanja.', v_calc_number;
  END IF;

  v_access_level := get_user_access_level(_user_id, v_invoice.company_id, 'nabavka.ulazne_fakture_usluge', NULL);
  IF v_access_level != 'admin' THEN
    RAISE EXCEPTION 'Nemate admin dozvole za poništavanje knjiženja';
  END IF;

  v_journal_entry_id := v_invoice.journal_entry_id;

  UPDATE service_purchase_invoices
  SET status = 'draft', posted_at = NULL, posted_by = NULL, journal_entry_id = NULL, updated_at = now()
  WHERE id = _invoice_id;

  IF v_journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_journal_entry_id;
  END IF;

  RETURN true;
END;
$function$;
