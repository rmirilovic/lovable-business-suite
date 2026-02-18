
-- Add journal_entry_id column to production_delivery_notes
ALTER TABLE public.production_delivery_notes
ADD COLUMN journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL;

-- Create post function
CREATE OR REPLACE FUNCTION public.post_production_delivery_note(_note_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_note RECORD;
  v_item RECORD;
  v_je_id uuid;
  v_entry_number text;
  v_total_value numeric := 0;
  v_warehouse_code text;
BEGIN
  -- Get note with warehouse info
  SELECT pdn.*, w.code as warehouse_code
  INTO v_note
  FROM production_delivery_notes pdn
  JOIN warehouses w ON w.id = pdn.warehouse_id
  WHERE pdn.id = _note_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Predajnica nije pronađena'; END IF;
  IF v_note.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;

  -- Check items exist
  IF NOT EXISTS (SELECT 1 FROM production_delivery_note_items WHERE delivery_note_id = _note_id) THEN
    RAISE EXCEPTION 'Predajnica nema stavki';
  END IF;

  v_warehouse_code := v_note.warehouse_code;

  -- Update stock and calculate total value
  FOR v_item IN
    SELECT article_id, delivered_kg, item_value
    FROM production_delivery_note_items
    WHERE delivery_note_id = _note_id
  LOOP
    v_total_value := v_total_value + COALESCE(v_item.item_value, 0);

    -- Increase stock in GP warehouse
    UPDATE articles
    SET stock = COALESCE(stock, 0) + v_item.delivered_kg,
        updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  -- Create journal entry
  v_entry_number := 'PGP' || v_note.delivery_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit,
    created_by, source_document_type, source_document_id,
    posted_at, posted_by
  ) VALUES (
    v_note.company_id, v_note.business_year_id, v_entry_number,
    v_note.delivery_date, v_note.delivery_date,
    v_note.delivery_number,
    'Predajnica GP ' || v_note.delivery_number,
    'posted', v_total_value, v_total_value,
    _user_id, 'production_delivery_note', _note_id,
    now(), _user_id
  ) RETURNING id INTO v_je_id;

  -- 1. 9600 Duguje - analitika šifra magacina GP
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, cost_center_code, document_date
  ) VALUES (
    v_je_id, v_note.company_id, '9600', 1,
    'Predaja GP u magacin - predajnica ' || v_note.delivery_number,
    v_total_value, 0, v_warehouse_code, v_note.delivery_date
  );

  -- 2. 9500 Potražuje - analitika broj predajnice
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, cost_center_code, document_date
  ) VALUES (
    v_je_id, v_note.company_id, '9500', 2,
    'Predaja GP iz proizvodnje - predajnica ' || v_note.delivery_number,
    0, v_total_value, v_note.delivery_number, v_note.delivery_date
  );

  -- Update note status
  UPDATE production_delivery_notes
  SET status = 'posted',
      posted_at = now(),
      posted_by = _user_id,
      journal_entry_id = v_je_id,
      total_value = v_total_value
  WHERE id = _note_id;

  RETURN v_je_id;
END;
$$;

-- Create unpost function
CREATE OR REPLACE FUNCTION public.unpost_production_delivery_note(_note_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_note RECORD;
  v_item RECORD;
  v_je_id uuid;
  v_access_level text;
BEGIN
  SELECT * INTO v_note FROM production_delivery_notes WHERE id = _note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Predajnica nije pronađena'; END IF;
  IF v_note.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjižene predajnice mogu biti poništene'; END IF;

  -- Check permissions
  v_access_level := get_user_access_level(_user_id, v_note.company_id, 'proizvodnja.predajnice', NULL);
  IF v_access_level != 'admin' THEN
    RAISE EXCEPTION 'Nemate admin dozvole za poništavanje knjiženja predajnice';
  END IF;

  -- Restore stock
  FOR v_item IN
    SELECT article_id, delivered_kg
    FROM production_delivery_note_items
    WHERE delivery_note_id = _note_id
  LOOP
    UPDATE articles
    SET stock = COALESCE(stock, 0) - v_item.delivered_kg,
        updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  -- Delete journal entry
  v_je_id := v_note.journal_entry_id;
  IF v_je_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_je_id;
    DELETE FROM journal_entries WHERE id = v_je_id;
  END IF;

  -- Reset status
  UPDATE production_delivery_notes
  SET status = 'draft',
      posted_at = NULL,
      posted_by = NULL,
      journal_entry_id = NULL
  WHERE id = _note_id;

  RETURN true;
END;
$$;
