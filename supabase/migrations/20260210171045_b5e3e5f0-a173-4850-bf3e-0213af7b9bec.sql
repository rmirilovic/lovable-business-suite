
-- Update get_next_calculation_number to use YYNNNN format (no KAL prefix)
CREATE OR REPLACE FUNCTION public.get_next_calculation_number(_company_id UUID, _year_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year INT;
  _next_num INT;
  _result TEXT;
  _year_suffix TEXT;
BEGIN
  SELECT year INTO _year FROM business_years WHERE id = _year_id;
  _year_suffix := RIGHT(_year::TEXT, 2);
  
  -- Support both old KAL-YY-NNNN and new YYNNNN formats
  SELECT COALESCE(MAX(
    CASE 
      WHEN calculation_number ~ '^KAL-\d{2}-\d+$' THEN
        CAST(SUBSTRING(calculation_number FROM 'KAL-\d{2}-(\d+)') AS INT)
      WHEN calculation_number ~ ('^\d{2}\d+$') THEN
        CAST(SUBSTRING(calculation_number FROM '^\d{2}(\d+)$') AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO _next_num
  FROM purchase_price_calculations
  WHERE company_id = _company_id AND business_year_id = _year_id;
  
  _result := _year_suffix || LPAD(_next_num::TEXT, 4, '0');
  RETURN _result;
END;
$$;
