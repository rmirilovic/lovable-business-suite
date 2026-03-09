
-- ============================================================
-- 1. Create advance_purchase_invoices table
-- ============================================================
CREATE TABLE public.advance_purchase_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  business_year_id uuid NOT NULL REFERENCES business_years(id),
  internal_number text NOT NULL,
  supplier_invoice_number text NOT NULL DEFAULT '',
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  partner_id uuid NOT NULL REFERENCES partners(id),
  supplier_name text,
  supplier_address text,
  supplier_city text,
  supplier_postal_code text,
  supplier_pib text,
  supplier_mb text,
  supplier_is_in_pdv boolean NOT NULL DEFAULT true,
  supplier_bank_account text,
  payment_reference text,
  org_unit_id uuid REFERENCES organizational_units(id),
  subtotal numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  note text,
  internal_note text,
  currency text NOT NULL DEFAULT 'RSD',
  exchange_rate numeric NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  posted_at timestamptz,
  posted_by uuid,
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advance_purchase_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage advance_purchase_invoices" ON public.advance_purchase_invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. Create advance_purchase_invoice_items table
-- ============================================================
CREATE TABLE public.advance_purchase_invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advance_purchase_invoice_id uuid NOT NULL REFERENCES advance_purchase_invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id),
  item_order int NOT NULL DEFAULT 1,
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

ALTER TABLE public.advance_purchase_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage advance_purchase_invoice_items" ON public.advance_purchase_invoice_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. Update get_next_purchase_invoice_number to support 'advance' type
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_next_purchase_invoice_number(
  _company_id uuid, _year_id uuid, _invoice_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _year_short text;
  _next_num integer;
BEGIN
  SELECT RIGHT(year::text, 2) INTO _year_short FROM business_years WHERE id = _year_id;

  CASE _invoice_type
    WHEN 'service' THEN
      SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
      FROM (
        SELECT CAST(SUBSTRING(internal_number FROM '(\d{4})$') AS INTEGER) as seq
        FROM service_purchase_invoices
        WHERE company_id = _company_id AND business_year_id = _year_id
          AND (
            internal_number ~ ('^' || _year_short || '\d{4}$')
            OR internal_number ~ ('^[A-Z]+-' || _year_short || '-\d{4}$')
          )
      ) t;

    WHEN 'goods' THEN
      SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
      FROM (
        SELECT CAST(SUBSTRING(internal_number FROM '(\d{4})$') AS INTEGER) as seq
        FROM goods_purchase_invoices
        WHERE company_id = _company_id AND business_year_id = _year_id
          AND (
            internal_number ~ ('^' || _year_short || '\d{4}$')
            OR internal_number ~ ('^[A-Z]+-' || _year_short || '-\d{4}$')
          )
      ) t;

    WHEN 'advance' THEN
      SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
      FROM (
        SELECT CAST(SUBSTRING(internal_number FROM '(\d{4})$') AS INTEGER) as seq
        FROM advance_purchase_invoices
        WHERE company_id = _company_id AND business_year_id = _year_id
          AND (
            internal_number ~ ('^' || _year_short || '\d{4}$')
            OR internal_number ~ ('^[A-Z]+-' || _year_short || '-\d{4}$')
          )
      ) t;

    ELSE
      _next_num := 1;
  END CASE;

  RETURN _year_short || LPAD(_next_num::text, 4, '0');
END;
$function$;

-- ============================================================
-- 4. post_advance_purchase_invoice function
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_advance_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc advance_purchase_invoices%ROWTYPE;
  _journal_entry_id uuid;
  _journal_entry_number text;
  _partner partners%ROWTYPE;
  _item_order int := 0;
  _org_unit_code text;
  _is_foreign boolean := false;
  _vat_rec RECORD;
  _supplier_account text;
  _advance_account text;
  _total_debit numeric := 0;
  _total_credit numeric := 0;
  _popdv_report RECORD;
  _popdv_next_order int;
  _popdv_base_20 numeric := 0;
  _popdv_vat_20 numeric := 0;
  _popdv_base_10 numeric := 0;
  _popdv_vat_10 numeric := 0;
BEGIN
  SELECT * INTO _doc FROM advance_purchase_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'UFA nije pronađena'; END IF;
  IF _doc.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;
  IF _doc.total_amount <= 0 THEN RAISE EXCEPTION 'Dokument mora imati pozitivan iznos'; END IF;

  SELECT * INTO _partner FROM partners WHERE id = _doc.partner_id;
  _is_foreign := (_partner.legal_status = 4);

  IF _is_foreign THEN
    _supplier_account := '4360';
    _advance_account := '1510';
  ELSE
    _supplier_account := '4350';
    _advance_account := '1500';
  END IF;

  IF _doc.org_unit_id IS NOT NULL THEN
    SELECT code INTO _org_unit_code FROM organizational_units WHERE id = _doc.org_unit_id;
  END IF;

  _journal_entry_number := 'UFA' || _doc.internal_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, org_unit_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit, posted_at, posted_by,
    source_document_type, source_document_id, created_by
  ) VALUES (
    _doc.company_id, _doc.business_year_id, _doc.org_unit_id,
    _journal_entry_number, _doc.receipt_date, _doc.due_date,
    _doc.supplier_invoice_number,
    'UFA: ' || _doc.internal_number || ' - ' || COALESCE(_doc.supplier_name, _partner.name),
    'posted', 0, 0,
    now(), _user_id, 'advance_purchase_invoice', _invoice_id, _user_id
  ) RETURNING id INTO _journal_entry_id;

  -- 1. Credit supplier account for total amount
  _item_order := _item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id, document_date
  ) VALUES (
    _journal_entry_id, _doc.company_id, _supplier_account, _item_order,
    'Obaveza po avansu ' || _doc.supplier_invoice_number || ' - ' || COALESCE(_doc.supplier_name, _partner.name),
    0, _doc.total_amount, _doc.partner_id, _doc.due_date
  );
  _total_credit := _total_credit + _doc.total_amount;

  -- 2. Debit advance account for subtotal
  _item_order := _item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id, cost_center_code, document_date
  ) VALUES (
    _journal_entry_id, _doc.company_id, _advance_account, _item_order,
    'Dati avans ' || COALESCE(_doc.supplier_name, _partner.name),
    _doc.subtotal, 0, _doc.partner_id, _org_unit_code, _doc.receipt_date
  );
  _total_debit := _total_debit + _doc.subtotal;

  -- 3. Debit input VAT accounts per rate (only for domestic PDV suppliers)
  IF _doc.supplier_is_in_pdv AND NOT _is_foreign THEN
    FOR _vat_rec IN
      SELECT vat_rate, SUM(line_vat) as total_vat, SUM(line_subtotal) as total_base
      FROM advance_purchase_invoice_items
      WHERE advance_purchase_invoice_id = _invoice_id
      GROUP BY vat_rate
      HAVING SUM(line_vat) > 0
    LOOP
      _item_order := _item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, cost_center_code, document_date
      ) VALUES (
        _journal_entry_id, _doc.company_id,
        CASE WHEN _vat_rec.vat_rate = 10 THEN '2730' ELSE '2720' END,
        _item_order,
        'Prethodni PDV iz avansa ' || _vat_rec.vat_rate || '% - ' || _doc.internal_number,
        _vat_rec.total_vat, 0, _org_unit_code, _doc.receipt_date
      );
      _total_debit := _total_debit + _vat_rec.total_vat;

      IF _vat_rec.vat_rate = 20 THEN
        _popdv_base_20 := _popdv_base_20 + _vat_rec.total_base;
        _popdv_vat_20 := _popdv_vat_20 + _vat_rec.total_vat;
      ELSIF _vat_rec.vat_rate = 10 THEN
        _popdv_base_10 := _popdv_base_10 + _vat_rec.total_base;
        _popdv_vat_10 := _popdv_vat_10 + _vat_rec.total_vat;
      END IF;
    END LOOP;
  END IF;

  -- If supplier not in PDV, subtotal = total, no VAT entries needed, advance_account gets full amount
  IF NOT _doc.supplier_is_in_pdv OR _is_foreign THEN
    -- Adjust advance account to full amount instead of subtotal
    UPDATE journal_entry_items
    SET debit_amount = _doc.total_amount
    WHERE journal_entry_id = _journal_entry_id AND account_code = _advance_account;
    _total_debit := _doc.total_amount;
  END IF;

  -- Update journal entry totals
  UPDATE journal_entries
  SET total_debit = _total_debit, total_credit = _total_credit
  WHERE id = _journal_entry_id;

  -- Update document status
  UPDATE advance_purchase_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = _journal_entry_id, updated_at = now()
  WHERE id = _invoice_id;

  -- POPDV: section 8a, row 8a.7 (advance payments)
  IF NOT _is_foreign AND _doc.supplier_is_in_pdv AND (_popdv_base_20 > 0 OR _popdv_vat_20 > 0 OR _popdv_base_10 > 0 OR _popdv_vat_10 > 0) THEN
    SELECT pr.* INTO _popdv_report
    FROM popdv_reports pr
    WHERE pr.company_id = _doc.company_id
      AND pr.business_year_id = _doc.business_year_id
      AND _doc.invoice_date BETWEEN pr.period_start AND pr.period_end
    LIMIT 1;

    IF FOUND THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO _popdv_next_order
      FROM popdv_report_detail_rows
      WHERE report_id = _popdv_report.id AND section = '8' AND row_code = '8a.7';

      INSERT INTO popdv_report_detail_rows (
        report_id, company_id, section, row_code, item_order,
        document_date, document_type_number, partner_info,
        values, source_document_id
      ) VALUES (
        _popdv_report.id, _doc.company_id, '8', '8a.7', _popdv_next_order,
        _doc.invoice_date,
        'UFA ' || _doc.internal_number,
        _partner.name || COALESCE(' (PIB: ' || _partner.pib || ')', ''),
        jsonb_build_object(
          'opsta_osnov', _popdv_base_20,
          'opsta_pdv', _popdv_vat_20,
          'posebna_osnov', _popdv_base_10,
          'posebna_pdv', _popdv_vat_10
        ),
        _invoice_id
      );
    END IF;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_advance_purchase_invoice(uuid, uuid) TO authenticated;

-- ============================================================
-- 5. unpost_advance_purchase_invoice function
-- ============================================================
CREATE OR REPLACE FUNCTION public.unpost_advance_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc advance_purchase_invoices%ROWTYPE;
BEGIN
  SELECT * INTO _doc FROM advance_purchase_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'UFA nije pronađena'; END IF;
  IF _doc.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjiženi dokumenti mogu biti poništeni'; END IF;

  -- Delete POPDV entries
  DELETE FROM popdv_report_detail_rows WHERE source_document_id = _invoice_id;

  -- Delete journal entry items first, then entry
  IF _doc.journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = _doc.journal_entry_id;
    DELETE FROM journal_entries WHERE id = _doc.journal_entry_id;
  END IF;

  -- Revert status
  UPDATE advance_purchase_invoices
  SET status = 'draft', posted_at = NULL, posted_by = NULL,
      journal_entry_id = NULL, updated_at = now()
  WHERE id = _invoice_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unpost_advance_purchase_invoice(uuid, uuid) TO authenticated;
