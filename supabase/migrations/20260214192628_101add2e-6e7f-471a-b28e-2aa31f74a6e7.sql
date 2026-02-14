-- Fix: inventory_counts FK to journal_entries needs ON DELETE SET NULL
ALTER TABLE inventory_counts
  DROP CONSTRAINT inventory_counts_journal_entry_id_fkey;

ALTER TABLE inventory_counts
  ADD CONSTRAINT inventory_counts_journal_entry_id_fkey
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE SET NULL;

-- Fix: price_adjustments FK to journal_entries needs ON DELETE SET NULL
ALTER TABLE price_adjustments
  DROP CONSTRAINT IF EXISTS price_adjustments_journal_entry_id_fkey;

ALTER TABLE price_adjustments
  ADD CONSTRAINT price_adjustments_journal_entry_id_fkey
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE SET NULL;

-- Fix: goods_purchase_invoices FK to journal_entries needs ON DELETE SET NULL
ALTER TABLE goods_purchase_invoices
  DROP CONSTRAINT IF EXISTS goods_purchase_invoices_journal_entry_id_fkey;

ALTER TABLE goods_purchase_invoices
  ADD CONSTRAINT goods_purchase_invoices_journal_entry_id_fkey
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE SET NULL;