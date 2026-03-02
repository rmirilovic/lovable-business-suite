
CREATE OR REPLACE FUNCTION public.unpost_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice invoices%ROWTYPE;
  _je_id uuid;
BEGIN
  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Faktura nije pronađena'; END IF;
  IF _invoice.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjižene fakture mogu biti poništene'; END IF;

  IF EXISTS (SELECT 1 FROM credit_notes WHERE source_invoice_id = _invoice_id AND status != 'cancelled') THEN
    RAISE EXCEPTION 'Nije moguće poništiti knjiženje - postoji povezano knjižno odobrenje';
  END IF;

  _je_id := _invoice.journal_entry_id;

  -- First clear the FK reference on the invoice
  UPDATE invoices
  SET status = 'draft',
      posted_at = NULL,
      posted_by = NULL,
      journal_entry_id = NULL,
      updated_at = now()
  WHERE id = _invoice_id;

  -- Then delete the journal entry
  IF _je_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = _je_id;
    DELETE FROM journal_entries WHERE id = _je_id;
  END IF;

  RETURN true;
END;
$$;
