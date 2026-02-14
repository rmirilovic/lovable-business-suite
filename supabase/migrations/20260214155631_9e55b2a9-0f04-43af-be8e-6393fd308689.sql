
CREATE OR REPLACE FUNCTION public.unpost_inventory_count(_count_id UUID, _user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ic RECORD;
  v_je_id UUID;
BEGIN
  SELECT * INTO v_ic FROM inventory_counts WHERE id = _count_id;

  IF v_ic IS NULL THEN
    RAISE EXCEPTION 'Popisna lista nije pronađena';
  END IF;
  IF v_ic.status != 'posted' THEN
    RAISE EXCEPTION 'Popisna lista nije proknjižena';
  END IF;

  v_je_id := v_ic.journal_entry_id;

  -- Clear the FK reference FIRST
  UPDATE inventory_counts
  SET status = 'draft', posted_at = NULL, posted_by = NULL, journal_entry_id = NULL
  WHERE id = _count_id;

  -- Then delete journal entry
  IF v_je_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_je_id;
    DELETE FROM journal_entries WHERE id = v_je_id;
  END IF;
END;
$$;
