
-- Reprocessing Work Orders - header
CREATE TRIGGER log_reprocessing_work_orders_changes
  AFTER INSERT OR UPDATE OR DELETE ON reprocessing_work_orders
  FOR EACH ROW
  EXECUTE FUNCTION log_document_changes('reprocessing_work_order');

-- Reprocessing WO Output Items
CREATE TRIGGER log_reprocessing_wo_output_items_changes
  AFTER INSERT OR UPDATE OR DELETE ON reprocessing_wo_output_items
  FOR EACH ROW
  EXECUTE FUNCTION log_document_changes('reprocessing_work_order_item', 'work_order_id');

-- Reprocessing WO Input Items
CREATE TRIGGER log_reprocessing_wo_input_items_changes
  AFTER INSERT OR UPDATE OR DELETE ON reprocessing_wo_input_items
  FOR EACH ROW
  EXECUTE FUNCTION log_document_changes('reprocessing_work_order_item', 'work_order_id');

-- Reprocessing WO Materials
CREATE TRIGGER log_reprocessing_wo_materials_changes
  AFTER INSERT OR UPDATE OR DELETE ON reprocessing_wo_materials
  FOR EACH ROW
  EXECUTE FUNCTION log_document_changes('reprocessing_work_order_material', 'work_order_id');

-- Reprocessing Delivery Notes - header
CREATE TRIGGER log_reprocessing_delivery_notes_changes
  AFTER INSERT OR UPDATE OR DELETE ON reprocessing_delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION log_document_changes('reprocessing_delivery_note');

-- Reprocessing Delivery Note Items
CREATE TRIGGER log_reprocessing_delivery_note_items_changes
  AFTER INSERT OR UPDATE OR DELETE ON reprocessing_delivery_note_items
  FOR EACH ROW
  EXECUTE FUNCTION log_document_changes('reprocessing_delivery_note_item', 'delivery_note_id');
