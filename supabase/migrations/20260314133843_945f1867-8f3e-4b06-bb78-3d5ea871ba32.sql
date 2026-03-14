
CREATE TRIGGER log_incoming_mail_changes AFTER INSERT OR UPDATE OR DELETE ON public.incoming_mail
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('incoming_mail');
