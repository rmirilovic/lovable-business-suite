
CREATE OR REPLACE FUNCTION public.unpost_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice invoices%ROWTYPE;
BEGIN
  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF _invoice.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjižene fakture mogu biti poništene'; END IF;

  -- Check if any credit notes reference this invoice
  IF EXISTS (SELECT 1 FROM credit_notes WHERE source_invoice_id = _invoice_id AND status != 'cancelled') THEN
    RAISE EXCEPTION 'Nije moguće poništiti knjiženje - postoji povezano knjižno odobrenje';
  END IF;

  -- Delete journal entry items and journal entry
  IF _invoice.journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = _invoice.journal_entry_id;
    DELETE FROM journal_entries WHERE id = _invoice.journal_entry_id;
  END IF;

  -- Reset invoice status
  UPDATE invoices
  SET status = 'draft',
      posted_at = NULL,
      posted_by = NULL,
      journal_entry_id = NULL,
      updated_at = now()
  WHERE id = _invoice_id;

  RETURN true;
END;
$$;
