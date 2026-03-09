
-- Tables
CREATE TABLE public.received_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  business_year_id uuid NOT NULL REFERENCES public.business_years(id),
  internal_number text NOT NULL,
  supplier_document_number text NOT NULL DEFAULT '',
  document_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  partner_id uuid NOT NULL REFERENCES public.partners(id),
  supplier_name text,
  supplier_address text,
  supplier_city text,
  supplier_postal_code text,
  supplier_pib text,
  supplier_mb text,
  supplier_is_in_pdv boolean NOT NULL DEFAULT true,
  supplier_bank_account text,
  payment_reference text,
  has_internal_vat_calculation boolean NOT NULL DEFAULT false,
  org_unit_id uuid REFERENCES public.organizational_units(id),
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
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.received_credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rcn_select" ON public.received_credit_notes FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "rcn_insert" ON public.received_credit_notes FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "rcn_update" ON public.received_credit_notes FOR UPDATE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "rcn_delete" ON public.received_credit_notes FOR DELETE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id) AND status = 'draft');

CREATE TABLE public.received_credit_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_credit_note_id uuid NOT NULL REFERENCES public.received_credit_notes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  input_cost_id uuid REFERENCES public.input_costs(id),
  item_code text,
  item_name text NOT NULL DEFAULT '',
  description text,
  org_unit_id uuid REFERENCES public.organizational_units(id),
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'kom',
  unit_price numeric NOT NULL DEFAULT 0,
  foreign_unit_price numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 20,
  is_vat_deductible boolean NOT NULL DEFAULT true,
  line_subtotal numeric NOT NULL DEFAULT 0,
  line_vat numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  item_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.received_credit_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rcni_select" ON public.received_credit_note_items FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "rcni_insert" ON public.received_credit_note_items FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "rcni_update" ON public.received_credit_note_items FOR UPDATE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "rcni_delete" ON public.received_credit_note_items FOR DELETE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

-- Update number generator
CREATE OR REPLACE FUNCTION public.get_next_purchase_invoice_number(
  _company_id uuid, _year_id uuid, _invoice_type text DEFAULT 'goods'
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _year_val integer; _prefix text; _max_num integer; _next text;
BEGIN
  SELECT year INTO _year_val FROM business_years WHERE id = _year_id;
  IF _invoice_type = 'goods' THEN
    _prefix := 'UFR-';
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(internal_number, '^UFR-[0-9]{2}', ''), '') AS integer)), 0) INTO _max_num
    FROM goods_purchase_invoices WHERE company_id = _company_id AND business_year_id = _year_id;
  ELSIF _invoice_type = 'service' THEN
    _prefix := 'UFU-';
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(internal_number, '^UFU-[0-9]{2}', ''), '') AS integer)), 0) INTO _max_num
    FROM service_purchase_invoices WHERE company_id = _company_id AND business_year_id = _year_id;
  ELSIF _invoice_type = 'advance' THEN
    _prefix := 'UFA-';
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(internal_number, '^UFA-[0-9]{2}', ''), '') AS integer)), 0) INTO _max_num
    FROM advance_purchase_invoices WHERE company_id = _company_id AND business_year_id = _year_id;
  ELSIF _invoice_type = 'received_credit_note' THEN
    _prefix := 'PKO-';
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(internal_number, '^PKO-[0-9]{2}', ''), '') AS integer)), 0) INTO _max_num
    FROM received_credit_notes WHERE company_id = _company_id AND business_year_id = _year_id;
  ELSE
    RAISE EXCEPTION 'Unknown invoice type: %', _invoice_type;
  END IF;
  _next := _prefix || RIGHT(_year_val::text, 2) || LPAD((_max_num + 1)::text, 4, '0');
  RETURN _next;
END;
$$;

-- Post function
CREATE OR REPLACE FUNCTION public.post_received_credit_note(_doc_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _doc received_credit_notes%ROWTYPE;
  _partner partners%ROWTYPE;
  _je_id uuid;
  _item RECORD;
  _order int := 1;
  _supplier_account text;
  _vat_account text;
  _total_subtotal numeric := 0;
  _total_vat numeric := 0;
  _total_amount numeric := 0;
  _popdv_report_id uuid;
  _popdv_section text;
  _period_start date;
  _period_end date;
  _is_foreign boolean;
BEGIN
  SELECT * INTO _doc FROM received_credit_notes WHERE id = _doc_id;
  IF _doc IS NULL THEN RAISE EXCEPTION 'Dokument nije pronađen'; END IF;
  IF _doc.status != 'draft' THEN RAISE EXCEPTION 'Dokument nije u statusu Nacrt'; END IF;

  SELECT * INTO _partner FROM partners WHERE id = _doc.partner_id;
  _is_foreign := (_partner.legal_status = '4');
  _supplier_account := CASE WHEN _is_foreign THEN '4360' ELSE '4350' END;

  SELECT COALESCE(SUM(line_subtotal), 0), COALESCE(SUM(line_vat), 0), COALESCE(SUM(line_total), 0)
  INTO _total_subtotal, _total_vat, _total_amount
  FROM received_credit_note_items WHERE received_credit_note_id = _doc_id;

  -- Create journal entry
  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit, posted_at, posted_by, created_by,
    source_document_type, source_document_id
  ) VALUES (
    _doc.company_id, _doc.business_year_id,
    (SELECT get_next_journal_entry_number(_doc.company_id, _doc.business_year_id)),
    _doc.receipt_date, _doc.document_date, _doc.supplier_document_number,
    'Primljeno knjižno odobrenje ' || _doc.internal_number,
    'posted', _total_amount, _total_amount,
    now(), _user_id, _user_id,
    'received_credit_note', _doc_id
  ) RETURNING id INTO _je_id;

  -- Debit supplier account (reduces liability)
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order,
    description, debit_amount, credit_amount, partner_id, document_date
  ) VALUES (
    _je_id, _doc.company_id, _supplier_account, _order,
    'Primljeno KO - ' || COALESCE(_doc.supplier_name, _partner.name),
    _total_amount, 0, _doc.partner_id, _doc.due_date
  );
  _order := _order + 1;

  -- Credit expense accounts per item
  FOR _item IN
    SELECT rci.*, ic.account_code as cost_account_code, ou.code as ou_code
    FROM received_credit_note_items rci
    LEFT JOIN input_costs ic ON ic.id = rci.input_cost_id
    LEFT JOIN organizational_units ou ON ou.id = rci.org_unit_id
    WHERE rci.received_credit_note_id = _doc_id ORDER BY rci.item_order
  LOOP
    IF _item.cost_account_code IS NOT NULL THEN
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount, cost_center_code, document_date
      ) VALUES (
        _je_id, _doc.company_id, _item.cost_account_code, _order,
        _item.item_name, 0, _item.line_subtotal, _item.ou_code, _doc.document_date
      );
      _order := _order + 1;
    END IF;

    IF _item.line_vat > 0 AND _item.is_vat_deductible THEN
      IF _doc.has_internal_vat_calculation THEN
        _vat_account := CASE WHEN _item.vat_rate = 10 THEN '2730' ELSE '2720' END;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order,
          description, debit_amount, credit_amount, document_date
        ) VALUES (
          _je_id, _doc.company_id, _vat_account, _order,
          'Interni obračun PDV - storno ulaznog', 0, _item.line_vat, _doc.document_date
        );
        _order := _order + 1;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order,
          description, debit_amount, credit_amount, document_date
        ) VALUES (
          _je_id, _doc.company_id,
          CASE WHEN _item.vat_rate = 10 THEN '4730' ELSE '4720' END, _order,
          'Interni obračun PDV - storno izlaznog', 0, _item.line_vat, _doc.document_date
        );
        _order := _order + 1;
      ELSE
        _vat_account := CASE WHEN _item.vat_rate = 10 THEN '2730' ELSE '2720' END;
        INSERT INTO journal_entry_items (
          journal_entry_id, company_id, account_code, item_order,
          description, debit_amount, credit_amount, document_date
        ) VALUES (
          _je_id, _doc.company_id, _vat_account, _order,
          'Storno prethodnog PDV', 0, _item.line_vat, _doc.document_date
        );
        _order := _order + 1;
      END IF;
    END IF;
  END LOOP;

  -- POPDV section 8a field 006
  SELECT vat_period_type INTO _popdv_section FROM companies WHERE id = _doc.company_id;
  IF _popdv_section = 'monthly' THEN
    _period_start := date_trunc('month', _doc.document_date)::date;
    _period_end := (date_trunc('month', _doc.document_date) + interval '1 month' - interval '1 day')::date;
  ELSE
    _period_start := date_trunc('quarter', _doc.document_date)::date;
    _period_end := (date_trunc('quarter', _doc.document_date) + interval '3 months' - interval '1 day')::date;
  END IF;

  SELECT id INTO _popdv_report_id FROM popdv_reports
  WHERE company_id = _doc.company_id AND business_year_id = _doc.business_year_id
    AND period_start = _period_start AND period_end = _period_end LIMIT 1;

  IF _popdv_report_id IS NULL THEN
    INSERT INTO popdv_reports (company_id, business_year_id, period_start, period_end, status, created_by)
    VALUES (_doc.company_id, _doc.business_year_id, _period_start, _period_end, 'draft', _user_id)
    RETURNING id INTO _popdv_report_id;
  END IF;

  IF _total_subtotal > 0 THEN
    INSERT INTO popdv_detail_rows (
      popdv_report_id, company_id, section_key, field_key,
      source_document_type, source_document_id,
      base_amount, vat_amount, total_amount, description
    ) VALUES (
      _popdv_report_id, _doc.company_id, '8a', '006',
      'received_credit_note', _doc_id,
      _total_subtotal, _total_vat, _total_amount,
      'PKO ' || _doc.internal_number || ' - ' || COALESCE(_doc.supplier_name, '')
    );
  END IF;

  UPDATE received_credit_notes
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = _je_id, updated_at = now()
  WHERE id = _doc_id;
END;
$$;

-- Unpost function
CREATE OR REPLACE FUNCTION public.unpost_received_credit_note(_doc_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _doc received_credit_notes%ROWTYPE; _je_id uuid;
BEGIN
  SELECT * INTO _doc FROM received_credit_notes WHERE id = _doc_id;
  IF _doc IS NULL THEN RAISE EXCEPTION 'Dokument nije pronađen'; END IF;
  IF _doc.status != 'posted' THEN RAISE EXCEPTION 'Dokument nije proknjižen'; END IF;
  _je_id := _doc.journal_entry_id;

  DELETE FROM popdv_detail_rows WHERE source_document_type = 'received_credit_note' AND source_document_id = _doc_id;

  IF _je_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = _je_id;
    DELETE FROM journal_entries WHERE id = _je_id;
  END IF;

  UPDATE received_credit_notes
  SET status = 'draft', posted_at = NULL, posted_by = NULL,
      journal_entry_id = NULL, updated_at = now()
  WHERE id = _doc_id;
END;
$$;
