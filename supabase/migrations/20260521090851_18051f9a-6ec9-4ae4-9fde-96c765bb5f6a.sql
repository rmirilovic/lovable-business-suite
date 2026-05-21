ALTER TABLE public.journal_entry_items
  ADD COLUMN IF NOT EXISTS item_document_number TEXT,
  ADD COLUMN IF NOT EXISTS item_document_date DATE;

COMMENT ON COLUMN public.journal_entry_items.item_document_number IS 'Broj dokumenta na nivou stavke (za ručne naloge sa više dokumenata). Fallback na journal_entries.document_number.';
COMMENT ON COLUMN public.journal_entry_items.item_document_date IS 'Datum dokumenta na nivou stavke. Fallback na journal_entries.document_date / entry_date.';