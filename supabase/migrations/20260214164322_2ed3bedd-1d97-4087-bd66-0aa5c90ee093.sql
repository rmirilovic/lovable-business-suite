
-- Fix search_path on unpost function
CREATE OR REPLACE FUNCTION public.unpost_price_adjustment(_adjustment_id UUID, _user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pa RECORD;
  v_item RECORD;
BEGIN
  SELECT * INTO v_pa FROM price_adjustments WHERE id = _adjustment_id;

  IF v_pa.status != 'posted' THEN
    RAISE EXCEPTION 'Dokument nije proknjižen';
  END IF;

  FOR v_item IN SELECT * FROM price_adjustment_items WHERE price_adjustment_id = _adjustment_id
  LOOP
    UPDATE articles SET selling_price = v_item.old_price WHERE id = v_item.article_id;
  END LOOP;

  IF v_pa.journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_pa.journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_pa.journal_entry_id;
  END IF;

  UPDATE price_adjustments SET
    status = 'draft',
    posted_at = NULL,
    posted_by = NULL,
    journal_entry_id = NULL
  WHERE id = _adjustment_id;
END;
$$;
