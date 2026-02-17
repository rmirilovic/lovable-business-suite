
CREATE OR REPLACE FUNCTION public.get_next_work_order_number(
  _company_id UUID,
  _year_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year INT;
  _max_seq INT;
  _next_seq INT;
  _yy TEXT;
BEGIN
  SELECT year INTO _year FROM business_years WHERE id = _year_id;
  _yy := LPAD(((_year % 100)::INT)::TEXT, 2, '0');
  
  SELECT COALESCE(MAX(SUBSTRING(order_number FROM 3)::INT), 0)
  INTO _max_seq
  FROM work_orders
  WHERE company_id = _company_id
    AND business_year_id = _year_id;
  
  _next_seq := _max_seq + 1;
  RETURN _yy || LPAD(_next_seq::TEXT, 4, '0');
END;
$$;
