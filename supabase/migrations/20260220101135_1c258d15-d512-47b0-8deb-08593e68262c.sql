CREATE OR REPLACE FUNCTION public.close_reprocessing_work_order(_order_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_order RECORD;
  v_je_id uuid;
  v_entry_number text;
  v_item_order int := 0;
  v_total_input_value numeric := 0;
  v_total_material_value numeric := 0;
  v_warehouse_code text;
  v_mat_warehouse_code text;
BEGIN
  SELECT rwo.*, w.code as warehouse_code
  INTO v_order
  FROM reprocessing_work_orders rwo
  JOIN warehouses w ON w.id = rwo.warehouse_id
  WHERE rwo.id = _order_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'RN za preradu nije pronadjen'; END IF;
  IF v_order.status != 'launched' THEN RAISE EXCEPTION 'Samo lansirani RN mogu biti zakljuceni'; END IF;

  v_warehouse_code := v_order.warehouse_code;

  SELECT COALESCE(SUM(item_value), 0) INTO v_total_input_value
  FROM reprocessing_wo_input_items WHERE work_order_id = _order_id;

  SELECT COALESCE(SUM(item_value), 0) INTO v_total_material_value
  FROM reprocessing_wo_materials WHERE work_order_id = _order_id;

  SELECT w.code INTO v_mat_warehouse_code
  FROM reprocessing_wo_materials rwm
  JOIN warehouses w ON w.id = rwm.warehouse_id
  WHERE rwm.work_order_id = _order_id
  LIMIT 1;

  v_entry_number := 'RPR' || v_order.order_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit,
    created_by, source_document_type, source_document_id,
    posted_at, posted_by
  ) VALUES (
    v_order.company_id, v_order.business_year_id, v_entry_number,
    v_order.order_date::date, v_order.order_date::date,
    v_order.order_number,
    'Zakljucenje RN za preradu ' || v_order.order_number,
    'posted', 0, 0,
    _user_id, 'reprocessing_work_order', _order_id,
    now(), _user_id
  ) RETURNING id INTO v_je_id;

  IF v_total_input_value > 0 THEN
    UPDATE articles a
    SET stock = COALESCE(a.stock, 0) - rwi.quantity, updated_at = now()
    FROM reprocessing_wo_input_items rwi
    WHERE a.id = rwi.article_id AND rwi.work_order_id = _order_id;

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_order.company_id, '9600', v_item_order,
      'Istrebovani GP za preradu - RN ' || v_order.order_number,
      -v_total_input_value, 0, v_warehouse_code, v_order.order_date::date
    );

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_order.company_id, '9500', v_item_order,
      'Istrebovani GP za preradu - RN ' || v_order.order_number,
      0, -v_total_input_value, v_order.order_number, v_order.order_date::date
    );
  END IF;

  IF v_total_material_value > 0 THEN
    UPDATE articles a
    SET stock = COALESCE(a.stock, 0) - rwm.quantity, updated_at = now()
    FROM reprocessing_wo_materials rwm
    WHERE a.id = rwm.article_id AND rwm.work_order_id = _order_id;

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_order.company_id, '5110', v_item_order,
      'Utrosak materijala za preradu - RN ' || v_order.order_number,
      v_total_material_value, 0, v_order.order_number, v_order.order_date::date
    );

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_order.company_id, '1010', v_item_order,
      'Izdavanje materijala - RN ' || v_order.order_number,
      0, v_total_material_value, COALESCE(v_mat_warehouse_code, v_warehouse_code), v_order.order_date::date
    );

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_order.company_id, '9500', v_item_order,
      'Utrosak materijala po RN za preradu',
      v_total_material_value, 0, v_order.order_number, v_order.order_date::date
    );

    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, cost_center_code, document_date
    ) VALUES (
      v_je_id, v_order.company_id, '9100', v_item_order,
      'Smanjenje zaliha materijala - RN ' || v_order.order_number,
      0, v_total_material_value, COALESCE(v_mat_warehouse_code, v_warehouse_code), v_order.order_date::date
    );
  END IF;

  UPDATE journal_entries
  SET total_debit = (SELECT COALESCE(SUM(debit_amount), 0) FROM journal_entry_items WHERE journal_entry_id = v_je_id),
      total_credit = (SELECT COALESCE(SUM(credit_amount), 0) FROM journal_entry_items WHERE journal_entry_id = v_je_id)
  WHERE id = v_je_id;

  UPDATE reprocessing_work_orders
  SET status = 'closed', closed_at = now(), closed_by = _user_id, journal_entry_id = v_je_id
  WHERE id = _order_id;

  RETURN v_je_id;
END;
$fn$;