
-- Fix unpost_goods_purchase_invoice to properly handle goods receipt deletion and stock reversal
CREATE OR REPLACE FUNCTION public.unpost_goods_purchase_invoice(_invoice_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journal_entry_id UUID;
  v_goods_receipt_id UUID;
  v_status TEXT;
  v_item RECORD;
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

  -- FIRST: Reset invoice status to draft and clear FK references
  UPDATE goods_purchase_invoices
  SET 
    status = 'draft',
    posted_at = NULL,
    posted_by = NULL,
    journal_entry_id = NULL,
    goods_receipt_id = NULL,
    updated_at = now()
  WHERE id = _invoice_id;

  -- Delete journal entry if exists
  IF v_journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_journal_entry_id;
  END IF;

  -- Reverse stock and delete goods receipt if exists
  IF v_goods_receipt_id IS NOT NULL THEN
    -- Reverse stock for each item (only if receipt was posted)
    FOR v_item IN 
      SELECT gri.article_id, gri.quantity 
      FROM goods_receipt_items gri
      JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
      WHERE gri.goods_receipt_id = v_goods_receipt_id
        AND gri.article_id IS NOT NULL
        AND gr.status = 'posted'
    LOOP
      UPDATE articles
      SET stock = COALESCE(stock, 0) - v_item.quantity,
          updated_at = now()
      WHERE id = v_item.article_id;
    END LOOP;

    -- Delete receipt items then receipt
    DELETE FROM goods_receipt_items WHERE goods_receipt_id = v_goods_receipt_id;
    DELETE FROM goods_receipts WHERE id = v_goods_receipt_id;
  END IF;

  RETURN TRUE;
END;
$$;
