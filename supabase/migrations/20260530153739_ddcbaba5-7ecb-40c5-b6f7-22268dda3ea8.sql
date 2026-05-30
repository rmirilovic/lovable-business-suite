CREATE OR REPLACE FUNCTION public.wac_recon_preview(_run_id uuid)
 RETURNS TABLE(affected_docs integer, total_diff numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid; _run record; _article_id uuid;
  _accum_qty numeric; _accum_value numeric; _wac numeric;
  _new_unit_cost numeric; _new_total_cost numeric; _old_total_cost numeric; _diff numeric;
  _doc_count integer := 0; _articles_count integer := 0;
  _total_diff numeric := 0; _proc_order integer := 0;
  _art_svk text;
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

  -- Ako je rekonsilijacija ograničena na jedan artikal, validiraj SVK
  IF _run.article_id IS NOT NULL THEN
    SELECT a.svk::text INTO _art_svk FROM public.articles a WHERE a.id = _run.article_id;
    IF _art_svk IN ('0','9') THEN
      RAISE EXCEPTION 'Artikal SVK=% se ne vodi po prosečnim cenama (PNC) i ne može biti predmet usklađivanja', _art_svk;
    END IF;
  END IF;

  DELETE FROM public.wac_reconciliation_changes WHERE run_id = _run_id;

  FOR art IN 
    SELECT DISTINCT article_id FROM (
      SELECT _run.article_id AS article_id WHERE _run.article_id IS NOT NULL
      UNION ALL
      SELECT DISTINCT a.id FROM public.articles a
      WHERE _run.article_id IS NULL AND a.company_id = _run.company_id
        AND COALESCE(a.svk::text, '1') NOT IN ('0','9')
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
END; $function$;