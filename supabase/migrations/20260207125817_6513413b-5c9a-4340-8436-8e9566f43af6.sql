
-- ============================================================
-- PHASE 1: Convert journal_entries.entry_number from integer to text
-- ============================================================
ALTER TABLE public.journal_entries 
  ALTER COLUMN entry_number TYPE text USING entry_number::text;

-- ============================================================
-- PHASE 2: Drop legacy (broken) function overloads + return type change
-- ============================================================
DROP FUNCTION IF EXISTS public.post_goods_purchase_invoice(uuid);
DROP FUNCTION IF EXISTS public.post_service_purchase_invoice(uuid);
DROP FUNCTION IF EXISTS public.get_next_journal_entry_number(uuid, uuid);

-- ============================================================
-- PHASE 3: Update document numbering functions → YYNNNN format
-- ============================================================

-- 3a. get_next_document_number (quotes, invoices, delivery notes)
CREATE OR REPLACE FUNCTION public.get_next_document_number(
  _company_id uuid, _year_id uuid, _doc_type text
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

  CASE _doc_type
    WHEN 'quote' THEN
      SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
      FROM (
        SELECT CAST(SUBSTRING(quote_number FROM '(\d{4})$') AS INTEGER) as seq
        FROM quotes
        WHERE company_id = _company_id AND business_year_id = _year_id
          AND (
            quote_number ~ ('^' || _year_short || '\d{4}$')
            OR quote_number ~ ('^[A-Z]+-' || _year_short || '-\d{4}$')
          )
      ) t;

    WHEN 'invoice' THEN
      SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
      FROM (
        SELECT CAST(SUBSTRING(invoice_number FROM '(\d{4})$') AS INTEGER) as seq
        FROM invoices
        WHERE company_id = _company_id AND business_year_id = _year_id
          AND (
            invoice_number ~ ('^' || _year_short || '\d{4}$')
            OR invoice_number ~ ('^[A-Z]+-' || _year_short || '-\d{4}$')
          )
      ) t;

    WHEN 'delivery_note' THEN
      SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
      FROM (
        SELECT CAST(SUBSTRING(delivery_number FROM '(\d{4})$') AS INTEGER) as seq
        FROM delivery_notes
        WHERE company_id = _company_id AND business_year_id = _year_id
          AND (
            delivery_number ~ ('^' || _year_short || '\d{4}$')
            OR delivery_number ~ ('^[A-Z]+-' || _year_short || '-\d{4}$')
          )
      ) t;

    ELSE
      _next_num := 1;
  END CASE;

  RETURN _year_short || LPAD(_next_num::text, 4, '0');
END;
$function$;

-- 3b. get_next_purchase_invoice_number
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

    ELSE
      _next_num := 1;
  END CASE;

  RETURN _year_short || LPAD(_next_num::text, 4, '0');
END;
$function$;

-- 3c. get_next_goods_receipt_number
CREATE OR REPLACE FUNCTION public.get_next_goods_receipt_number(
  _company_id uuid, _year_id uuid
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

  SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
  FROM (
    SELECT CAST(SUBSTRING(receipt_number FROM '(\d{4})$') AS INTEGER) as seq
    FROM goods_receipts
    WHERE company_id = _company_id AND business_year_id = _year_id
      AND (
        receipt_number ~ ('^' || _year_short || '\d{4}$')
        OR receipt_number ~ ('^[A-Z]+-' || _year_short || '-\d{4}$')
      )
  ) t;

  RETURN _year_short || LPAD(_next_num::text, 4, '0');
END;
$function$;

-- 3d. get_next_journal_entry_number → returns "R-YYNNNN" for manual entries
CREATE FUNCTION public.get_next_journal_entry_number(
  _company_id uuid, _year_id uuid
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

  SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
  FROM (
    SELECT CAST(SUBSTRING(entry_number FROM '^R-' || _year_short || '(\d{4})$') AS INTEGER) as seq
    FROM journal_entries
    WHERE company_id = _company_id AND business_year_id = _year_id
      AND entry_number ~ ('^R-' || _year_short || '\d{4}$')
  ) t;

  RETURN 'R-' || _year_short || LPAD(_next_num::text, 4, '0');
END;
$function$;

-- ============================================================
-- PHASE 4: Update posting functions
-- ============================================================

-- 4a. post_invoice → entry_number = 'FAK' || invoice_number
CREATE OR REPLACE FUNCTION public.post_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _invoice invoices%ROWTYPE;
  _journal_entry_id uuid;
  _journal_entry_number text;
  _partner partners%ROWTYPE;
  _receivable_account text := '2010';
  _revenue_account text := '6100';
  _vat_account text := '4700';
BEGIN
  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF _invoice.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;
  IF _invoice.total_amount <= 0 THEN RAISE EXCEPTION 'Faktura mora imati pozitivan iznos'; END IF;

  SELECT * INTO _partner FROM partners WHERE id = _invoice.partner_id;

  _journal_entry_number := 'FAK' || _invoice.invoice_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, org_unit_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit, posted_at, posted_by,
    source_document_type, source_document_id, created_by
  ) VALUES (
    _invoice.company_id, _invoice.business_year_id, _invoice.org_unit_id,
    _journal_entry_number, _invoice.invoice_date, _invoice.invoice_date,
    _invoice.invoice_number,
    'Faktura ' || _invoice.invoice_number || ' - ' || _partner.name,
    'posted', _invoice.total_amount, _invoice.total_amount,
    now(), _user_id, 'invoice', _invoice_id, _user_id
  ) RETURNING id INTO _journal_entry_id;

  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id
  ) VALUES (
    _journal_entry_id, _invoice.company_id, _receivable_account, 1,
    'Potraživanje od kupca - ' || _partner.name,
    _invoice.total_amount, 0, _invoice.partner_id
  );

  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id
  ) VALUES (
    _journal_entry_id, _invoice.company_id, _revenue_account, 2,
    'Prihod od prodaje - faktura ' || _invoice.invoice_number,
    0, _invoice.subtotal, NULL
  );

  IF _invoice.vat_amount > 0 THEN
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, partner_id
    ) VALUES (
      _journal_entry_id, _invoice.company_id, _vat_account, 3,
      'PDV obaveza - faktura ' || _invoice.invoice_number,
      0, _invoice.vat_amount, NULL
    );
  END IF;

  UPDATE invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = _journal_entry_id
  WHERE id = _invoice_id;

  RETURN TRUE;
END;
$function$;

-- 4b. post_goods_purchase_invoice → entry_number = 'UFR' || internal_number
CREATE OR REPLACE FUNCTION public.post_goods_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice goods_purchase_invoices%ROWTYPE;
  v_partner partners%ROWTYPE;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_item_order int := 0;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_goods_receipt_id uuid;
  v_supplier_account_code text;
  v_input_vat_account_code text := '2700';
  v_inventory_account_code text;
  v_vat_deductible_amount numeric := 0;
  v_vat_non_deductible_amount numeric := 0;
  v_inventory_amount numeric := 0;
  v_receipt_number text;
BEGIN
  SELECT * INTO v_invoice FROM goods_purchase_invoices WHERE id = _invoice_id;
  IF v_invoice IS NULL THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF v_invoice.status = 'posted' THEN RAISE EXCEPTION 'Faktura je već proknjižena'; END IF;

  SELECT * INTO v_partner FROM partners WHERE id = v_invoice.partner_id;
  IF v_partner.legal_status = 4 THEN v_supplier_account_code := '4360';
  ELSE v_supplier_account_code := '4350'; END IF;

  SELECT COALESCE(inventory_account, '1320') INTO v_inventory_account_code
  FROM warehouses WHERE id = v_invoice.warehouse_id;

  v_entry_number := 'UFR' || v_invoice.internal_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    document_number, description, status, created_by, source_document_type, source_document_id
  ) VALUES (
    v_invoice.company_id, v_invoice.business_year_id, v_entry_number, v_invoice.receipt_date,
    v_invoice.due_date, v_invoice.supplier_invoice_number,
    'UFR: ' || v_invoice.internal_number || ' - ' || COALESCE(v_invoice.supplier_name, ''),
    'posted', _user_id, 'goods_purchase_invoice', _invoice_id
  ) RETURNING id INTO v_journal_entry_id;

  SELECT
    COALESCE(SUM(CASE WHEN is_vat_deductible THEN line_vat ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN NOT is_vat_deductible THEN line_vat ELSE 0 END), 0),
    COALESCE(SUM(line_subtotal), 0)
  INTO v_vat_deductible_amount, v_vat_non_deductible_amount, v_inventory_amount
  FROM goods_purchase_invoice_items WHERE goods_purchase_invoice_id = _invoice_id;

  v_inventory_amount := v_inventory_amount + v_vat_non_deductible_amount;

  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id, document_date
  ) VALUES (
    v_journal_entry_id, v_invoice.company_id, v_supplier_account_code, v_item_order,
    'Obaveza po fakturi ' || v_invoice.supplier_invoice_number,
    0, v_invoice.total_amount, v_invoice.partner_id, v_invoice.due_date
  );
  v_total_credit := v_total_credit + v_invoice.total_amount;

  IF v_vat_deductible_amount > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, document_date
    ) VALUES (
      v_journal_entry_id, v_invoice.company_id, v_input_vat_account_code, v_item_order,
      'Ulazni PDV', v_vat_deductible_amount, 0, v_invoice.receipt_date
    );
    v_total_debit := v_total_debit + v_vat_deductible_amount;
  END IF;

  IF v_inventory_amount > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_journal_entry_id, v_invoice.company_id, v_inventory_account_code, v_item_order,
      'Nabavka robe', v_inventory_amount, 0,
      (SELECT code FROM warehouses WHERE id = v_invoice.warehouse_id),
      v_invoice.receipt_date
    );
    v_total_debit := v_total_debit + v_inventory_amount;
  END IF;

  UPDATE journal_entries
  SET total_debit = v_total_debit, total_credit = v_total_credit, posted_at = now(), posted_by = _user_id
  WHERE id = v_journal_entry_id;

  SELECT public.get_next_goods_receipt_number(v_invoice.company_id, v_invoice.business_year_id)
  INTO v_receipt_number;

  INSERT INTO goods_receipts (
    company_id, business_year_id, warehouse_id, partner_id, receipt_number,
    receipt_date, source_invoice_id, status, created_by
  ) VALUES (
    v_invoice.company_id, v_invoice.business_year_id, v_invoice.warehouse_id,
    v_invoice.partner_id, v_receipt_number, v_invoice.receipt_date,
    _invoice_id, 'draft', _user_id
  ) RETURNING id INTO v_goods_receipt_id;

  INSERT INTO goods_receipt_items (
    goods_receipt_id, company_id, article_id, item_code, item_name, unit, quantity, unit_price, item_order
  )
  SELECT
    v_goods_receipt_id, company_id, article_id, item_code, item_name, unit, quantity,
    CASE WHEN quantity > 0 THEN line_subtotal / quantity
         ELSE unit_price * (1 - COALESCE(discount_percent, 0) / 100)
    END as unit_price, item_order
  FROM goods_purchase_invoice_items WHERE goods_purchase_invoice_id = _invoice_id;

  PERFORM public.post_goods_receipt(v_goods_receipt_id, _user_id);

  UPDATE goods_purchase_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = v_journal_entry_id, goods_receipt_id = v_goods_receipt_id,
      updated_at = now()
  WHERE id = _invoice_id;

  RETURN v_journal_entry_id;
END;
$function$;

-- 4c. post_service_purchase_invoice → entry_number = 'UFU' || internal_number
CREATE OR REPLACE FUNCTION public.post_service_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice service_purchase_invoices%ROWTYPE;
  v_partner partners%ROWTYPE;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_item_order int := 0;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_supplier_account_code text;
  v_input_vat_account_code text := '2700';
  v_item record;
  v_cost record;
  v_line_amount numeric;
  v_cost_center_code text;
BEGIN
  SELECT * INTO v_invoice FROM service_purchase_invoices WHERE id = _invoice_id;
  IF v_invoice IS NULL THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF v_invoice.status = 'posted' THEN RAISE EXCEPTION 'Faktura je već proknjižena'; END IF;

  SELECT * INTO v_partner FROM partners WHERE id = v_invoice.partner_id;
  IF v_partner.legal_status = 4 THEN v_supplier_account_code := '4360';
  ELSE v_supplier_account_code := '4350'; END IF;

  v_entry_number := 'UFU' || v_invoice.internal_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    document_number, description, status, created_by, source_document_type, source_document_id
  ) VALUES (
    v_invoice.company_id, v_invoice.business_year_id, v_entry_number, v_invoice.receipt_date,
    v_invoice.due_date, v_invoice.supplier_invoice_number,
    'UFU: ' || v_invoice.internal_number || ' - ' || COALESCE(v_invoice.supplier_name, ''),
    'posted', _user_id, 'service_purchase_invoice', _invoice_id
  ) RETURNING id INTO v_journal_entry_id;

  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id, document_date
  ) VALUES (
    v_journal_entry_id, v_invoice.company_id, v_supplier_account_code, v_item_order,
    'Obaveza po fakturi ' || v_invoice.supplier_invoice_number,
    0, v_invoice.total_amount, v_invoice.partner_id, v_invoice.due_date
  );
  v_total_credit := v_total_credit + v_invoice.total_amount;

  FOR v_item IN
    SELECT * FROM service_purchase_invoice_items WHERE service_purchase_invoice_id = _invoice_id ORDER BY item_order
  LOOP
    SELECT * INTO v_cost FROM input_costs WHERE id = v_item.input_cost_id;
    IF v_cost IS NULL THEN RAISE EXCEPTION 'Ulazni trošak nije pronađen za stavku'; END IF;

    IF v_item.is_vat_deductible THEN
      v_line_amount := v_item.line_subtotal;
    ELSE
      v_line_amount := v_item.line_subtotal + v_item.line_vat;
    END IF;

    v_cost_center_code := NULL;
    IF v_item.org_unit_id IS NOT NULL THEN
      SELECT code INTO v_cost_center_code FROM organizational_units WHERE id = v_item.org_unit_id;
    ELSIF v_invoice.org_unit_id IS NOT NULL THEN
      SELECT code INTO v_cost_center_code FROM organizational_units WHERE id = v_invoice.org_unit_id;
    END IF;

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_journal_entry_id, v_invoice.company_id, v_cost.account_code, v_item_order,
      v_item.item_name, v_line_amount, 0, v_cost_center_code, v_invoice.receipt_date
    );
    v_total_debit := v_total_debit + v_line_amount;

    IF v_item.is_vat_deductible AND v_item.line_vat > 0 THEN
      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, cost_center_code, document_date
      ) VALUES (
        v_journal_entry_id, v_invoice.company_id, v_input_vat_account_code, v_item_order,
        'Ulazni PDV - ' || v_item.item_name, v_item.line_vat, 0,
        v_cost_center_code, v_invoice.receipt_date
      );
      v_total_debit := v_total_debit + v_item.line_vat;
    END IF;
  END LOOP;

  UPDATE journal_entries
  SET total_debit = v_total_debit, total_credit = v_total_credit, posted_at = now(), posted_by = _user_id
  WHERE id = v_journal_entry_id;

  UPDATE service_purchase_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = v_journal_entry_id, updated_at = now()
  WHERE id = _invoice_id;

  RETURN v_journal_entry_id;
END;
$function$;
