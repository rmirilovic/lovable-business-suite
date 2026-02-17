
CREATE OR REPLACE FUNCTION public.get_next_requisition_number(_company_id uuid, _year_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_prefix text;
  v_max_num int;
  v_next text;
BEGIN
  SELECT year INTO v_year FROM business_years WHERE id = _year_id;
  v_prefix := right(v_year::text, 2);

  SELECT COALESCE(MAX(right(requisition_number, 4)::int), 0)
    INTO v_max_num
    FROM material_requisitions
   WHERE company_id = _company_id
     AND business_year_id = _year_id;

  v_next := v_prefix || lpad((v_max_num + 1)::text, 4, '0');
  RETURN v_next;
END;
$$;
