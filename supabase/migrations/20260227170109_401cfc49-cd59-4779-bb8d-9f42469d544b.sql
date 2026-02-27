
CREATE OR REPLACE FUNCTION public.update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  _subtotal NUMERIC;
  _vat NUMERIC;
  _total NUMERIC;
  _invoice_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _invoice_id := OLD.invoice_id;
  ELSE
    _invoice_id := NEW.invoice_id;
  END IF;

  SELECT
    COALESCE(SUM(line_subtotal), 0),
    COALESCE(SUM(line_vat), 0),
    COALESCE(SUM(line_total), 0)
  INTO _subtotal, _vat, _total
  FROM public.invoice_items
  WHERE invoice_id = _invoice_id;

  UPDATE public.invoices
  SET subtotal = _subtotal,
      vat_amount = _vat,
      total_amount = _total
  WHERE id = _invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_update_invoice_totals ON public.invoice_items;

CREATE TRIGGER trg_update_invoice_totals
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.update_invoice_totals();
