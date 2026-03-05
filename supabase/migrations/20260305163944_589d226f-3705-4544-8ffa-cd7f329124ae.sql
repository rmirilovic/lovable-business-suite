
-- Bank Statements header history trigger
CREATE TRIGGER log_bank_statements_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_statements
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('bank_statement');

-- Bank Statement Items history trigger
CREATE TRIGGER log_bank_statement_items_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_statement_items
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('bank_statement_item');
