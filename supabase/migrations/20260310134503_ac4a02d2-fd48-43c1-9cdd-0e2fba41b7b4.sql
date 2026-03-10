CREATE OR REPLACE FUNCTION get_next_purchase_invoice_number(
  _company_id uuid,
  _year_id uuid,
  _invoice_type text DEFAULT 'goods'
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  _year_val integer;
  _year_suffix text;
  _max_num integer;
  _next text;
BEGIN
  SELECT year INTO _year_val FROM business_years WHERE id = _year_id;
  _year_suffix := RIGHT(_year_val::text, 2);

  IF _invoice_type = 'goods' THEN
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(internal_number FROM 3) AS integer)
    ), 0) INTO _max_num
    FROM goods_purchase_invoices 
    WHERE company_id = _company_id AND business_year_id = _year_id
      AND internal_number ~ ('^' || _year_suffix || '[0-9]+$');

  ELSIF _invoice_type = 'service' THEN
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(internal_number FROM 3) AS integer)
    ), 0) INTO _max_num
    FROM service_purchase_invoices 
    WHERE company_id = _company_id AND business_year_id = _year_id
      AND internal_number ~ ('^' || _year_suffix || '[0-9]+$');

  ELSIF _invoice_type = 'advance' THEN
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(internal_number FROM 3) AS integer)
    ), 0) INTO _max_num
    FROM advance_purchase_invoices 
    WHERE company_id = _company_id AND business_year_id = _year_id
      AND internal_number ~ ('^' || _year_suffix || '[0-9]+$');

  ELSIF _invoice_type = 'received_credit_note' THEN
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(internal_number FROM 3) AS integer)
    ), 0) INTO _max_num
    FROM received_credit_notes 
    WHERE company_id = _company_id AND business_year_id = _year_id
      AND internal_number ~ ('^' || _year_suffix || '[0-9]+$');

  ELSE
    RAISE EXCEPTION 'Unknown invoice type: %', _invoice_type;
  END IF;

  _next := _year_suffix || LPAD((_max_num + 1)::text, 4, '0');
  RETURN _next;
END;
$$;