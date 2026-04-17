-- ============================================================================
-- WAC Reconciliation Service - Phase 2.1 (FINAL with correct column names)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.wac_get_account_for_doc_type(_doc_type text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _doc_type
    WHEN 'delivery_note'                THEN '5010'
    WHEN 'material_requisition'         THEN '5110'
    WHEN 'inter_warehouse_transfer_out' THEN '1320'
    WHEN 'inter_warehouse_transfer_in'  THEN '1320'
    WHEN 'production_delivery_note'     THEN '1230'
    WHEN 'reprocessing_input'           THEN '5110'
    WHEN 'reprocessing_output'          THEN '1230'
    WHEN 'inventory_count'              THEN '5790'
    WHEN 'article_swap'                 THEN '5790'
    WHEN 'customs_clearance'            THEN '1320'
    WHEN 'goods_receipt'                THEN '1320'
    WHEN 'calculation'                  THEN '1320'
    WHEN 'price_adjustment'             THEN '1320'
    ELSE '1320'
  END;
$$;

CREATE OR REPLACE FUNCTION public.wac_get_movement_timeline(
  _company_id uuid, _warehouse_id uuid, _article_id uuid,
  _from_date date DEFAULT '1900-01-01'::date, _to_date date DEFAULT '2999-12-31'::date
)
RETURNS TABLE (
  movement_date date, movement_seq bigint, doc_type text,
  doc_id uuid, item_id uuid, doc_number text,
  qty_in numeric, qty_out numeric, unit_cost_in numeric,
  current_unit_cost numeric, is_posted boolean
) LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT gr.receipt_date::date, extract(epoch from gr.created_at)::bigint,
    'goods_receipt'::text, gr.id, gri.id, gr.receipt_number,
    gri.quantity::numeric, 0::numeric, gri.unit_price::numeric, gri.unit_price::numeric,
    (gr.status = 'posted')
  FROM public.goods_receipts gr
  JOIN public.goods_receipt_items gri ON gri.goods_receipt_id = gr.id
  WHERE gr.company_id = _company_id AND gr.warehouse_id = _warehouse_id
    AND gri.article_id = _article_id
    AND gr.receipt_date BETWEEN _from_date AND _to_date

  UNION ALL
  SELECT pc.calculation_date::date, extract(epoch from pc.created_at)::bigint + 1,
    'calculation'::text, pc.id, ci.id, pc.calculation_number,
    ci.quantity::numeric, 0::numeric, ci.cost_price::numeric, ci.cost_price::numeric,
    (pc.status = 'posted')
  FROM public.purchase_price_calculations pc
  JOIN public.calculation_items ci ON ci.calculation_id = pc.id
  JOIN public.goods_receipts gr ON gr.id = pc.goods_receipt_id
  WHERE pc.company_id = _company_id AND gr.warehouse_id = _warehouse_id
    AND ci.article_id = _article_id
    AND pc.calculation_date BETWEEN _from_date AND _to_date

  UNION ALL
  SELECT dn.delivery_date::date, extract(epoch from dn.created_at)::bigint,
    'delivery_note'::text, dn.id, dni.id, dn.delivery_number,
    0::numeric, dni.quantity::numeric, NULL::numeric, COALESCE(dni.unit_price, 0)::numeric,
    (dn.status = 'posted')
  FROM public.delivery_notes dn
  JOIN public.delivery_note_items dni ON dni.delivery_note_id = dn.id
  WHERE dn.company_id = _company_id AND dn.warehouse_id = _warehouse_id
    AND dni.article_id = _article_id
    AND dn.delivery_date BETWEEN _from_date AND _to_date

  UNION ALL
  SELECT mr.requisition_date::date, extract(epoch from mr.created_at)::bigint,
    'material_requisition'::text, mr.id, mri.id, mr.requisition_number,
    0::numeric, mri.quantity::numeric, NULL::numeric, COALESCE(mri.unit_price, 0)::numeric,
    (mr.status = 'posted')
  FROM public.material_requisitions mr
  JOIN public.material_requisition_items mri ON mri.requisition_id = mr.id
  WHERE mr.company_id = _company_id AND mr.warehouse_id = _warehouse_id
    AND mri.article_id = _article_id
    AND mr.requisition_date BETWEEN _from_date AND _to_date

  UNION ALL
  SELECT iwt.transfer_date::date, extract(epoch from iwt.created_at)::bigint,
    'inter_warehouse_transfer_out'::text, iwt.id, iwti.id, iwt.transfer_number,
    0::numeric, iwti.quantity::numeric, NULL::numeric, COALESCE(iwti.unit_price, 0)::numeric,
    (iwt.status = 'posted')
  FROM public.inter_warehouse_transfers iwt
  JOIN public.inter_warehouse_transfer_items iwti ON iwti.transfer_id = iwt.id
  WHERE iwt.company_id = _company_id AND iwt.source_warehouse_id = _warehouse_id
    AND iwti.article_id = _article_id
    AND iwt.transfer_date BETWEEN _from_date AND _to_date

  UNION ALL
  SELECT iwt.transfer_date::date, extract(epoch from iwt.created_at)::bigint + 1,
    'inter_warehouse_transfer_in'::text, iwt.id, iwti.id, iwt.transfer_number,
    iwti.quantity::numeric, 0::numeric, COALESCE(iwti.unit_price, 0)::numeric, COALESCE(iwti.unit_price, 0)::numeric,
    (iwt.status = 'posted')
  FROM public.inter_warehouse_transfers iwt
  JOIN public.inter_warehouse_transfer_items iwti ON iwti.transfer_id = iwt.id
  WHERE iwt.company_id = _company_id AND iwt.destination_warehouse_id = _warehouse_id
    AND iwti.article_id = _article_id
    AND iwt.transfer_date BETWEEN _from_date AND _to_date

  ORDER BY 1, 2, 4;
$$;

CREATE OR REPLACE FUNCTION public.wac_recon_detect(
  _company_id uuid, _warehouse_id uuid,
  _article_id uuid DEFAULT NULL, _from_date date DEFAULT NULL,
  _trigger_type public.wac_recon_trigger DEFAULT 'manual',
  _trigger_source_type text DEFAULT NULL, _trigger_source_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _run_id uuid; _by_id uuid; _from date;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Korisnik nije prijavljen'; END IF;
  IF NOT (public.has_role(_user_id, 'super_admin'::app_role) OR public.is_local_admin_for_company(_user_id, _company_id)) THEN
    RAISE EXCEPTION 'Nemate pravo da pokrenete WAC rekonsilijaciju';
  END IF;
  _from := COALESCE(_from_date, current_date - interval '30 days');
  SELECT id INTO _by_id FROM public.business_years
    WHERE company_id = _company_id AND year = extract(year from _from)::int LIMIT 1;
  INSERT INTO public.wac_reconciliation_runs (
    company_id, business_year_id, warehouse_id, article_id, reconcile_from_date,
    trigger_type, trigger_source_type, trigger_source_id, status, created_by, notes
  ) VALUES (_company_id, _by_id, _warehouse_id, _article_id, _from,
    _trigger_type, _trigger_source_type, _trigger_source_id, 'draft', _user_id, _notes)
  RETURNING id INTO _run_id;
  INSERT INTO public.wac_reconciliation_audit_log (run_id, company_id, action, performed_by, details)
  VALUES (_run_id, _company_id, 'created', _user_id,
    jsonb_build_object('warehouse_id', _warehouse_id, 'article_id', _article_id, 'from_date', _from, 'trigger', _trigger_type));
  RETURN _run_id;
END; $$;

CREATE OR REPLACE FUNCTION public.wac_recon_preview(_run_id uuid)
RETURNS TABLE (affected_docs integer, total_diff numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_id uuid; _run record; _article_id uuid;
  _accum_qty numeric; _accum_value numeric; _wac numeric;
  _new_unit_cost numeric; _new_total_cost numeric; _old_total_cost numeric; _diff numeric;
  _doc_count integer := 0; _articles_count integer := 0;
  _total_diff numeric := 0; _proc_order integer := 0;
  m record; art record;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Korisnik nije prijavljen'; END IF;
  SELECT * INTO _run FROM public.wac_reconciliation_runs WHERE id = _run_id;
  IF _run IS NULL THEN RAISE EXCEPTION 'Rekonsilijacija ne postoji'; END IF;
  IF NOT public.has_company_access(_user_id, _run.company_id) THEN
    RAISE EXCEPTION 'Nemate pristup ovoj firmi'; END IF;
  IF _run.status NOT IN ('draft', 'previewed', 'failed') THEN
    RAISE EXCEPTION 'Rekonsilijacija ne može biti pregledana u statusu (%)', _run.status; END IF;

  DELETE FROM public.wac_reconciliation_changes WHERE run_id = _run_id;

  FOR art IN 
    SELECT DISTINCT article_id FROM (
      SELECT _run.article_id AS article_id WHERE _run.article_id IS NOT NULL
      UNION ALL
      SELECT DISTINCT a.id FROM public.articles a
      WHERE _run.article_id IS NULL AND a.company_id = _run.company_id
        AND EXISTS (SELECT 1 FROM public.wac_get_movement_timeline(_run.company_id, _run.warehouse_id, a.id, _run.reconcile_from_date))
    ) sub
  LOOP
    _article_id := art.article_id;
    _articles_count := _articles_count + 1;

    SELECT 
      COALESCE(SUM(qty_in - qty_out), 0),
      COALESCE(SUM(qty_in * COALESCE(unit_cost_in, 0)) - SUM(qty_out * current_unit_cost), 0)
    INTO _accum_qty, _accum_value
    FROM public.wac_get_movement_timeline(_run.company_id, _run.warehouse_id, _article_id, '1900-01-01'::date, _run.reconcile_from_date - 1);

    _wac := CASE WHEN _accum_qty > 0 THEN _accum_value / _accum_qty ELSE 0 END;

    FOR m IN SELECT * FROM public.wac_get_movement_timeline(_run.company_id, _run.warehouse_id, _article_id, _run.reconcile_from_date) LOOP
      IF m.qty_in > 0 THEN
        _accum_value := _accum_value + (m.qty_in * COALESCE(m.unit_cost_in, 0));
        _accum_qty := _accum_qty + m.qty_in;
        _wac := CASE WHEN _accum_qty > 0 THEN _accum_value / _accum_qty ELSE 0 END;
      ELSIF m.qty_out > 0 THEN
        _new_unit_cost := _wac;
        _new_total_cost := round(_new_unit_cost * m.qty_out, 4);
        _old_total_cost := round(m.current_unit_cost * m.qty_out, 4);
        _diff := _new_total_cost - _old_total_cost;

        IF abs(_diff) >= 0.01 OR abs(m.current_unit_cost - _new_unit_cost) >= 0.000001 THEN
          _proc_order := _proc_order + 1;
          _doc_count := _doc_count + 1;
          _total_diff := _total_diff + _diff;
          INSERT INTO public.wac_reconciliation_changes (
            run_id, company_id, document_type, document_id, document_item_id,
            document_number, document_date, warehouse_id, article_id,
            quantity, old_unit_cost, new_unit_cost, old_total_cost, new_total_cost,
            cost_difference, account_code, processing_order
          ) VALUES (
            _run_id, _run.company_id, m.doc_type, m.doc_id, m.item_id,
            m.doc_number, m.movement_date, _run.warehouse_id, _article_id,
            m.qty_out, m.current_unit_cost, _new_unit_cost, _old_total_cost, _new_total_cost,
            _diff, public.wac_get_account_for_doc_type(m.doc_type), _proc_order
          );
        END IF;

        _accum_value := _accum_value - (m.qty_out * _wac);
        _accum_qty := _accum_qty - m.qty_out;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.wac_reconciliation_runs
  SET status = 'previewed', affected_documents_count = _doc_count,
      affected_articles_count = _articles_count, total_value_difference = _total_diff,
      previewed_at = now(), previewed_by = _user_id
  WHERE id = _run_id;

  INSERT INTO public.wac_reconciliation_audit_log (run_id, company_id, action, performed_by, details)
  VALUES (_run_id, _run.company_id, 'previewed', _user_id,
    jsonb_build_object('docs', _doc_count, 'articles', _articles_count, 'total_diff', _total_diff));

  RETURN QUERY SELECT _doc_count, _total_diff;
END; $$;

CREATE OR REPLACE FUNCTION public.wac_recon_apply(
  _run_id uuid, _override_pdv boolean DEFAULT false, _override_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_id uuid; _run record; _je_id uuid; _je_number text;
  _by_id uuid; _is_year_closed boolean; c record; acc record;
  _item_order integer := 0;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Korisnik nije prijavljen'; END IF;
  SELECT * INTO _run FROM public.wac_reconciliation_runs WHERE id = _run_id FOR UPDATE;
  IF _run IS NULL THEN RAISE EXCEPTION 'Rekonsilijacija ne postoji'; END IF;
  IF NOT (public.has_role(_user_id, 'super_admin'::app_role) OR public.is_local_admin_for_company(_user_id, _run.company_id)) THEN
    RAISE EXCEPTION 'Samo lokalni admin ili super admin može da primeni rekonsilijaciju'; END IF;
  IF _run.status <> 'previewed' THEN
    RAISE EXCEPTION 'Rekonsilijacija mora biti u statusu "previewed", trenutno: %', _run.status; END IF;

  SELECT is_closed INTO _is_year_closed FROM public.business_years
  WHERE company_id = _run.company_id AND year = extract(year from _run.reconcile_from_date)::int;
  IF _is_year_closed AND NOT _override_pdv THEN
    RAISE EXCEPTION 'Poslovna godina je zaključana. Potreban je override.'; END IF;

  SELECT id INTO _by_id FROM public.business_years
  WHERE company_id = _run.company_id AND is_active = true LIMIT 1;
  IF _by_id IS NULL THEN RAISE EXCEPTION 'Nije pronađena aktivna poslovna godina'; END IF;

  SELECT public.get_next_journal_entry_number(_run.company_id, _by_id) INTO _je_number;

  INSERT INTO public.journal_entries (
    company_id, business_year_id, entry_number, entry_date,
    description, status, created_by, source_document_type, source_document_id
  ) VALUES (
    _run.company_id, _by_id, _je_number, current_date,
    'WAC rekonsilijacija ' || _run_id::text || ' (od ' || _run.reconcile_from_date::text || ')',
    'draft', _user_id, 'wac_reconciliation', _run_id
  ) RETURNING id INTO _je_id;

  FOR acc IN 
    SELECT account_code, SUM(cost_difference) AS total_diff
    FROM public.wac_reconciliation_changes
    WHERE run_id = _run_id GROUP BY account_code
    HAVING abs(SUM(cost_difference)) >= 0.01
  LOOP
    _item_order := _item_order + 1;
    INSERT INTO public.journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount
    ) VALUES (
      _je_id, _run.company_id, acc.account_code, _item_order, 'WAC ispravka',
      CASE WHEN acc.total_diff > 0 THEN acc.total_diff ELSE 0 END,
      CASE WHEN acc.total_diff < 0 THEN -acc.total_diff ELSE 0 END
    );
  END LOOP;

  IF _run.total_value_difference IS NOT NULL AND abs(_run.total_value_difference) >= 0.01 THEN
    _item_order := _item_order + 1;
    INSERT INTO public.journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount
    ) VALUES (
      _je_id, _run.company_id, '1320', _item_order, 'WAC ispravka — roba u magacinu',
      CASE WHEN _run.total_value_difference < 0 THEN -_run.total_value_difference ELSE 0 END,
      CASE WHEN _run.total_value_difference > 0 THEN _run.total_value_difference ELSE 0 END
    );
  END IF;

  UPDATE public.journal_entries je
  SET total_debit = (SELECT COALESCE(SUM(debit_amount), 0) FROM public.journal_entry_items WHERE journal_entry_id = _je_id),
      total_credit = (SELECT COALESCE(SUM(credit_amount), 0) FROM public.journal_entry_items WHERE journal_entry_id = _je_id)
  WHERE je.id = _je_id;

  FOR c IN SELECT * FROM public.wac_reconciliation_changes WHERE run_id = _run_id ORDER BY processing_order LOOP
    BEGIN
      IF c.document_type = 'delivery_note' THEN
        UPDATE public.delivery_note_items 
        SET unit_price = c.new_unit_cost, line_value = c.new_total_cost
        WHERE id = c.document_item_id;
      ELSIF c.document_type = 'material_requisition' THEN
        UPDATE public.material_requisition_items 
        SET unit_price = c.new_unit_cost, item_value = c.new_total_cost
        WHERE id = c.document_item_id;
      ELSIF c.document_type IN ('inter_warehouse_transfer_out', 'inter_warehouse_transfer_in') THEN
        UPDATE public.inter_warehouse_transfer_items 
        SET unit_price = c.new_unit_cost
        WHERE id = c.document_item_id;
      END IF;
      UPDATE public.wac_reconciliation_changes SET applied = true, applied_at = now() WHERE id = c.id;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.wac_reconciliation_audit_log (run_id, company_id, action, performed_by, details)
      VALUES (_run_id, _run.company_id, 'apply_item_failed', _user_id,
        jsonb_build_object('change_id', c.id, 'doc_type', c.document_type, 'error', SQLERRM));
    END;
  END LOOP;

  UPDATE public.wac_reconciliation_runs
  SET status = 'applied', applied_at = now(), applied_by = _user_id,
      correction_journal_entry_id = _je_id,
      override_pdv_period = _override_pdv, override_reason = _override_reason
  WHERE id = _run_id;

  INSERT INTO public.wac_reconciliation_audit_log (run_id, company_id, action, performed_by, details)
  VALUES (_run_id, _run.company_id, 'applied', _user_id,
    jsonb_build_object('journal_entry_id', _je_id, 'override_pdv', _override_pdv, 'reason', _override_reason));

  RETURN _je_id;
END; $$;

CREATE OR REPLACE FUNCTION public.wac_recon_revert(
  _run_id uuid, _reason text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _run record; c record; _je_status text;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Korisnik nije prijavljen'; END IF;
  SELECT * INTO _run FROM public.wac_reconciliation_runs WHERE id = _run_id FOR UPDATE;
  IF _run IS NULL THEN RAISE EXCEPTION 'Rekonsilijacija ne postoji'; END IF;
  IF NOT (public.has_role(_user_id, 'super_admin'::app_role) OR public.is_local_admin_for_company(_user_id, _run.company_id)) THEN
    RAISE EXCEPTION 'Nemate pravo da stornirate rekonsilijaciju'; END IF;
  IF _run.status <> 'applied' THEN
    RAISE EXCEPTION 'Može se stornirati samo primenjena rekonsilijacija'; END IF;

  FOR c IN SELECT * FROM public.wac_reconciliation_changes WHERE run_id = _run_id AND applied = true LOOP
    BEGIN
      IF c.document_type = 'delivery_note' THEN
        UPDATE public.delivery_note_items SET unit_price = c.old_unit_cost, line_value = c.old_total_cost WHERE id = c.document_item_id;
      ELSIF c.document_type = 'material_requisition' THEN
        UPDATE public.material_requisition_items SET unit_price = c.old_unit_cost, item_value = c.old_total_cost WHERE id = c.document_item_id;
      ELSIF c.document_type IN ('inter_warehouse_transfer_out', 'inter_warehouse_transfer_in') THEN
        UPDATE public.inter_warehouse_transfer_items SET unit_price = c.old_unit_cost WHERE id = c.document_item_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;

  IF _run.correction_journal_entry_id IS NOT NULL THEN
    SELECT status INTO _je_status FROM public.journal_entries WHERE id = _run.correction_journal_entry_id;
    IF _je_status = 'draft' THEN
      DELETE FROM public.journal_entries WHERE id = _run.correction_journal_entry_id;
    ELSE
      UPDATE public.journal_entries SET status = 'cancelled' WHERE id = _run.correction_journal_entry_id;
    END IF;
  END IF;

  UPDATE public.wac_reconciliation_runs
  SET status = 'reverted', reverted_at = now(), reverted_by = _user_id,
      notes = COALESCE(notes || E'\n', '') || 'STORNO: ' || COALESCE(_reason, '(bez razloga)')
  WHERE id = _run_id;

  INSERT INTO public.wac_reconciliation_audit_log (run_id, company_id, action, performed_by, details)
  VALUES (_run_id, _run.company_id, 'reverted', _user_id, jsonb_build_object('reason', _reason));

  RETURN true;
END; $$;