
-- Fix post_delivery_note: document_id is UUID, not text
CREATE OR REPLACE FUNCTION public.post_delivery_note(_delivery_note_id UUID, _user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_item RECORD;
  v_stock RECORD;
  v_unit_price NUMERIC;
  v_order_id UUID;
BEGIN
  SELECT * INTO v_dn FROM delivery_notes WHERE id = _delivery_note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Otpremnica nije pronađena'; END IF;
  IF v_dn.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;
  IF v_dn.warehouse_id IS NULL THEN RAISE EXCEPTION 'Otpremnica nema definisan magacin'; END IF;

  IF NOT EXISTS (SELECT 1 FROM delivery_note_items WHERE delivery_note_id = _delivery_note_id) THEN
    RAISE EXCEPTION 'Otpremnica nema stavki';
  END IF;

  FOR v_item IN
    SELECT dni.id AS item_id, dni.article_id, dni.quantity
    FROM delivery_note_items dni
    WHERE dni.delivery_note_id = _delivery_note_id
  LOOP
    SELECT ws.balance_qty, ws.balance_value
    INTO v_stock
    FROM get_warehouse_stock(v_dn.company_id, v_dn.warehouse_id) ws
    WHERE ws.article_id = v_item.article_id;

    IF NOT FOUND OR COALESCE(v_stock.balance_qty, 0) <= 0 THEN
      RAISE EXCEPTION 'Artikal nema zalihe u magacinu (article_id: %)', v_item.article_id;
    END IF;

    IF v_stock.balance_qty < v_item.quantity THEN
      RAISE EXCEPTION 'Nedovoljna zaliha za artikal (potrebno: %, dostupno: %)', v_item.quantity, v_stock.balance_qty;
    END IF;

    v_unit_price := ROUND(v_stock.balance_value / v_stock.balance_qty, 6);

    UPDATE delivery_note_items
    SET unit_price = v_unit_price,
        line_value = ROUND(v_item.quantity * v_unit_price, 2)
    WHERE id = v_item.item_id;

    UPDATE articles
    SET stock = COALESCE(stock, 0) - v_item.quantity,
        updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  UPDATE delivery_notes
  SET status = 'posted',
      posted_at = now(),
      posted_by = _user_id,
      updated_at = now()
  WHERE id = _delivery_note_id;

  SELECT dord.id INTO v_order_id
  FROM delivery_orders dord
  WHERE dord.delivery_note_id = _delivery_note_id;

  IF v_order_id IS NOT NULL THEN
    UPDATE delivery_orders
    SET status = 'shipped',
        updated_at = now()
    WHERE id = v_order_id;

    DELETE FROM warehouse_reservations
    WHERE document_type = 'delivery_order'
      AND document_id = v_order_id;
  END IF;

  RETURN _delivery_note_id;
END;
$$;

-- Fix unpost_delivery_note: document_id is UUID, not text
CREATE OR REPLACE FUNCTION public.unpost_delivery_note(_delivery_note_id UUID, _user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_item RECORD;
  v_order delivery_orders%ROWTYPE;
  v_order_item RECORD;
BEGIN
  SELECT * INTO v_dn FROM delivery_notes WHERE id = _delivery_note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Otpremnica nije pronađena'; END IF;
  IF v_dn.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjižene otpremnice mogu biti vraćene u nacrt'; END IF;
  IF v_dn.invoice_id IS NOT NULL THEN RAISE EXCEPTION 'Otpremnica je fakturisana i ne može biti vraćena u nacrt'; END IF;

  FOR v_item IN
    SELECT article_id, quantity
    FROM delivery_note_items
    WHERE delivery_note_id = _delivery_note_id
  LOOP
    UPDATE articles
    SET stock = COALESCE(stock, 0) + v_item.quantity,
        updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  UPDATE delivery_note_items
  SET unit_price = 0, line_value = 0
  WHERE delivery_note_id = _delivery_note_id;

  UPDATE delivery_notes
  SET status = 'draft',
      posted_at = NULL,
      posted_by = NULL,
      updated_at = now()
  WHERE id = _delivery_note_id;

  SELECT dord.* INTO v_order
  FROM delivery_orders dord
  WHERE dord.delivery_note_id = _delivery_note_id;

  IF v_order.id IS NOT NULL THEN
    UPDATE delivery_orders
    SET status = 'reserved',
        updated_at = now()
    WHERE id = v_order.id;

    FOR v_order_item IN
      SELECT doi.article_id, doi.item_code, doi.item_name, doi.unit, doi.quantity
      FROM delivery_order_items doi
      WHERE doi.delivery_order_id = v_order.id
    LOOP
      INSERT INTO warehouse_reservations (
        company_id, business_year_id, warehouse_id,
        article_id, article_code, article_name, unit, quantity,
        reservation_date, document_type, document_id, document_number,
        partner_id, partner_code, partner_name,
        note, created_by, created_by_name
      )
      SELECT
        v_order.company_id, v_order.business_year_id,
        COALESCE(v_order.warehouse_id, v_dn.warehouse_id),
        v_order_item.article_id, v_order_item.item_code, v_order_item.item_name,
        v_order_item.unit, v_order_item.quantity,
        now()::date, 'delivery_order', v_order.id, v_order.order_number,
        v_order.partner_id, p.code, p.name,
        'Vraćeno poništavanjem otpremnice', _user_id::text, ''
      FROM partners p
      WHERE p.id = v_order.partner_id;
    END LOOP;
  END IF;

  RETURN _delivery_note_id;
END;
$$;
