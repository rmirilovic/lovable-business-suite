-- Create unpost function for goods purchase invoices
CREATE OR REPLACE FUNCTION public.unpost_goods_purchase_invoice(
  _invoice_id UUID,
  _user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journal_entry_id UUID;
  v_goods_receipt_id UUID;
  v_status TEXT;
BEGIN
  -- Get current invoice data
  SELECT status, journal_entry_id, goods_receipt_id
  INTO v_status, v_journal_entry_id, v_goods_receipt_id
  FROM goods_purchase_invoices
  WHERE id = _invoice_id;

  -- Validate invoice exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ulazna faktura nije pronađena';
  END IF;

  -- Validate invoice is posted
  IF v_status != 'posted' THEN
    RAISE EXCEPTION 'Samo proknjižene fakture mogu biti poništene';
  END IF;

  -- Delete journal entry if exists (items will be cascade deleted)
  IF v_journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_journal_entry_id;
  END IF;

  -- TODO: Handle goods receipt reversal if needed in the future
  -- For now, just clear the reference

  -- Reset invoice status to draft
  UPDATE goods_purchase_invoices
  SET 
    status = 'draft',
    posted_at = NULL,
    posted_by = NULL,
    journal_entry_id = NULL,
    goods_receipt_id = NULL,
    updated_at = now()
  WHERE id = _invoice_id;

  RETURN TRUE;
END;
$$;