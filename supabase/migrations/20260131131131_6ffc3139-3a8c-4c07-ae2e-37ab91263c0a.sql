-- Update function to use UFU and UFR prefixes
CREATE OR REPLACE FUNCTION public.get_next_purchase_invoice_number(_company_id uuid, _year_id uuid, _invoice_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _year integer;
  _year_short text;
  _next_num integer;
  _prefix text;
BEGIN
  SELECT year INTO _year FROM business_years WHERE id = _year_id;
  _year_short := RIGHT(_year::text, 2);
  
  CASE _invoice_type
    WHEN 'service' THEN 
      _prefix := 'UFU';
      SELECT COALESCE(MAX(
        NULLIF(regexp_replace(internal_number, '[^0-9]', '', 'g'), '')::integer
      ), 0) + 1 INTO _next_num
      FROM service_purchase_invoices
      WHERE company_id = _company_id AND business_year_id = _year_id;
    WHEN 'goods' THEN 
      _prefix := 'UFR';
      SELECT COALESCE(MAX(
        NULLIF(regexp_replace(internal_number, '[^0-9]', '', 'g'), '')::integer
      ), 0) + 1 INTO _next_num
      FROM goods_purchase_invoices
      WHERE company_id = _company_id AND business_year_id = _year_id;
    ELSE
      _prefix := 'UF';
      _next_num := 1;
  END CASE;
  
  RETURN _prefix || '-' || _year_short || '-' || LPAD(_next_num::text, 4, '0');
END;
$$;