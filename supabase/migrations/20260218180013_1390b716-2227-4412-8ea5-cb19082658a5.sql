
-- Create document_history table
CREATE TABLE public.document_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type TEXT NOT NULL,
  document_id UUID NOT NULL,
  record_id UUID NOT NULL,
  company_id UUID NOT NULL,
  changed_by UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL CHECK (change_type IN ('insert', 'update', 'delete')),
  old_data JSONB,
  new_data JSONB
);

-- Indexes for fast lookups
CREATE INDEX idx_document_history_lookup ON public.document_history (document_type, document_id, changed_at DESC);
CREATE INDEX idx_document_history_company ON public.document_history (company_id);

-- Enable RLS
ALTER TABLE public.document_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view document history for their companies"
  ON public.document_history FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()));

CREATE POLICY "System can insert document history"
  ON public.document_history FOR INSERT
  WITH CHECK (true);

-- Generic trigger function for all document tables
CREATE OR REPLACE FUNCTION public.log_document_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_document_type TEXT;
  v_document_id UUID;
  v_record_id UUID;
  v_company_id UUID;
  v_parent_column TEXT;
BEGIN
  v_document_type := TG_ARGV[0];
  v_parent_column := TG_ARGV[1]; -- NULL for header tables

  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_company_id := OLD.company_id;
    IF v_parent_column IS NOT NULL THEN
      v_document_id := (to_jsonb(OLD) ->> v_parent_column)::uuid;
    ELSE
      v_document_id := OLD.id;
    END IF;
    INSERT INTO document_history (document_type, document_id, record_id, company_id, changed_by, change_type, old_data)
    VALUES (v_document_type, v_document_id, v_record_id, v_company_id,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'delete', to_jsonb(OLD));
    RETURN OLD;

  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_company_id := NEW.company_id;
    IF v_parent_column IS NOT NULL THEN
      v_document_id := (to_jsonb(NEW) ->> v_parent_column)::uuid;
    ELSE
      v_document_id := NEW.id;
    END IF;
    INSERT INTO document_history (document_type, document_id, record_id, company_id, changed_by, change_type, new_data)
    VALUES (v_document_type, v_document_id, v_record_id, v_company_id,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'insert', to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;
    v_company_id := NEW.company_id;
    IF v_parent_column IS NOT NULL THEN
      v_document_id := (to_jsonb(NEW) ->> v_parent_column)::uuid;
    ELSE
      v_document_id := NEW.id;
    END IF;
    INSERT INTO document_history (document_type, document_id, record_id, company_id, changed_by, change_type, old_data, new_data)
    VALUES (v_document_type, v_document_id, v_record_id, v_company_id,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'update', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- =====================
-- HEADER TABLE TRIGGERS
-- =====================

-- Invoices (Fakture)
CREATE TRIGGER log_invoices_changes AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('invoice');

-- Quotes (Ponude)
CREATE TRIGGER log_quotes_changes AFTER INSERT OR UPDATE OR DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('quote');

-- Delivery Notes (Otpremnice)
CREATE TRIGGER log_delivery_notes_changes AFTER INSERT OR UPDATE OR DELETE ON public.delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('delivery_note');

-- Goods Receipts (Prijemnice)
CREATE TRIGGER log_goods_receipts_changes AFTER INSERT OR UPDATE OR DELETE ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('goods_receipt');

-- Purchase Price Calculations (Kalkulacije)
CREATE TRIGGER log_calculations_changes AFTER INSERT OR UPDATE OR DELETE ON public.purchase_price_calculations
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('calculation');

-- Goods Purchase Invoices (UFR)
CREATE TRIGGER log_goods_purchase_invoices_changes AFTER INSERT OR UPDATE OR DELETE ON public.goods_purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('goods_purchase_invoice');

-- Service Purchase Invoices (UFU)
CREATE TRIGGER log_service_purchase_invoices_changes AFTER INSERT OR UPDATE OR DELETE ON public.service_purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('service_purchase_invoice');

-- Material Requisitions (Trebovanja)
CREATE TRIGGER log_material_requisitions_changes AFTER INSERT OR UPDATE OR DELETE ON public.material_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('material_requisition');

-- Work Orders (Radni nalozi)
CREATE TRIGGER log_work_orders_changes AFTER INSERT OR UPDATE OR DELETE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('work_order');

-- Inventory Counts (Popisi)
CREATE TRIGGER log_inventory_counts_changes AFTER INSERT OR UPDATE OR DELETE ON public.inventory_counts
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('inventory_count');

-- Inter-Warehouse Transfers (MMP)
CREATE TRIGGER log_inter_warehouse_transfers_changes AFTER INSERT OR UPDATE OR DELETE ON public.inter_warehouse_transfers
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('inter_warehouse_transfer');

-- Price Adjustments (Nivelacije)
CREATE TRIGGER log_price_adjustments_changes AFTER INSERT OR UPDATE OR DELETE ON public.price_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('price_adjustment');

-- Article Swaps (Zamene artikala)
CREATE TRIGGER log_article_swaps_changes AFTER INSERT OR UPDATE OR DELETE ON public.article_swaps
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('article_swap');

-- Production Delivery Notes (Predajnice GP)
CREATE TRIGGER log_production_delivery_notes_changes AFTER INSERT OR UPDATE OR DELETE ON public.production_delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('production_delivery_note');

-- Purchase Invoices (Ulazne fakture - stare)
CREATE TRIGGER log_purchase_invoices_changes AFTER INSERT OR UPDATE OR DELETE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('purchase_invoice');

-- Journal Entries (Nalozi za knjiženje)
CREATE TRIGGER log_journal_entries_changes AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('journal_entry');

-- =====================
-- ITEM TABLE TRIGGERS
-- =====================

-- Invoice Items
CREATE TRIGGER log_invoice_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('invoice_item', 'invoice_id');

-- Quote Items
CREATE TRIGGER log_quote_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('quote_item', 'quote_id');

-- Delivery Note Items
CREATE TRIGGER log_delivery_note_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.delivery_note_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('delivery_note_item', 'delivery_note_id');

-- Goods Receipt Items
CREATE TRIGGER log_goods_receipt_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.goods_receipt_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('goods_receipt_item', 'goods_receipt_id');

-- Calculation Items
CREATE TRIGGER log_calculation_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.calculation_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('calculation_item', 'calculation_id');

-- Calculation Additional Costs
CREATE TRIGGER log_calculation_costs_changes AFTER INSERT OR UPDATE OR DELETE ON public.calculation_additional_costs
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('calculation_cost', 'calculation_id');

-- Goods Purchase Invoice Items
CREATE TRIGGER log_goods_purchase_invoice_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.goods_purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('goods_purchase_invoice_item', 'goods_purchase_invoice_id');

-- Service Purchase Invoice Items
CREATE TRIGGER log_service_purchase_invoice_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.service_purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('service_purchase_invoice_item', 'service_purchase_invoice_id');

-- Material Requisition Items
CREATE TRIGGER log_material_requisition_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.material_requisition_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('material_requisition_item', 'requisition_id');

-- Inventory Count Items
CREATE TRIGGER log_inventory_count_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.inventory_count_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('inventory_count_item', 'inventory_count_id');

-- Inter-Warehouse Transfer Items
CREATE TRIGGER log_inter_warehouse_transfer_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.inter_warehouse_transfer_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('inter_warehouse_transfer_item', 'transfer_id');

-- Price Adjustment Items
CREATE TRIGGER log_price_adjustment_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.price_adjustment_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('price_adjustment_item', 'price_adjustment_id');

-- Production Delivery Note Items
CREATE TRIGGER log_production_delivery_note_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.production_delivery_note_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('production_delivery_note_item', 'delivery_note_id');

-- Purchase Invoice Items (stare)
CREATE TRIGGER log_purchase_invoice_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('purchase_invoice_item', 'purchase_invoice_id');

-- Journal Entry Items
CREATE TRIGGER log_journal_entry_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('journal_entry_item', 'journal_entry_id');

-- Work Order Materials
CREATE TRIGGER log_work_order_materials_changes AFTER INSERT OR UPDATE OR DELETE ON public.work_order_materials
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('work_order_material', 'work_order_id');

-- Work Order Items (GP stavke)
CREATE TRIGGER log_work_order_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.work_order_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('work_order_item', 'work_order_id');
