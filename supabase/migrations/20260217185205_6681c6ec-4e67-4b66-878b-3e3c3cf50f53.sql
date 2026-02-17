
-- Add journal_entry_id to material_requisitions
ALTER TABLE material_requisitions ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL;

-- Post material requisition function
CREATE OR REPLACE FUNCTION public.post_material_requisition(_requisition_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req RECORD;
  v_item RECORD;
  v_je_id uuid;
  v_entry_number text;
  v_item_order int := 0;
  v_total_value numeric := 0;
  v_warehouse_code text;
  v_work_order_number text;
BEGIN
  -- Get requisition with warehouse info
  SELECT mr.*, w.code as warehouse_code
  INTO v_req
  FROM material_requisitions mr
  JOIN warehouses w ON w.id = mr.warehouse_id
  WHERE mr.id = _requisition_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Trebovanje nije pronađeno'; END IF;
  IF v_req.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;

  -- Check items exist
  IF NOT EXISTS (SELECT 1 FROM material_requisition_items WHERE requisition_id = _requisition_id) THEN
    RAISE EXCEPTION 'Trebovanje nema stavki';
  END IF;

  v_warehouse_code := v_req.warehouse_code;

  -- Get work order number for analytics
  IF v_req.work_order_id IS NOT NULL THEN
    SELECT order_number INTO v_work_order_number FROM work_orders WHERE id = v_req.work_order_id;
  END IF;

  -- Calculate total value and update stock
  FOR v_item IN
    SELECT article_id, quantity, unit_price, item_value
    FROM material_requisition_items
    WHERE requisition_id = _requisition_id
  LOOP
    v_total_value := v_total_value + v_item.item_value;

    -- Decrease stock
    UPDATE articles
    SET stock = COALESCE(stock, 0) - v_item.quantity,
        updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  -- Create journal entry
  v_entry_number := 'TREB' || v_req.requisition_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit,
    created_by, source_document_type, source_document_id,
    posted_at, posted_by
  ) VALUES (
    v_req.company_id, v_req.business_year_id, v_entry_number,
    v_req.requisition_date, v_req.requisition_date,
    v_req.requisition_number,
    'Trebovanje ' || v_req.requisition_number,
    'posted', v_total_value * 2, v_total_value * 2,
    _user_id, 'material_requisition', _requisition_id,
    now(), _user_id
  ) RETURNING id INTO v_je_id;

  -- 1. 5110 Duguje - analitika BrojTrebovanja
  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, cost_center_code, document_date
  ) VALUES (
    v_je_id, v_req.company_id, '5110', v_item_order,
    'Utrošak materijala - trebovanje ' || v_req.requisition_number,
    v_total_value, 0, v_req.requisition_number, v_req.requisition_date
  );

  -- 2. 1010 Potražuje - analitika magacin
  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, cost_center_code, document_date
  ) VALUES (
    v_je_id, v_req.company_id, '1010', v_item_order,
    'Izdavanje materijala iz magacina',
    0, v_total_value, v_warehouse_code, v_req.requisition_date
  );

  -- 3. 9500 Duguje - analitika BrojRN
  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, cost_center_code, document_date
  ) VALUES (
    v_je_id, v_req.company_id, '9500', v_item_order,
    'Utrošak materijala po radnom nalogu',
    v_total_value, 0, COALESCE(v_work_order_number, v_req.requisition_number), v_req.requisition_date
  );

  -- 4. 9100 Potražuje - analitika magacin
  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, cost_center_code, document_date
  ) VALUES (
    v_je_id, v_req.company_id, '9100', v_item_order,
    'Smanjenje zaliha materijala',
    0, v_total_value, v_warehouse_code, v_req.requisition_date
  );

  -- Update requisition status
  UPDATE material_requisitions
  SET status = 'posted',
      posted_at = now(),
      posted_by = _user_id,
      journal_entry_id = v_je_id
  WHERE id = _requisition_id;

  RETURN v_je_id;
END;
$$;

-- Unpost material requisition function
CREATE OR REPLACE FUNCTION public.unpost_material_requisition(_requisition_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req RECORD;
  v_item RECORD;
  v_je_id uuid;
  v_access_level text;
BEGIN
  SELECT * INTO v_req FROM material_requisitions WHERE id = _requisition_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trebovanje nije pronađeno'; END IF;
  IF v_req.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjižena trebovanja mogu biti poništena'; END IF;

  -- Check permissions
  v_access_level := get_user_access_level(_user_id, v_req.company_id, 'proizvodnja.trebovanja', NULL);
  IF v_access_level != 'admin' THEN
    RAISE EXCEPTION 'Nemate admin dozvole za poništavanje knjiženja trebovanja';
  END IF;

  -- Restore stock
  FOR v_item IN
    SELECT article_id, quantity
    FROM material_requisition_items
    WHERE requisition_id = _requisition_id
  LOOP
    UPDATE articles
    SET stock = COALESCE(stock, 0) + v_item.quantity,
        updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  -- Delete journal entry
  v_je_id := v_req.journal_entry_id;
  IF v_je_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_je_id;
    DELETE FROM journal_entries WHERE id = v_je_id;
  END IF;

  -- Reset status
  UPDATE material_requisitions
  SET status = 'draft',
      posted_at = NULL,
      posted_by = NULL,
      journal_entry_id = NULL
  WHERE id = _requisition_id;

  RETURN true;
END;
$$;

-- Update get_warehouse_inventory_list to include material requisitions (outflow)
CREATE OR REPLACE FUNCTION public.get_warehouse_inventory_list(p_company_id uuid, p_warehouse_id uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(article_id uuid, article_code text, article_name text, unit text, opening_qty numeric, in_qty numeric, out_qty numeric, turnover_qty numeric, closing_qty numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH movements AS (
    -- Goods receipts
    SELECT gri.article_id, gri.quantity AS qty_in, 0::NUMERIC AS qty_out, gr.receipt_date AS movement_date
    FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
    WHERE gr.company_id = p_company_id AND gr.warehouse_id = p_warehouse_id AND gr.status = 'posted' AND gri.article_id IS NOT NULL
    UNION ALL
    -- Delivery notes (outflow)
    SELECT dni.article_id, 0::NUMERIC, dni.quantity, dn.delivery_date
    FROM delivery_note_items dni JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    WHERE dn.company_id = p_company_id AND dn.warehouse_id = p_warehouse_id AND dn.status = 'posted'
    UNION ALL
    -- Material requisitions (outflow)
    SELECT mri.article_id, 0::NUMERIC, mri.quantity, mr.requisition_date::date
    FROM material_requisition_items mri JOIN material_requisitions mr ON mr.id = mri.requisition_id
    WHERE mr.company_id = p_company_id AND mr.warehouse_id = p_warehouse_id AND mr.status = 'posted'
    UNION ALL
    -- Inventory count surplus (inflow)
    SELECT ici.article_id, ici.surplus_qty, 0::NUMERIC, ic.count_date
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.surplus_qty > 0
    UNION ALL
    -- Inventory count deficit (outflow)
    SELECT ici.article_id, 0::NUMERIC, ici.deficit_qty, ic.count_date
    FROM inventory_count_items ici JOIN inventory_counts ic ON ic.id = ici.inventory_count_id
    WHERE ic.company_id = p_company_id AND ic.warehouse_id = p_warehouse_id AND ic.status = 'posted' AND ici.deficit_qty > 0
    UNION ALL
    -- MMP outflow
    SELECT iti.article_id, 0::NUMERIC, iti.quantity, iwt.transfer_date
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.source_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    -- MMP inflow
    SELECT iti.article_id, iti.quantity, 0::NUMERIC, iwt.transfer_date
    FROM inter_warehouse_transfer_items iti JOIN inter_warehouse_transfers iwt ON iwt.id = iti.transfer_id
    WHERE iwt.company_id = p_company_id AND iwt.destination_warehouse_id = p_warehouse_id AND iwt.status = 'posted'
    UNION ALL
    -- Article swap: article_1 storno (outflow)
    SELECT asw.article_1_id, 0::NUMERIC, asw.quantity_1, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
    UNION ALL
    -- Article swap: article_2 (inflow)
    SELECT asw.article_2_id, asw.quantity_2, 0::NUMERIC, asw.swap_date
    FROM article_swaps asw WHERE asw.company_id = p_company_id AND asw.warehouse_id = p_warehouse_id AND asw.status = 'posted'
  )
  SELECT
    a.id AS article_id,
    a.code AS article_code,
    a.name AS article_name,
    a.unit,
    COALESCE(SUM(m.qty_in - m.qty_out) FILTER (WHERE p_date_from IS NOT NULL AND m.movement_date < p_date_from), 0) AS opening_qty,
    COALESCE(SUM(m.qty_in) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS in_qty,
    COALESCE(SUM(m.qty_out) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS out_qty,
    COALESCE(SUM(m.qty_in - m.qty_out) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS turnover_qty,
    COALESCE(SUM(m.qty_in - m.qty_out) FILTER (WHERE p_date_from IS NOT NULL AND m.movement_date < p_date_from), 0) +
    COALESCE(SUM(m.qty_in - m.qty_out) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) AS closing_qty
  FROM movements m
  JOIN articles a ON a.id = m.article_id
  GROUP BY a.id, a.code, a.name, a.unit
  HAVING
    COALESCE(SUM(m.qty_in - m.qty_out) FILTER (WHERE p_date_from IS NOT NULL AND m.movement_date < p_date_from), 0) != 0
    OR COALESCE(SUM(m.qty_in) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) != 0
    OR COALESCE(SUM(m.qty_out) FILTER (WHERE (p_date_from IS NULL OR m.movement_date >= p_date_from) AND (p_date_to IS NULL OR m.movement_date <= p_date_to)), 0) != 0
  ORDER BY a.code;
END;
$function$;

-- Update get_warehouse_turnover to include material requisitions
CREATE OR REPLACE FUNCTION public.get_warehouse_turnover(p_company_id uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(warehouse_id uuid, warehouse_code text, warehouse_name text, document_type text, debit_value numeric, credit_value numeric, balance_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH movements AS (
    -- Prijemnice (standalone)
    SELECT gr.warehouse_id, 'Prijemnica'::TEXT AS doc_type,
      SUM(gri.quantity * gri.unit_price) AS debit_val, 0::NUMERIC AS credit_val
    FROM goods_receipts gr
    JOIN goods_receipt_items gri ON gri.goods_receipt_id = gr.id AND gri.company_id = gr.company_id
    WHERE gr.company_id = p_company_id AND gr.status = 'posted' AND gr.linked_calculation_id IS NULL
      AND (p_date_from IS NULL OR gr.receipt_date >= p_date_from)
      AND (p_date_to IS NULL OR gr.receipt_date <= p_date_to)
    GROUP BY gr.warehouse_id

    UNION ALL

    -- Kalkulacije
    SELECT gr.warehouse_id, 'Kalkulacija'::TEXT,
      SUM(ci.selling_value), 0::NUMERIC
    FROM purchase_price_calculations ppc
    JOIN goods_receipts gr ON gr.id = ppc.goods_receipt_id
    JOIN calculation_items ci ON ci.calculation_id = ppc.id AND ci.company_id = ppc.company_id
    WHERE ppc.company_id = p_company_id AND ppc.status = 'posted'
      AND (p_date_from IS NULL OR ppc.calculation_date >= p_date_from)
      AND (p_date_to IS NULL OR ppc.calculation_date <= p_date_to)
    GROUP BY gr.warehouse_id

    UNION ALL

    -- Nivelacije
    SELECT pa.warehouse_id, 'Nivelacija'::TEXT,
      SUM(CASE WHEN pai.value_difference > 0 THEN pai.value_difference ELSE 0 END),
      SUM(CASE WHEN pai.value_difference < 0 THEN ABS(pai.value_difference) ELSE 0 END)
    FROM price_adjustments pa
    JOIN price_adjustment_items pai ON pai.price_adjustment_id = pa.id AND pai.company_id = pa.company_id
    WHERE pa.company_id = p_company_id AND pa.status = 'posted'
      AND (p_date_from IS NULL OR pa.adjustment_date >= p_date_from)
      AND (p_date_to IS NULL OR pa.adjustment_date <= p_date_to)
    GROUP BY pa.warehouse_id

    UNION ALL

    -- Popis - višak
    SELECT ic.warehouse_id, 'Popis - višak'::TEXT,
      SUM(ici.surplus_value), 0::NUMERIC
    FROM inventory_counts ic
    JOIN inventory_count_items ici ON ici.inventory_count_id = ic.id AND ici.company_id = ic.company_id
    WHERE ic.company_id = p_company_id AND ic.status = 'posted'
      AND (p_date_from IS NULL OR ic.count_date >= p_date_from)
      AND (p_date_to IS NULL OR ic.count_date <= p_date_to)
    GROUP BY ic.warehouse_id HAVING SUM(ici.surplus_value) > 0

    UNION ALL

    -- Popis - manjak
    SELECT ic.warehouse_id, 'Popis - manjak'::TEXT,
      0::NUMERIC, SUM(ici.deficit_value)
    FROM inventory_counts ic
    JOIN inventory_count_items ici ON ici.inventory_count_id = ic.id AND ici.company_id = ic.company_id
    WHERE ic.company_id = p_company_id AND ic.status = 'posted'
      AND (p_date_from IS NULL OR ic.count_date >= p_date_from)
      AND (p_date_to IS NULL OR ic.count_date <= p_date_to)
    GROUP BY ic.warehouse_id HAVING SUM(ici.deficit_value) > 0

    UNION ALL

    -- MMP - izlaz
    SELECT iwt.source_warehouse_id, 'MMP - izlaz'::TEXT,
      0::NUMERIC, SUM(iwti.quantity * iwti.unit_price)
    FROM inter_warehouse_transfers iwt
    JOIN inter_warehouse_transfer_items iwti ON iwti.transfer_id = iwt.id AND iwti.company_id = iwt.company_id
    WHERE iwt.company_id = p_company_id AND iwt.status = 'posted'
      AND (p_date_from IS NULL OR iwt.transfer_date >= p_date_from)
      AND (p_date_to IS NULL OR iwt.transfer_date <= p_date_to)
    GROUP BY iwt.source_warehouse_id

    UNION ALL

    -- MMP - ulaz
    SELECT iwt.destination_warehouse_id, 'MMP - ulaz'::TEXT,
      SUM(iwti.quantity * iwti.unit_price), 0::NUMERIC
    FROM inter_warehouse_transfers iwt
    JOIN inter_warehouse_transfer_items iwti ON iwti.transfer_id = iwt.id AND iwti.company_id = iwt.company_id
    WHERE iwt.company_id = p_company_id AND iwt.status = 'posted'
      AND (p_date_from IS NULL OR iwt.transfer_date >= p_date_from)
      AND (p_date_to IS NULL OR iwt.transfer_date <= p_date_to)
    GROUP BY iwt.destination_warehouse_id

    UNION ALL

    -- Zamena artikla
    SELECT asw.warehouse_id, 'Zamena artikla'::TEXT,
      SUM(asw.quantity_2 * asw.price_2), SUM(asw.quantity_1 * asw.price_1)
    FROM article_swaps asw
    WHERE asw.company_id = p_company_id AND asw.status = 'posted'
      AND (p_date_from IS NULL OR asw.swap_date >= p_date_from)
      AND (p_date_to IS NULL OR asw.swap_date <= p_date_to)
    GROUP BY asw.warehouse_id

    UNION ALL

    -- Otpremnice
    SELECT dn.warehouse_id, 'Otpremnica'::TEXT,
      0::NUMERIC, SUM(dni.quantity * COALESCE(a.selling_price, 0))
    FROM delivery_notes dn
    JOIN delivery_note_items dni ON dni.delivery_note_id = dn.id AND dni.company_id = dn.company_id
    LEFT JOIN articles a ON a.id = dni.article_id
    WHERE dn.company_id = p_company_id AND dn.status = 'posted' AND dn.warehouse_id IS NOT NULL
      AND (p_date_from IS NULL OR dn.delivery_date >= p_date_from)
      AND (p_date_to IS NULL OR dn.delivery_date <= p_date_to)
    GROUP BY dn.warehouse_id

    UNION ALL

    -- Trebovanja materijala (outflow)
    SELECT mr.warehouse_id, 'Trebovanje'::TEXT,
      0::NUMERIC, SUM(mri.item_value)
    FROM material_requisitions mr
    JOIN material_requisition_items mri ON mri.requisition_id = mr.id
    WHERE mr.company_id = p_company_id AND mr.status = 'posted'
      AND (p_date_from IS NULL OR mr.requisition_date >= p_date_from)
      AND (p_date_to IS NULL OR mr.requisition_date <= p_date_to)
    GROUP BY mr.warehouse_id
  )
  SELECT
    m.warehouse_id,
    w.code::TEXT AS warehouse_code,
    w.name::TEXT AS warehouse_name,
    m.doc_type AS document_type,
    COALESCE(SUM(m.debit_val), 0) AS debit_value,
    COALESCE(SUM(m.credit_val), 0) AS credit_value,
    COALESCE(SUM(m.debit_val), 0) - COALESCE(SUM(m.credit_val), 0) AS balance_value
  FROM movements m
  JOIN warehouses w ON w.id = m.warehouse_id
  GROUP BY m.warehouse_id, w.code, w.name, m.doc_type
  HAVING COALESCE(SUM(m.debit_val), 0) != 0 OR COALESCE(SUM(m.credit_val), 0) != 0
  ORDER BY w.code, m.doc_type;
END;
$function$;
