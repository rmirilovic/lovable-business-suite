
-- Update post_goods_purchase_invoice to set supplier_document_number
CREATE OR REPLACE FUNCTION public.post_goods_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_is_domestic boolean;
  v_popdv_report_id uuid;
  v_popdv_next_order int;
  v_8a2_base_20 numeric := 0; v_8a2_pdv_20 numeric := 0;
  v_8a2_base_10 numeric := 0; v_8a2_pdv_10 numeric := 0;
  v_8e1_pdv numeric := 0;
  v_621_base_20 numeric := 0; v_621_base_10 numeric := 0;
  v_item record;
  v_popdv_partner_info text;
BEGIN
  SELECT * INTO v_invoice FROM goods_purchase_invoices WHERE id = _invoice_id;
  IF v_invoice IS NULL THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF v_invoice.status = 'posted' THEN RAISE EXCEPTION 'Faktura je već proknjižena'; END IF;

  SELECT * INTO v_partner FROM partners WHERE id = v_invoice.partner_id;
  IF v_partner.legal_status = 4 THEN v_supplier_account_code := '4360';
  ELSE v_supplier_account_code := '4350'; END IF;

  v_is_domestic := (v_partner.legal_status IS NULL OR v_partner.legal_status::int != 4);

  SELECT COALESCE(inventory_account, '1320') INTO v_inventory_account_code FROM warehouses WHERE id = v_invoice.warehouse_id;
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

  SELECT COALESCE(SUM(CASE WHEN is_vat_deductible THEN line_vat ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN NOT is_vat_deductible THEN line_vat ELSE 0 END), 0),
    COALESCE(SUM(line_subtotal), 0)
  INTO v_vat_deductible_amount, v_vat_non_deductible_amount, v_inventory_amount
  FROM goods_purchase_invoice_items WHERE goods_purchase_invoice_id = _invoice_id;
  v_inventory_amount := v_inventory_amount + v_vat_non_deductible_amount;

  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount, partner_id, document_date)
  VALUES (v_journal_entry_id, v_invoice.company_id, v_supplier_account_code, v_item_order, 'Obaveza po fakturi ' || v_invoice.supplier_invoice_number, 0, v_invoice.total_amount, v_invoice.partner_id, v_invoice.due_date);
  v_total_credit := v_total_credit + v_invoice.total_amount;

  IF v_vat_deductible_amount > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount, document_date)
    VALUES (v_journal_entry_id, v_invoice.company_id, v_input_vat_account_code, v_item_order, 'Ulazni PDV', v_vat_deductible_amount, 0, v_invoice.receipt_date);
    v_total_debit := v_total_debit + v_vat_deductible_amount;
  END IF;

  IF v_inventory_amount > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount, cost_center_code, document_date)
    VALUES (v_journal_entry_id, v_invoice.company_id, v_inventory_account_code, v_item_order, 'Nabavka robe', v_inventory_amount, 0, (SELECT code FROM warehouses WHERE id = v_invoice.warehouse_id), v_invoice.receipt_date);
    v_total_debit := v_total_debit + v_inventory_amount;
  END IF;

  UPDATE journal_entries SET total_debit = v_total_debit, total_credit = v_total_credit, posted_at = now(), posted_by = _user_id WHERE id = v_journal_entry_id;

  INSERT INTO goods_receipts (company_id, business_year_id, warehouse_id, partner_id, receipt_number, receipt_date, source_invoice_id, status, created_by)
  VALUES (v_invoice.company_id, v_invoice.business_year_id, v_invoice.warehouse_id, v_invoice.partner_id, v_invoice.internal_number, v_invoice.receipt_date, _invoice_id, 'draft', _user_id)
  RETURNING id INTO v_goods_receipt_id;

  INSERT INTO goods_receipt_items (goods_receipt_id, company_id, article_id, item_code, item_name, unit, quantity, unit_price, item_order)
  SELECT v_goods_receipt_id, v_invoice.company_id, article_id, item_code, item_name, unit, quantity,
    CASE WHEN quantity > 0 THEN ROUND(line_subtotal / quantity, 4) ELSE 0 END, item_order
  FROM goods_purchase_invoice_items WHERE goods_purchase_invoice_id = _invoice_id;

  PERFORM public.post_goods_receipt(v_goods_receipt_id, _user_id);

  UPDATE goods_purchase_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = v_journal_entry_id, goods_receipt_id = v_goods_receipt_id, updated_at = now()
  WHERE id = _invoice_id;

  v_popdv_partner_info := v_partner.code || ' - ' || COALESCE(v_invoice.supplier_name, v_partner.name) || COALESCE(' (PIB: ' || v_invoice.supplier_pib || ')', '');

  FOR v_item IN
    SELECT vat_rate, is_vat_deductible, line_subtotal, line_vat, line_total
    FROM goods_purchase_invoice_items WHERE goods_purchase_invoice_id = _invoice_id
  LOOP
    IF v_is_domestic THEN
      IF v_item.vat_rate = 20 THEN v_8a2_base_20 := v_8a2_base_20 + v_item.line_subtotal; v_8a2_pdv_20 := v_8a2_pdv_20 + v_item.line_vat;
      ELSIF v_item.vat_rate = 10 THEN v_8a2_base_10 := v_8a2_base_10 + v_item.line_subtotal; v_8a2_pdv_10 := v_8a2_pdv_10 + v_item.line_vat;
      END IF;
      IF v_item.is_vat_deductible AND v_item.line_vat > 0 THEN v_8e1_pdv := v_8e1_pdv + v_item.line_vat; END IF;
    ELSE
      IF v_item.vat_rate = 20 THEN v_621_base_20 := v_621_base_20 + v_item.line_subtotal;
      ELSIF v_item.vat_rate = 10 THEN v_621_base_10 := v_621_base_10 + v_item.line_subtotal;
      END IF;
    END IF;
  END LOOP;

  IF (v_8a2_base_20 > 0 OR v_8a2_pdv_20 > 0 OR v_8a2_base_10 > 0 OR v_8a2_pdv_10 > 0 OR v_8e1_pdv > 0 OR v_621_base_20 > 0 OR v_621_base_10 > 0) THEN
    v_popdv_report_id := public.ensure_popdv_report(v_invoice.company_id, v_invoice.business_year_id, v_invoice.receipt_date::date, _user_id);

    IF v_8a2_base_20 > 0 OR v_8a2_pdv_20 > 0 OR v_8a2_base_10 > 0 OR v_8a2_pdv_10 > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8a.2';
      INSERT INTO popdv_report_detail_rows (report_id, company_id, section, row_code, document_date, document_type_number, partner_info, supplier_document_number, values, item_order, source_document_id)
      VALUES (v_popdv_report_id, v_invoice.company_id, '8a', '8a.2', v_invoice.receipt_date::date, 'UFR ' || v_invoice.internal_number, v_popdv_partner_info, v_invoice.supplier_invoice_number,
        jsonb_build_object('opsta_osnov', v_8a2_base_20, 'opsta_pdv', v_8a2_pdv_20, 'posebna_osnov', v_8a2_base_10, 'posebna_pdv', v_8a2_pdv_10), v_popdv_next_order, _invoice_id);
    END IF;

    IF v_8e1_pdv > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8e.1';
      INSERT INTO popdv_report_detail_rows (report_id, company_id, section, row_code, document_date, document_type_number, partner_info, supplier_document_number, values, item_order, source_document_id)
      VALUES (v_popdv_report_id, v_invoice.company_id, '8e', '8e.1', v_invoice.receipt_date::date, 'UFR ' || v_invoice.internal_number, v_popdv_partner_info, v_invoice.supplier_invoice_number,
        jsonb_build_object('iznos', v_8e1_pdv), v_popdv_next_order, _invoice_id);
    END IF;

    IF v_621_base_20 > 0 OR v_621_base_10 > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '6.2.1';
      INSERT INTO popdv_report_detail_rows (report_id, company_id, section, row_code, document_date, document_type_number, partner_info, supplier_document_number, values, item_order, source_document_id)
      VALUES (v_popdv_report_id, v_invoice.company_id, '6', '6.2.1', v_invoice.receipt_date::date, 'UFR ' || v_invoice.internal_number, v_popdv_partner_info, v_invoice.supplier_invoice_number,
        jsonb_build_object('opsta_osnov', v_621_base_20, 'posebna_osnov', v_621_base_10), v_popdv_next_order, _invoice_id);
    END IF;
  END IF;

  RETURN v_journal_entry_id;
END;
$$;

-- Update post_received_credit_note to set supplier_document_number
CREATE OR REPLACE FUNCTION public.post_received_credit_note(_doc_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc received_credit_notes%ROWTYPE;
  _partner partners%ROWTYPE;
  _je_id uuid;
  _item RECORD;
  _order int := 1;
  _supplier_account text;
  _vat_account text;
  _total_subtotal numeric := 0; _total_vat numeric := 0; _total_amount numeric := 0;
  _popdv_report_id uuid;
  _is_foreign boolean;
  _entry_number text; _year_short text; _next_num integer;
  _expense_amount numeric;
  _check_debit numeric; _check_credit numeric;
  _opsta_osnov numeric := 0; _opsta_pdv numeric := 0;
  _posebna_osnov numeric := 0; _posebna_pdv numeric := 0;
  _popdv_partner_info text;
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

  SELECT RIGHT(year::text, 2) INTO _year_short FROM business_years WHERE id = _doc.business_year_id;
  SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
  FROM (SELECT CAST(SUBSTRING(entry_number FROM '^PKO' || _year_short || '(\d{4})$') AS INTEGER) as seq
    FROM journal_entries WHERE company_id = _doc.company_id AND business_year_id = _doc.business_year_id
      AND entry_number ~ ('^PKO' || _year_short || '\d{4}$')) t;
  _entry_number := 'PKO' || _year_short || LPAD(_next_num::text, 4, '0');

  INSERT INTO journal_entries (company_id, business_year_id, entry_number, entry_date,
    document_date, document_number, description, status, total_debit, total_credit, posted_at, posted_by, created_by,
    source_type, source_id)
  VALUES (_doc.company_id, _doc.business_year_id, _entry_number, _doc.receipt_date, _doc.document_date,
    _doc.supplier_document_number, 'Primljeno knjižno odobrenje ' || _doc.internal_number,
    'posted', 0, 0, now(), _user_id, _user_id, 'received_credit_note', _doc_id)
  RETURNING id INTO _je_id;

  INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount, partner_id, document_date)
  VALUES (_je_id, _doc.company_id, _supplier_account, _order, 'Primljeno KO - ' || COALESCE(_doc.supplier_name, _partner.name), 0, -_total_amount, _doc.partner_id, _doc.due_date);
  _order := _order + 1;

  FOR _item IN
    SELECT rci.*, ic.account_code as cost_account_code, ou.code as ou_code
    FROM received_credit_note_items rci LEFT JOIN input_costs ic ON ic.id = rci.input_cost_id
    LEFT JOIN organizational_units ou ON ou.id = rci.org_unit_id
    WHERE rci.received_credit_note_id = _doc_id ORDER BY rci.item_order
  LOOP
    IF _item.is_vat_deductible THEN _expense_amount := _item.line_subtotal; ELSE _expense_amount := _item.line_total; END IF;

    IF _item.cost_account_code IS NOT NULL THEN
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount, cost_center_code, document_date)
      VALUES (_je_id, _doc.company_id, _item.cost_account_code, _order, _item.item_name, -_expense_amount, 0, _item.ou_code, _doc.document_date);
      _order := _order + 1;
    END IF;

    IF _item.line_vat > 0 AND _item.is_vat_deductible THEN
      IF _doc.has_internal_vat_calculation THEN
        _vat_account := CASE WHEN _item.vat_rate = 10 THEN '2730' ELSE '2720' END;
        INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount, document_date)
        VALUES (_je_id, _doc.company_id, _vat_account, _order, 'Interni obračun PDV - storno ulaznog', -_item.line_vat, 0, _doc.document_date);
        _order := _order + 1;
        INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount, document_date)
        VALUES (_je_id, _doc.company_id, CASE WHEN _item.vat_rate = 10 THEN '4730' ELSE '4720' END, _order, 'Interni obračun PDV - storno izlaznog', 0, -_item.line_vat, _doc.document_date);
        _order := _order + 1;
      ELSE
        _vat_account := CASE WHEN _item.vat_rate = 10 THEN '2730' ELSE '2720' END;
        INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount, document_date)
        VALUES (_je_id, _doc.company_id, _vat_account, _order, 'Storno prethodnog PDV', -_item.line_vat, 0, _doc.document_date);
        _order := _order + 1;
      END IF;
    END IF;

    IF _item.vat_rate = 10 THEN _posebna_osnov := _posebna_osnov + _item.line_subtotal; _posebna_pdv := _posebna_pdv + _item.line_vat;
    ELSE _opsta_osnov := _opsta_osnov + _item.line_subtotal; _opsta_pdv := _opsta_pdv + _item.line_vat;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0) INTO _check_debit, _check_credit FROM journal_entry_items WHERE journal_entry_id = _je_id;
  IF _check_debit != _check_credit THEN RAISE EXCEPTION 'Nalog za knjiženje nije uravnotežen! Duguje: %, Potražuje: %.', _check_debit, _check_credit; END IF;
  UPDATE journal_entries SET total_debit = _check_debit, total_credit = _check_credit WHERE id = _je_id;

  _popdv_partner_info := _partner.code || ' - ' || COALESCE(_doc.supplier_name, _partner.name) || COALESCE(' (PIB: ' || _partner.pib || ')', '');

  IF _total_amount > 0 THEN
    _popdv_report_id := public.ensure_popdv_report(_doc.company_id, _doc.business_year_id, _doc.document_date::date, _user_id);
    INSERT INTO popdv_report_detail_rows (report_id, company_id, section, row_code, document_date, document_type_number, partner_info, supplier_document_number, values, item_order, source_document_id)
    VALUES (_popdv_report_id, _doc.company_id, '8a', '8a.5', _doc.document_date, 'PKO ' || _doc.internal_number, _popdv_partner_info, _doc.supplier_document_number,
      jsonb_build_object('opsta_osnov', -_opsta_osnov, 'opsta_pdv', -_opsta_pdv, 'posebna_osnov', -_posebna_osnov, 'posebna_pdv', -_posebna_pdv),
      COALESCE((SELECT MAX(item_order) + 1 FROM popdv_report_detail_rows WHERE report_id = _popdv_report_id AND row_code = '8a.5'), 0), _doc_id);
  END IF;

  UPDATE received_credit_notes SET status = 'posted', posted_at = now(), posted_by = _user_id, journal_entry_id = _je_id WHERE id = _doc_id;
END;
$$;

-- Update post_service_purchase_invoice to set supplier_document_number
CREATE OR REPLACE FUNCTION public.post_service_purchase_invoice(_invoice_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice service_purchase_invoices%ROWTYPE;
  v_partner partners%ROWTYPE;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_item_order int := 0;
  v_total_debit numeric := 0; v_total_credit numeric := 0;
  v_supplier_account_code text;
  v_input_vat_account_code text := '2700';
  v_item record; v_cost record;
  v_line_amount numeric; v_cost_center_code text;
  v_is_domestic boolean;
  v_popdv_report_id uuid; v_popdv_next_order int;
  v_8a2_base_20 numeric := 0; v_8a2_pdv_20 numeric := 0;
  v_8a2_base_10 numeric := 0; v_8a2_pdv_10 numeric := 0;
  v_8e1_pdv numeric := 0; v_8d2_value numeric := 0; v_8v2_value numeric := 0;
  v_3a3_pdv_20 numeric := 0; v_3a3_pdv_10 numeric := 0;
  v_8b2_base_20 numeric := 0; v_8b2_base_10 numeric := 0;
  v_8e2_pdv numeric := 0; v_6_4_pdv numeric := 0;
  v_popdv_partner_info text;
BEGIN
  SELECT * INTO v_invoice FROM service_purchase_invoices WHERE id = _invoice_id;
  IF v_invoice IS NULL THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF v_invoice.status = 'posted' THEN RAISE EXCEPTION 'Faktura je već proknjižena'; END IF;

  SELECT * INTO v_partner FROM partners WHERE id = v_invoice.partner_id;
  IF v_partner.legal_status = 4 THEN v_supplier_account_code := '4360'; ELSE v_supplier_account_code := '4350'; END IF;
  v_is_domestic := (v_partner.legal_status IS NULL OR v_partner.legal_status::int != 4);
  v_entry_number := 'UFU' || v_invoice.internal_number;

  INSERT INTO journal_entries (company_id, business_year_id, entry_number, entry_date, document_date,
    document_number, description, status, created_by, source_document_type, source_document_id)
  VALUES (v_invoice.company_id, v_invoice.business_year_id, v_entry_number, v_invoice.receipt_date,
    v_invoice.due_date, v_invoice.supplier_invoice_number,
    'UFU: ' || v_invoice.internal_number || ' - ' || COALESCE(v_invoice.supplier_name, ''),
    'posted', _user_id, 'service_purchase_invoice', _invoice_id)
  RETURNING id INTO v_journal_entry_id;

  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount, partner_id, document_date)
  VALUES (v_journal_entry_id, v_invoice.company_id, v_supplier_account_code, v_item_order, 'Obaveza po fakturi ' || v_invoice.supplier_invoice_number, 0, v_invoice.total_amount, v_invoice.partner_id, v_invoice.due_date);
  v_total_credit := v_total_credit + v_invoice.total_amount;

  FOR v_item IN SELECT * FROM service_purchase_invoice_items WHERE service_purchase_invoice_id = _invoice_id ORDER BY item_order
  LOOP
    SELECT * INTO v_cost FROM input_costs WHERE id = v_item.input_cost_id;
    IF v_cost IS NULL THEN RAISE EXCEPTION 'Ulazni trošak nije pronađen za stavku'; END IF;

    IF v_item.is_vat_deductible THEN v_line_amount := v_item.line_subtotal; ELSE v_line_amount := v_item.line_subtotal + v_item.line_vat; END IF;

    v_cost_center_code := NULL;
    IF v_item.org_unit_id IS NOT NULL THEN SELECT code INTO v_cost_center_code FROM organizational_units WHERE id = v_item.org_unit_id;
    ELSIF v_invoice.org_unit_id IS NOT NULL THEN SELECT code INTO v_cost_center_code FROM organizational_units WHERE id = v_invoice.org_unit_id;
    END IF;

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount, cost_center_code, document_date)
    VALUES (v_journal_entry_id, v_invoice.company_id, v_cost.account_code, v_item_order, v_item.item_name, v_line_amount, 0, v_cost_center_code, v_invoice.receipt_date);
    v_total_debit := v_total_debit + v_line_amount;

    IF v_item.is_vat_deductible AND v_item.line_vat > 0 THEN
      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (journal_entry_id, company_id, account_code, item_order, description, debit_amount, credit_amount, cost_center_code, document_date)
      VALUES (v_journal_entry_id, v_invoice.company_id, v_input_vat_account_code, v_item_order, 'Ulazni PDV - ' || v_item.item_name, v_item.line_vat, 0, v_cost_center_code, v_invoice.receipt_date);
      v_total_debit := v_total_debit + v_item.line_vat;
    END IF;

    IF v_is_domestic THEN
      IF v_cost.account_code = '2740' THEN v_6_4_pdv := v_6_4_pdv + v_line_amount;
      ELSIF v_invoice.has_internal_vat_calculation THEN
        IF v_item.vat_rate = 20 THEN v_3a3_pdv_20 := v_3a3_pdv_20 + v_item.line_vat; v_8b2_base_20 := v_8b2_base_20 + v_item.line_subtotal;
        ELSIF v_item.vat_rate = 10 THEN v_3a3_pdv_10 := v_3a3_pdv_10 + v_item.line_vat; v_8b2_base_10 := v_8b2_base_10 + v_item.line_subtotal;
        END IF;
        v_8e2_pdv := v_8e2_pdv + v_item.line_vat;
      ELSIF v_invoice.vat_calculation_type = 'no_vat_8v2' THEN v_8v2_value := v_8v2_value + v_item.line_total;
      ELSE
        IF v_invoice.supplier_is_in_pdv THEN
          IF v_item.is_vat_deductible THEN
            IF v_item.vat_rate = 20 THEN v_8a2_base_20 := v_8a2_base_20 + v_item.line_subtotal; v_8a2_pdv_20 := v_8a2_pdv_20 + v_item.line_vat;
            ELSIF v_item.vat_rate = 10 THEN v_8a2_base_10 := v_8a2_base_10 + v_item.line_subtotal; v_8a2_pdv_10 := v_8a2_pdv_10 + v_item.line_vat;
            END IF;
            v_8e1_pdv := v_8e1_pdv + v_item.line_vat;
          ELSE v_8d2_value := v_8d2_value + v_item.line_total;
          END IF;
        ELSE v_8d2_value := v_8d2_value + v_item.line_total;
        END IF;
      END IF;
    END IF;
  END LOOP;

  UPDATE journal_entries SET total_debit = v_total_debit, total_credit = v_total_credit, posted_at = now(), posted_by = _user_id WHERE id = v_journal_entry_id;
  UPDATE service_purchase_invoices SET status = 'posted', posted_at = now(), posted_by = _user_id, journal_entry_id = v_journal_entry_id, updated_at = now() WHERE id = _invoice_id;

  v_popdv_partner_info := v_partner.code || ' - ' || COALESCE(v_invoice.supplier_name, v_partner.name) || COALESCE(' (PIB: ' || v_invoice.supplier_pib || ')', '');

  IF v_is_domestic AND (v_8a2_base_20 > 0 OR v_8a2_pdv_20 > 0 OR v_8a2_base_10 > 0 OR v_8a2_pdv_10 > 0 OR
    v_8e1_pdv > 0 OR v_8d2_value > 0 OR v_8v2_value > 0 OR v_3a3_pdv_20 > 0 OR v_3a3_pdv_10 > 0 OR
    v_8b2_base_20 > 0 OR v_8b2_base_10 > 0 OR v_8e2_pdv > 0 OR v_6_4_pdv > 0) THEN

    v_popdv_report_id := public.ensure_popdv_report(v_invoice.company_id, v_invoice.business_year_id, v_invoice.receipt_date::date, _user_id);

    IF v_8a2_base_20 > 0 OR v_8a2_pdv_20 > 0 OR v_8a2_base_10 > 0 OR v_8a2_pdv_10 > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8a.2';
      INSERT INTO popdv_report_detail_rows (report_id, company_id, section, row_code, document_date, document_type_number, partner_info, supplier_document_number, values, item_order, source_document_id)
      VALUES (v_popdv_report_id, v_invoice.company_id, '8a', '8a.2', v_invoice.receipt_date::date, 'UFU ' || v_invoice.internal_number, v_popdv_partner_info, v_invoice.supplier_invoice_number,
        jsonb_build_object('opsta_osnov', v_8a2_base_20, 'opsta_pdv', v_8a2_pdv_20, 'posebna_osnov', v_8a2_base_10, 'posebna_pdv', v_8a2_pdv_10), v_popdv_next_order, _invoice_id);
    END IF;

    IF v_8e1_pdv > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8e.1';
      INSERT INTO popdv_report_detail_rows (report_id, company_id, section, row_code, document_date, document_type_number, partner_info, supplier_document_number, values, item_order, source_document_id)
      VALUES (v_popdv_report_id, v_invoice.company_id, '8e', '8e.1', v_invoice.receipt_date::date, 'UFU ' || v_invoice.internal_number, v_popdv_partner_info, v_invoice.supplier_invoice_number,
        jsonb_build_object('iznos', v_8e1_pdv), v_popdv_next_order, _invoice_id);
    END IF;

    IF v_8d2_value > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8d.2';
      INSERT INTO popdv_report_detail_rows (report_id, company_id, section, row_code, document_date, document_type_number, partner_info, supplier_document_number, values, item_order, source_document_id)
      VALUES (v_popdv_report_id, v_invoice.company_id, '8d', '8d.2', v_invoice.receipt_date::date, 'UFU ' || v_invoice.internal_number, v_popdv_partner_info, v_invoice.supplier_invoice_number,
        jsonb_build_object('iznos', v_8d2_value), v_popdv_next_order, _invoice_id);
    END IF;

    IF v_8v2_value > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8v.2';
      INSERT INTO popdv_report_detail_rows (report_id, company_id, section, row_code, document_date, document_type_number, partner_info, supplier_document_number, values, item_order, source_document_id)
      VALUES (v_popdv_report_id, v_invoice.company_id, '8v', '8v.2', v_invoice.receipt_date::date, 'UFU ' || v_invoice.internal_number, v_popdv_partner_info, v_invoice.supplier_invoice_number,
        jsonb_build_object('iznos', v_8v2_value), v_popdv_next_order, _invoice_id);
    END IF;

    IF v_3a3_pdv_20 > 0 OR v_3a3_pdv_10 > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '3a.3';
      INSERT INTO popdv_report_detail_rows (report_id, company_id, section, row_code, document_date, document_type_number, partner_info, supplier_document_number, values, item_order, source_document_id)
      VALUES (v_popdv_report_id, v_invoice.company_id, '3a', '3a.3', v_invoice.receipt_date::date, 'UFU ' || v_invoice.internal_number, v_popdv_partner_info, v_invoice.supplier_invoice_number,
        jsonb_build_object('opsta_pdv', v_3a3_pdv_20, 'posebna_pdv', v_3a3_pdv_10), v_popdv_next_order, _invoice_id);
    END IF;

    IF v_8b2_base_20 > 0 OR v_8b2_base_10 > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8b.2';
      INSERT INTO popdv_report_detail_rows (report_id, company_id, section, row_code, document_date, document_type_number, partner_info, supplier_document_number, values, item_order, source_document_id)
      VALUES (v_popdv_report_id, v_invoice.company_id, '8b', '8b.2', v_invoice.receipt_date::date, 'UFU ' || v_invoice.internal_number, v_popdv_partner_info, v_invoice.supplier_invoice_number,
        jsonb_build_object('opsta_osnov', v_8b2_base_20, 'posebna_osnov', v_8b2_base_10), v_popdv_next_order, _invoice_id);
    END IF;

    IF v_8e2_pdv > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '8e.2';
      INSERT INTO popdv_report_detail_rows (report_id, company_id, section, row_code, document_date, document_type_number, partner_info, supplier_document_number, values, item_order, source_document_id)
      VALUES (v_popdv_report_id, v_invoice.company_id, '8e', '8e.2', v_invoice.receipt_date::date, 'UFU ' || v_invoice.internal_number, v_popdv_partner_info, v_invoice.supplier_invoice_number,
        jsonb_build_object('iznos', v_8e2_pdv), v_popdv_next_order, _invoice_id);
    END IF;

    IF v_6_4_pdv > 0 THEN
      SELECT COALESCE(MAX(item_order), 0) + 1 INTO v_popdv_next_order FROM popdv_report_detail_rows WHERE report_id = v_popdv_report_id AND row_code = '6.4';
      INSERT INTO popdv_report_detail_rows (report_id, company_id, section, row_code, document_date, document_type_number, partner_info, supplier_document_number, values, item_order, source_document_id)
      VALUES (v_popdv_report_id, v_invoice.company_id, '6', '6.4', v_invoice.receipt_date::date, 'UFU ' || v_invoice.internal_number, v_popdv_partner_info, v_invoice.supplier_invoice_number,
        jsonb_build_object('iznos', v_6_4_pdv), v_popdv_next_order, _invoice_id);
    END IF;
  END IF;

  RETURN v_journal_entry_id;
END;
$$;
