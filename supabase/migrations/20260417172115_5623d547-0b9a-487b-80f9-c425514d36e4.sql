-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Find earliest date where WAC mismatch exists for a warehouse
-- Returns NULL if no mismatch detected (within tolerance)
CREATE OR REPLACE FUNCTION public.wac_find_mismatch_date(
  _company_id uuid,
  _warehouse_id uuid,
  _tolerance numeric DEFAULT 0.01
)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_article_id uuid;
  v_first_mismatch date;
  v_earliest date := NULL;
BEGIN
  FOR v_article_id IN
    SELECT DISTINCT a.id
    FROM public.articles a
    WHERE a.company_id = _company_id
      AND a.is_active = true
  LOOP
    -- Compute running WAC and compare to recorded unit_cost on each outflow row
    WITH timeline AS (
      SELECT *
      FROM public.wac_get_movement_timeline(
        _company_id, _warehouse_id, v_article_id,
        '1900-01-01'::date, '2999-12-31'::date
      )
    ),
    running AS (
      SELECT
        movement_date,
        document_type,
        document_id,
        document_item_id,
        recorded_unit_cost,
        SUM(qty_in - qty_out) OVER w_running AS balance_qty,
        SUM(qty_in * recorded_unit_cost - qty_out * recorded_unit_cost) OVER w_running AS balance_value,
        qty_out,
        qty_in
      FROM timeline
      WINDOW w_running AS (
        ORDER BY movement_date, processing_order
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      )
    ),
    expected AS (
      SELECT
        movement_date,
        document_type,
        recorded_unit_cost,
        balance_qty,
        balance_value,
        qty_out,
        CASE 
          WHEN balance_qty - qty_in > 0 
          THEN (balance_value - qty_in * recorded_unit_cost) / NULLIF(balance_qty - qty_in, 0)
          ELSE recorded_unit_cost
        END AS expected_wac
      FROM running
      WHERE qty_out > 0
    )
    SELECT MIN(movement_date) INTO v_first_mismatch
    FROM expected
    WHERE ABS(recorded_unit_cost - expected_wac) > _tolerance;

    IF v_first_mismatch IS NOT NULL AND (v_earliest IS NULL OR v_first_mismatch < v_earliest) THEN
      v_earliest := v_first_mismatch;
    END IF;
  END LOOP;

  RETURN v_earliest;
END;
$$;

-- Nightly scan: iterate companies x warehouses, create draft runs for mismatches
CREATE OR REPLACE FUNCTION public.wac_nightly_integrity_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company record;
  v_warehouse record;
  v_mismatch_date date;
  v_admin_id uuid;
  v_run_id uuid;
  v_total_drafts int := 0;
  v_total_scanned int := 0;
  v_started timestamptz := now();
BEGIN
  FOR v_company IN
    SELECT id FROM public.companies WHERE is_active = true
  LOOP
    -- Find any super admin or local admin user as the system actor
    SELECT ur.user_id INTO v_admin_id
    FROM public.user_roles ur
    WHERE ur.role = 'super_admin'
    LIMIT 1;

    IF v_admin_id IS NULL THEN
      SELECT ur.user_id INTO v_admin_id
      FROM public.user_roles ur
      WHERE ur.role = 'local_admin'
      LIMIT 1;
    END IF;

    IF v_admin_id IS NULL THEN
      CONTINUE;
    END IF;

    FOR v_warehouse IN
      SELECT id FROM public.warehouses
      WHERE company_id = v_company.id AND is_active = true
    LOOP
      v_total_scanned := v_total_scanned + 1;

      -- Skip if there is already an open draft for this warehouse
      IF EXISTS (
        SELECT 1 FROM public.wac_reconciliation_runs
        WHERE company_id = v_company.id
          AND warehouse_id = v_warehouse.id
          AND status IN ('draft', 'previewed')
      ) THEN
        CONTINUE;
      END IF;

      v_mismatch_date := public.wac_find_mismatch_date(v_company.id, v_warehouse.id, 0.01);

      IF v_mismatch_date IS NOT NULL THEN
        INSERT INTO public.wac_reconciliation_runs (
          company_id, warehouse_id, reconcile_from_date,
          trigger_type, trigger_source_type,
          status, created_by, notes
        ) VALUES (
          v_company.id, v_warehouse.id, v_mismatch_date,
          'nightly_cron', 'integrity_scan',
          'draft', v_admin_id,
          format('Noćni integritetni check otkrio neslaganje cena od %s', v_mismatch_date)
        )
        RETURNING id INTO v_run_id;

        INSERT INTO public.wac_reconciliation_audit_log (
          run_id, company_id, action, performed_by, details
        ) VALUES (
          v_run_id, v_company.id, 'nightly_detected', v_admin_id,
          jsonb_build_object(
            'mismatch_date', v_mismatch_date,
            'warehouse_id', v_warehouse.id
          )
        );

        v_total_drafts := v_total_drafts + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'started_at', v_started,
    'finished_at', now(),
    'warehouses_scanned', v_total_scanned,
    'drafts_created', v_total_drafts
  );
END;
$$;

-- Schedule nightly at 02:30 UTC (server time)
DO $$
BEGIN
  -- Remove old schedule if exists
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'wac_nightly_integrity_check';
EXCEPTION WHEN OTHERS THEN
  NULL;
END$$;

SELECT cron.schedule(
  'wac_nightly_integrity_check',
  '30 2 * * *',
  $cron$ SELECT public.wac_nightly_integrity_check(); $cron$
);