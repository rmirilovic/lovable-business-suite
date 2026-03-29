CREATE TRIGGER trg_employee_deductions_history
AFTER INSERT OR UPDATE OR DELETE ON public.employee_deductions
FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('employee_deduction');