
-- Add a unique partial index on source_invoice_id (only for non-null values)
-- This prevents creating multiple receipts from the same purchase invoice
CREATE UNIQUE INDEX IF NOT EXISTS idx_goods_receipts_source_invoice_unique
ON goods_receipts (source_invoice_id)
WHERE source_invoice_id IS NOT NULL;
