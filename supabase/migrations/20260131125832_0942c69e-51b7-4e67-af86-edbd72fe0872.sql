-- Fix the unpost function to use correct argument order for get_user_access_level
CREATE OR REPLACE FUNCTION public.unpost_service_purchase_invoice(
  _invoice_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_journal_entry_id uuid;
  v_access_level text;
BEGIN
  -- Get invoice data
  SELECT * INTO v_invoice
  FROM service_purchase_invoices
  WHERE id = _invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Faktura nije pronađena';
  END IF;
  
  -- Check if invoice is posted
  IF v_invoice.status != 'posted' THEN
    RAISE EXCEPTION 'Samo proknjižene fakture mogu biti poništene';
  END IF;
  
  -- Check user access level on nabavka.ulazne_fakture_usluge module
  -- Correct argument order: _user_id, _company_id, _module_code, _org_unit_id
  v_access_level := get_user_access_level(_user_id, v_invoice.company_id, 'nabavka.ulazne_fakture_usluge', NULL);
  
  IF v_access_level != 'admin' THEN
    RAISE EXCEPTION 'Nemate admin dozvole za poništavanje knjiženja';
  END IF;
  
  -- Store journal entry id for deletion
  v_journal_entry_id := v_invoice.journal_entry_id;
  
  -- Reset invoice status to draft
  UPDATE service_purchase_invoices
  SET 
    status = 'draft',
    posted_at = NULL,
    posted_by = NULL,
    journal_entry_id = NULL,
    updated_at = now()
  WHERE id = _invoice_id;
  
  -- Delete journal entry items first (due to FK constraint)
  IF v_journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items
    WHERE journal_entry_id = v_journal_entry_id;
    
    -- Delete the journal entry
    DELETE FROM journal_entries
    WHERE id = v_journal_entry_id;
  END IF;
  
  RETURN true;
END;
$$;