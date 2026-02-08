-- Fix unpost_goods_purchase_invoice to find receipt by source_invoice_id as fallback
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ulazna faktura nije pronađena';
  END IF;

  IF v_status != 'posted' THEN
    RAISE EXCEPTION 'Samo proknjižene fakture mogu biti poništene';
  END IF;

  -- FALLBACK: If goods_receipt_id is NULL on invoice, find receipt by source_invoice_id
  IF v_goods_receipt_id IS NULL THEN
    SELECT id INTO v_goods_receipt_id
    FROM goods_receipts
    WHERE source_invoice_id = _invoice_id;
  END IF;

  -- Reset invoice status to draft and clear FK references
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
    -- Also find journal entry by source_document_id as fallback
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_journal_entry_id;
  ELSE
    -- Fallback: find journal entry by source reference
    FOR v_item IN
      SELECT id FROM journal_entries 
      WHERE source_document_type = 'goods_purchase_invoice' 
        AND source_document_id = _invoice_id
    LOOP
      DELETE FROM journal_entry_items WHERE journal_entry_id = v_item.id;
      DELETE FROM journal_entries WHERE id = v_item.id;
    END LOOP;
  END IF;

  -- Reverse stock and delete goods receipt if exists
  IF v_goods_receipt_id IS NOT NULL THEN
    -- Reverse stock for each item
    FOR v_item IN 
      SELECT gri.article_id, gri.quantity 
      FROM goods_receipt_items gri
      JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
      WHERE gri.goods_receipt_id = v_goods_receipt_id
        AND gri.article_id IS NOT NULL
        AND gr.status = 'posted'
    LOOP
      -- Use direct update to bypass article_history trigger auth.uid() issue
      UPDATE articles
      SET stock = COALESCE(stock, 0) - v_item.quantity,
          updated_at = now()
      WHERE id = v_item.article_id;
    END LOOP;

    DELETE FROM goods_receipt_items WHERE goods_receipt_id = v_goods_receipt_id;
    DELETE FROM goods_receipts WHERE id = v_goods_receipt_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- Fix the article_history trigger to handle NULL auth.uid() (e.g. from SECURITY DEFINER functions)
CREATE OR REPLACE FUNCTION public.log_article_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.article_history (article_id, company_id, changed_by, change_type, old_data, new_data)
    VALUES (NEW.id, NEW.company_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'update', to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.article_history (article_id, company_id, changed_by, change_type, new_data)
    VALUES (NEW.id, NEW.company_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'insert', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.article_history (article_id, company_id, changed_by, change_type, old_data)
    VALUES (OLD.id, OLD.company_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'delete', to_jsonb(OLD));
  END IF;
  RETURN NEW;
END;
$$;

-- Now clean up orphaned receipts: find receipts whose invoice is draft but receipt still exists
-- We need an RPC to do cleanup since direct UPDATE from admin tools triggers the article_history issue
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_goods_receipts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_receipt RECORD;
  v_item RECORD;
BEGIN
  FOR v_receipt IN
    SELECT gr.id, gr.status
    FROM goods_receipts gr
    JOIN goods_purchase_invoices gpi ON gpi.id = gr.source_invoice_id
    WHERE gpi.status = 'draft' AND gpi.goods_receipt_id IS NULL
  LOOP
    -- Reverse stock if receipt was posted
    IF v_receipt.status = 'posted' THEN
      FOR v_item IN
        SELECT article_id, quantity FROM goods_receipt_items
        WHERE goods_receipt_id = v_receipt.id AND article_id IS NOT NULL
      LOOP
        UPDATE articles
        SET stock = COALESCE(stock, 0) - v_item.quantity, updated_at = now()
        WHERE id = v_item.article_id;
      END LOOP;
    END IF;
    
    DELETE FROM goods_receipt_items WHERE goods_receipt_id = v_receipt.id;
    DELETE FROM goods_receipts WHERE id = v_receipt.id;
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;