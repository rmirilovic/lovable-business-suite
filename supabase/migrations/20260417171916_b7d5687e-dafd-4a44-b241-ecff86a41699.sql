-- Helper: postoji li već otvoren draft za isti magacin i datum (od)
CREATE OR REPLACE FUNCTION public.wac_has_open_draft(
  _company_id uuid,
  _warehouse_id uuid,
  _from_date date
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wac_reconciliation_runs
    WHERE company_id = _company_id
      AND warehouse_id = _warehouse_id
      AND reconcile_from_date <= _from_date
      AND status IN ('draft', 'previewed')
  );
$$;

-- Helper: postoje li izlazi posle tog datuma u istom magacinu
CREATE OR REPLACE FUNCTION public.wac_has_outflows_after(
  _company_id uuid,
  _warehouse_id uuid,
  _from_date date
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_notes
    WHERE company_id = _company_id AND warehouse_id = _warehouse_id
      AND status = 'posted' AND delivery_date >= _from_date
    UNION ALL
    SELECT 1 FROM public.material_requisitions
    WHERE company_id = _company_id AND warehouse_id = _warehouse_id
      AND status = 'posted' AND requisition_date >= _from_date
    UNION ALL
    SELECT 1 FROM public.inter_warehouse_transfers
    WHERE company_id = _company_id 
      AND (source_warehouse_id = _warehouse_id OR destination_warehouse_id = _warehouse_id)
      AND status = 'posted' AND transfer_date >= _from_date
    LIMIT 1
  );
$$;

-- Centralna trigger funkcija
CREATE OR REPLACE FUNCTION public.wac_auto_detect_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_warehouse_id uuid;
  v_doc_date date;
  v_source_type text;
  v_source_id uuid;
  v_run_id uuid;
  v_user_id uuid;
BEGIN
  -- Determine document type, warehouse and date based on source table
  IF TG_TABLE_NAME = 'goods_receipts' THEN
    v_company_id := NEW.company_id;
    v_warehouse_id := NEW.warehouse_id;
    v_doc_date := NEW.receipt_date;
    v_source_type := 'goods_receipt';
    v_source_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'purchase_price_calculations' THEN
    v_company_id := NEW.company_id;
    -- inherit warehouse from linked goods_receipt
    SELECT gr.warehouse_id INTO v_warehouse_id
    FROM public.goods_receipts gr
    WHERE gr.id = NEW.goods_receipt_id;
    v_doc_date := NEW.calculation_date;
    v_source_type := 'calculation';
    v_source_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'price_adjustments' THEN
    v_company_id := NEW.company_id;
    v_warehouse_id := NEW.warehouse_id;
    v_doc_date := NEW.adjustment_date;
    v_source_type := 'price_adjustment';
    v_source_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'customs_clearances' THEN
    v_company_id := NEW.company_id;
    v_warehouse_id := NEW.destination_warehouse_id;
    v_doc_date := NEW.clearance_date;
    v_source_type := 'customs_clearance';
    v_source_id := NEW.id;
  ELSE
    RETURN NEW;
  END IF;

  IF v_warehouse_id IS NULL OR v_doc_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only trigger when there are downstream outflows whose WAC could be affected
  IF NOT public.wac_has_outflows_after(v_company_id, v_warehouse_id, v_doc_date) THEN
    RETURN NEW;
  END IF;

  -- Avoid duplicate drafts
  IF public.wac_has_open_draft(v_company_id, v_warehouse_id, v_doc_date) THEN
    RETURN NEW;
  END IF;

  -- Pick best-effort user
  v_user_id := COALESCE(auth.uid(), NEW.posted_by, NEW.created_by);
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Create draft reconciliation run
  INSERT INTO public.wac_reconciliation_runs (
    company_id, warehouse_id, reconcile_from_date,
    trigger_type, trigger_source_type, trigger_source_id,
    status, created_by, notes
  ) VALUES (
    v_company_id, v_warehouse_id, v_doc_date,
    'auto', v_source_type, v_source_id,
    'draft', v_user_id,
    format('Automatski detektovan retroaktivni unos: %s od %s', v_source_type, v_doc_date)
  )
  RETURNING id INTO v_run_id;

  -- Audit log
  INSERT INTO public.wac_reconciliation_audit_log (
    run_id, company_id, action, performed_by, details
  ) VALUES (
    v_run_id, v_company_id, 'auto_detected', v_user_id,
    jsonb_build_object(
      'source_type', v_source_type,
      'source_id', v_source_id,
      'doc_date', v_doc_date,
      'warehouse_id', v_warehouse_id
    )
  );

  RETURN NEW;
END;
$$;

-- Trigger fires only when a document becomes 'posted' (INSERT as posted, or UPDATE to posted)
DROP TRIGGER IF EXISTS trg_wac_auto_goods_receipts ON public.goods_receipts;
CREATE TRIGGER trg_wac_auto_goods_receipts
AFTER INSERT OR UPDATE OF status, receipt_date ON public.goods_receipts
FOR EACH ROW
WHEN (NEW.status = 'posted')
EXECUTE FUNCTION public.wac_auto_detect_trigger();

DROP TRIGGER IF EXISTS trg_wac_auto_calculations ON public.purchase_price_calculations;
CREATE TRIGGER trg_wac_auto_calculations
AFTER INSERT OR UPDATE OF status, calculation_date ON public.purchase_price_calculations
FOR EACH ROW
WHEN (NEW.status = 'posted')
EXECUTE FUNCTION public.wac_auto_detect_trigger();

DROP TRIGGER IF EXISTS trg_wac_auto_price_adjustments ON public.price_adjustments;
CREATE TRIGGER trg_wac_auto_price_adjustments
AFTER INSERT OR UPDATE OF status, adjustment_date ON public.price_adjustments
FOR EACH ROW
WHEN (NEW.status = 'posted')
EXECUTE FUNCTION public.wac_auto_detect_trigger();

DROP TRIGGER IF EXISTS trg_wac_auto_customs_clearances ON public.customs_clearances;
CREATE TRIGGER trg_wac_auto_customs_clearances
AFTER INSERT OR UPDATE OF status, clearance_date ON public.customs_clearances
FOR EACH ROW
WHEN (NEW.status = 'posted')
EXECUTE FUNCTION public.wac_auto_detect_trigger();