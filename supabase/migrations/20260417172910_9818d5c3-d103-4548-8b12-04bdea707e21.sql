-- Proširenje auto-detect trigera na popise, MMP i predajnice (GP i RPR)

CREATE OR REPLACE FUNCTION public.wac_auto_detect_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_warehouse_id uuid;
  v_doc_date date;
  v_source_type text;
  v_source_id uuid;
  v_run_id uuid;
  v_user_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'goods_receipts' THEN
    v_company_id := NEW.company_id;
    v_warehouse_id := NEW.warehouse_id;
    v_doc_date := NEW.receipt_date;
    v_source_type := 'goods_receipt';
    v_source_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'purchase_price_calculations' THEN
    v_company_id := NEW.company_id;
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
  ELSIF TG_TABLE_NAME = 'inventory_counts' THEN
    v_company_id := NEW.company_id;
    v_warehouse_id := NEW.warehouse_id;
    v_doc_date := NEW.count_date;
    v_source_type := 'inventory_count';
    v_source_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'inter_warehouse_transfers' THEN
    -- Prati destinacijski magacin (tu se mijenja PNC za nove ulaze)
    v_company_id := NEW.company_id;
    v_warehouse_id := NEW.destination_warehouse_id;
    v_doc_date := NEW.transfer_date;
    v_source_type := 'inter_warehouse_transfer_in';
    v_source_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'production_delivery_notes' THEN
    v_company_id := NEW.company_id;
    v_warehouse_id := NEW.warehouse_id;
    v_doc_date := NEW.delivery_date;
    v_source_type := 'production_delivery_note';
    v_source_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'reprocessing_delivery_notes' THEN
    v_company_id := NEW.company_id;
    v_warehouse_id := NEW.warehouse_id;
    v_doc_date := NEW.delivery_date::date;
    v_source_type := 'reprocessing_delivery_note';
    v_source_id := NEW.id;
  ELSE
    RETURN NEW;
  END IF;

  IF v_warehouse_id IS NULL OR v_doc_date IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.wac_has_outflows_after(v_company_id, v_warehouse_id, v_doc_date) THEN
    RETURN NEW;
  END IF;

  IF public.wac_has_open_draft(v_company_id, v_warehouse_id, v_doc_date) THEN
    RETURN NEW;
  END IF;

  v_user_id := COALESCE(auth.uid(), NEW.posted_by, NEW.created_by);
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

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

  INSERT INTO public.wac_reconciliation_audit_log (
    run_id, company_id, action, action_by, details
  ) VALUES (
    v_run_id, v_company_id, 'auto_detected', v_user_id,
    jsonb_build_object(
      'source_type', v_source_type,
      'source_id', v_source_id,
      'warehouse_id', v_warehouse_id,
      'from_date', v_doc_date
    )
  );

  RETURN NEW;
END;
$function$;

-- Triger za popise
DROP TRIGGER IF EXISTS wac_auto_detect_inventory_counts ON public.inventory_counts;
CREATE TRIGGER wac_auto_detect_inventory_counts
  AFTER UPDATE OF status ON public.inventory_counts
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'posted')
  EXECUTE FUNCTION public.wac_auto_detect_trigger();

-- Triger za MMP (prati destinacijski magacin)
DROP TRIGGER IF EXISTS wac_auto_detect_inter_warehouse_transfers ON public.inter_warehouse_transfers;
CREATE TRIGGER wac_auto_detect_inter_warehouse_transfers
  AFTER UPDATE OF status ON public.inter_warehouse_transfers
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'posted')
  EXECUTE FUNCTION public.wac_auto_detect_trigger();

-- Triger za predajnice gotovih proizvoda
DROP TRIGGER IF EXISTS wac_auto_detect_production_delivery_notes ON public.production_delivery_notes;
CREATE TRIGGER wac_auto_detect_production_delivery_notes
  AFTER UPDATE OF status ON public.production_delivery_notes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'posted')
  EXECUTE FUNCTION public.wac_auto_detect_trigger();

-- Triger za predajnice iz prerade
DROP TRIGGER IF EXISTS wac_auto_detect_reprocessing_delivery_notes ON public.reprocessing_delivery_notes;
CREATE TRIGGER wac_auto_detect_reprocessing_delivery_notes
  AFTER UPDATE OF status ON public.reprocessing_delivery_notes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'posted')
  EXECUTE FUNCTION public.wac_auto_detect_trigger();