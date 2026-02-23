
-- Create a function to recalculate quote totals from items
CREATE OR REPLACE FUNCTION public.recalculate_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_quote_id uuid;
  v_subtotal numeric;
  v_vat numeric;
  v_total numeric;
BEGIN
  -- Determine the quote_id from the affected row
  IF TG_OP = 'DELETE' THEN
    v_quote_id := OLD.quote_id;
  ELSE
    v_quote_id := NEW.quote_id;
  END IF;

  SELECT
    COALESCE(SUM(line_subtotal), 0),
    COALESCE(SUM(line_vat), 0),
    COALESCE(SUM(line_total), 0)
  INTO v_subtotal, v_vat, v_total
  FROM public.quote_items
  WHERE quote_id = v_quote_id;

  UPDATE public.quotes
  SET subtotal = v_subtotal,
      vat_amount = v_vat,
      total_amount = v_total
  WHERE id = v_quote_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger after insert/update/delete on quote_items
DROP TRIGGER IF EXISTS trg_recalculate_quote_totals ON public.quote_items;
CREATE TRIGGER trg_recalculate_quote_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_quote_totals();
