
-- Fix post_service_purchase_invoice to use item-level org_unit_id for cost center booking
CREATE OR REPLACE FUNCTION public.post_service_purchase_invoice(p_invoice_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_item RECORD;
  v_cost RECORD;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_item_order int := 0;
  v_line_amount numeric;
  v_vat_amount numeric;
  v_partner_account text;
  v_org_unit_code text;
BEGIN
  -- Get invoice details
  SELECT spi.*, p.legal_status, p.code as partner_code
  INTO v_invoice
  FROM service_purchase_invoices spi
  LEFT JOIN partners p ON p.id = spi.partner_id
  WHERE spi.id = p_invoice_id;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice.status = 'posted' THEN
    RAISE EXCEPTION 'Invoice is already posted';
  END IF;

  -- Determine partner account (4350 for domestic, 4360 for foreign)
  IF v_invoice.legal_status = 4 THEN
    v_partner_account := '4360';
  ELSE
    v_partner_account := '4350';
  END IF;

  -- Generate entry number
  SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_item_order
  FROM journal_entries
  WHERE business_year_id = v_invoice.business_year_id;

  v_entry_number := v_item_order::text;

  -- Create journal entry header
  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_number,
    document_date, description, status, source_type, source_id, posted_at
  ) VALUES (
    v_invoice.company_id, v_invoice.business_year_id, v_entry_number,
    v_invoice.receipt_date, v_invoice.invoice_number, v_invoice.invoice_date,
    'Ulazna faktura za usluge: ' || v_invoice.invoice_number, 'posted',
    'service_purchase_invoice', v_invoice.id, now()
  )
  RETURNING id INTO v_journal_entry_id;

  v_item_order := 0;

  -- Process each invoice item
  FOR v_item IN
    SELECT * FROM service_purchase_invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    -- Get input cost details
    SELECT * INTO v_cost FROM input_costs WHERE id = v_item.input_cost_id;

    IF v_cost IS NULL THEN
      RAISE EXCEPTION 'Input cost not found for item %', v_item.item_name;
    END IF;

    -- Calculate amounts
    v_line_amount := v_item.quantity * v_item.unit_price;
    v_vat_amount := v_line_amount * (v_cost.vat_rate / 100);

    -- Get org unit code from ITEM level (not invoice header!)
    v_org_unit_code := NULL;
    IF v_item.org_unit_id IS NOT NULL THEN
      SELECT code INTO v_org_unit_code FROM organizational_units WHERE id = v_item.org_unit_id;
    ELSIF v_invoice.org_unit_id IS NOT NULL THEN
      -- Fallback to invoice header if item doesn't have org unit
      SELECT code INTO v_org_unit_code FROM organizational_units WHERE id = v_invoice.org_unit_id;
    END IF;

    -- Book expense (debit)
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_journal_entry_id, v_invoice.company_id, v_cost.account_code, v_item_order,
      v_item.item_name, v_line_amount, 0,
      v_org_unit_code,
      v_invoice.receipt_date
    );
    v_total_debit := v_total_debit + v_line_amount;

    -- Book VAT if deductible
    IF v_cost.is_deductible AND v_vat_amount > 0 THEN
      v_item_order := v_item_order + 1;
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order, description,
        debit_amount, credit_amount, cost_center_code, document_date
      ) VALUES (
        v_journal_entry_id, v_invoice.company_id, '2700', v_item_order,
        'PDV po ulaznoj fakturi', v_vat_amount, 0,
        v_org_unit_code,
        v_invoice.receipt_date
      );
      v_total_debit := v_total_debit + v_vat_amount;
    ELSIF NOT v_cost.is_deductible AND v_vat_amount > 0 THEN
      -- Non-deductible VAT adds to expense
      UPDATE journal_entry_items
      SET debit_amount = debit_amount + v_vat_amount
      WHERE journal_entry_id = v_journal_entry_id
        AND account_code = v_cost.account_code
        AND item_order = v_item_order - (CASE WHEN v_cost.is_deductible THEN 1 ELSE 0 END);
      v_total_debit := v_total_debit + v_vat_amount;
    END IF;
  END LOOP;

  -- Book liability to supplier (credit)
  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id, document_date
  ) VALUES (
    v_journal_entry_id, v_invoice.company_id, v_partner_account, v_item_order,
    'Obaveza prema dobavljaču', 0, v_total_debit,
    v_invoice.partner_id,
    v_invoice.due_date
  );

  -- Update invoice status
  UPDATE service_purchase_invoices
  SET status = 'posted', journal_entry_id = v_journal_entry_id, posted_at = now()
  WHERE id = p_invoice_id;

  RETURN v_journal_entry_id;
END;
$$;
