-- Add history trigger for employees table
CREATE TRIGGER log_employees_changes AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('employee');