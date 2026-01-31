-- Fix: Only post deductible VAT to the input VAT account
CREATE OR REPLACE FUNCTION public.post_service_purchase_invoice(
  _invoice_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  _deductible_vat_total numeric := 0; -- Sum of only deductible VAT
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
  
  -- Calculate total deductible VAT (only from items where is_vat_deductible = true)
  SELECT COALESCE(SUM(line_vat), 0) INTO _deductible_vat_total
  FROM service_purchase_invoice_items
  WHERE service_purchase_invoice_id = _invoice_id
    AND is_vat_deductible = true;
  
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
  
  -- Debit: Ulazni PDV (ONLY deductible VAT)
  IF _invoice.supplier_is_in_pdv AND _invoice.vat_calculation_type = 'standard' AND _deductible_vat_total > 0 THEN
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, partner_id
    ) VALUES (
      _journal_entry_id, _invoice.company_id, _input_vat_account, _item_order,
      'Ulazni PDV (odbitni) - faktura ' || _invoice.internal_number,
      _deductible_vat_total, 0, NULL
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
    
    -- Ako PDV nije odbitni, uključi ga u trošak (line_total = osnovica + PDV)
    -- Ako je PDV odbitni, knjiži samo osnovicu (line_subtotal)
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