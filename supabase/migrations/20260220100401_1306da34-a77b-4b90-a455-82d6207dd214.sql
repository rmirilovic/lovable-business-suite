CREATE OR REPLACE FUNCTION public.post_reprocessing_delivery_note(_note_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_note RECORD;
  v_item RECORD;
  v_je_id uuid;
  v_entry_number text;
  v_total_value numeric := 0;
  v_warehouse_code text;
BEGIN
  SELECT rdn.*, w.code as warehouse_code
  INTO v_note
  FROM reprocessing_delivery_notes rdn
  JOIN warehouses w ON w.id = rdn.warehouse_id
  WHERE rdn.id = _note_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Predajnica nije pronadjena'; END IF;
  IF v_note.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjizeni'; END IF;

  IF NOT EXISTS (SELECT 1 FROM reprocessing_delivery_note_items WHERE delivery_note_id = _note_id) THEN
    RAISE EXCEPTION 'Predajnica nema stavki';
  END IF;

  v_warehouse_code := v_note.warehouse_code;

  FOR v_item IN
    SELECT article_id, delivered_kg, item_value
    FROM reprocessing_delivery_note_items WHERE delivery_note_id = _note_id
  LOOP
    v_total_value := v_total_value + COALESCE(v_item.item_value, 0);
    UPDATE articles SET stock = COALESCE(stock, 0) + v_item.delivered_kg, updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  v_entry_number := 'RPD' || v_note.delivery_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit,
    created_by, source_document_type, source_document_id,
    posted_at, posted_by
  ) VALUES (
    v_note.company_id, v_note.business_year_id, v_entry_number,
    v_note.delivery_date::date, v_note.delivery_date::date,
    v_note.delivery_number,
    'Predajnica preradu ' || v_note.delivery_number,
    'posted', v_total_value, v_total_value,
    _user_id, 'reprocessing_delivery_note', _note_id,
    now(), _user_id
  ) RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, cost_center_code, document_date
  ) VALUES (
    v_je_id, v_note.company_id, '9600', 1,
    'Predaja GP u magacin - predajnica ' || v_note.delivery_number,
    v_total_value, 0, v_warehouse_code, v_note.delivery_date::date
  );

  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, cost_center_code, document_date
  ) VALUES (
    v_je_id, v_note.company_id, '9500', 2,
    'Predaja GP iz prerade - predajnica ' || v_note.delivery_number,
    0, v_total_value, v_note.delivery_number, v_note.delivery_date::date
  );

  UPDATE reprocessing_delivery_notes
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = v_je_id, total_value = v_total_value
  WHERE id = _note_id;

  RETURN v_je_id;
END;
$fn$;