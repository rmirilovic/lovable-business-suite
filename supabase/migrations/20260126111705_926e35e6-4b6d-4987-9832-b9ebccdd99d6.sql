-- Function to post invoice and create journal entry
CREATE OR REPLACE FUNCTION public.post_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice invoices%ROWTYPE;
  _journal_entry_id uuid;
  _journal_entry_number integer;
  _partner partners%ROWTYPE;
  _receivable_account text := '2010'; -- Kupci u zemlji
  _revenue_account text := '6100'; -- Prihodi od prodaje
  _vat_account text := '4700'; -- Obaveze za PDV
BEGIN
  -- Get invoice
  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Faktura nije pronađena';
  END IF;
  
  IF _invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi';
  END IF;
  
  IF _invoice.total_amount <= 0 THEN
    RAISE EXCEPTION 'Faktura mora imati pozitivan iznos';
  END IF;
  
  -- Get partner
  SELECT * INTO _partner FROM partners WHERE id = _invoice.partner_id;
  
  -- Get next journal entry number
  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO _journal_entry_number
  FROM journal_entries
  WHERE company_id = _invoice.company_id AND business_year_id = _invoice.business_year_id;
  
  -- Create journal entry
  INSERT INTO journal_entries (
    company_id,
    business_year_id,
    org_unit_id,
    entry_number,
    entry_date,
    document_date,
    document_number,
    description,
    status,
    total_debit,
    total_credit,
    posted_at,
    posted_by,
    source_document_type,
    source_document_id,
    created_by
  ) VALUES (
    _invoice.company_id,
    _invoice.business_year_id,
    _invoice.org_unit_id,
    _journal_entry_number,
    _invoice.invoice_date,
    _invoice.invoice_date,
    _invoice.invoice_number,
    'Faktura ' || _invoice.invoice_number || ' - ' || _partner.name,
    'posted',
    _invoice.total_amount,
    _invoice.total_amount,
    now(),
    _user_id,
    'invoice',
    _invoice_id,
    _user_id
  )
  RETURNING id INTO _journal_entry_id;
  
  -- Create journal entry items
  -- Debit: Kupci (potraživanje) - ukupan iznos sa PDV
  INSERT INTO journal_entry_items (
    journal_entry_id,
    company_id,
    account_code,
    item_order,
    description,
    debit_amount,
    credit_amount,
    partner_id
  ) VALUES (
    _journal_entry_id,
    _invoice.company_id,
    _receivable_account,
    1,
    'Potraživanje od kupca - ' || _partner.name,
    _invoice.total_amount,
    0,
    _invoice.partner_id
  );
  
  -- Credit: Prihodi od prodaje (osnovica bez PDV)
  INSERT INTO journal_entry_items (
    journal_entry_id,
    company_id,
    account_code,
    item_order,
    description,
    debit_amount,
    credit_amount,
    partner_id
  ) VALUES (
    _journal_entry_id,
    _invoice.company_id,
    _revenue_account,
    2,
    'Prihod od prodaje - faktura ' || _invoice.invoice_number,
    0,
    _invoice.subtotal,
    NULL
  );
  
  -- Credit: PDV obaveza (ako ima PDV)
  IF _invoice.vat_amount > 0 THEN
    INSERT INTO journal_entry_items (
      journal_entry_id,
      company_id,
      account_code,
      item_order,
      description,
      debit_amount,
      credit_amount,
      partner_id
    ) VALUES (
      _journal_entry_id,
      _invoice.company_id,
      _vat_account,
      3,
      'PDV obaveza - faktura ' || _invoice.invoice_number,
      0,
      _invoice.vat_amount,
      NULL
    );
  END IF;
  
  -- Update invoice status and link to journal entry
  UPDATE invoices
  SET status = 'posted',
      posted_at = now(),
      posted_by = _user_id,
      journal_entry_id = _journal_entry_id
  WHERE id = _invoice_id;
  
  RETURN TRUE;
END;
$$;

-- Function to get posted delivery notes available for invoicing
CREATE OR REPLACE FUNCTION public.get_uninvoiced_delivery_notes(_company_id uuid, _partner_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  delivery_number text,
  delivery_date date,
  partner_id uuid,
  partner_name text,
  partner_code text,
  item_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    dn.id,
    dn.delivery_number,
    dn.delivery_date,
    dn.partner_id,
    p.name as partner_name,
    p.code as partner_code,
    COUNT(dni.id) as item_count
  FROM delivery_notes dn
  JOIN partners p ON p.id = dn.partner_id
  LEFT JOIN delivery_note_items dni ON dni.delivery_note_id = dn.id
  WHERE dn.company_id = _company_id
    AND dn.status = 'posted'
    AND dn.invoice_id IS NULL
    AND (_partner_id IS NULL OR dn.partner_id = _partner_id)
  GROUP BY dn.id, dn.delivery_number, dn.delivery_date, dn.partner_id, p.name, p.code
  ORDER BY dn.delivery_date DESC;
$$;