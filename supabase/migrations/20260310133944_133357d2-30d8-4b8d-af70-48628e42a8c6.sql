CREATE OR REPLACE FUNCTION get_next_purchase_invoice_number(
  _company_id uuid,
  _year_id uuid,
  _invoice_type text DEFAULT 'goods'
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  _year_val integer;
  _prefix text;
  _year_suffix text;
  _max_num integer;
  _next text;
BEGIN
  SELECT year INTO _year_val FROM business_years WHERE id = _year_id;
  _year_suffix := RIGHT(_year_val::text, 2);

  IF _invoice_type = 'goods' THEN
    _prefix := 'UFR-';
    -- Handle both old format (YYNNNN e.g. 260001) and new format (UFR-YYNNNN e.g. UFR-260001)
    SELECT COALESCE(MAX(
      CASE
        WHEN internal_number ~ ('^UFR-' || _year_suffix) THEN
          CAST(SUBSTRING(internal_number FROM length('UFR-' || _year_suffix) + 1) AS integer)
        WHEN internal_number ~ ('^' || _year_suffix || '[0-9]+$') THEN
          CAST(SUBSTRING(internal_number FROM 3) AS integer)
        ELSE 0
      END
    ), 0) INTO _max_num
    FROM goods_purchase_invoices WHERE company_id = _company_id AND business_year_id = _year_id;

  ELSIF _invoice_type = 'service' THEN
    _prefix := 'UFU-';
    SELECT COALESCE(MAX(
      CASE
        WHEN internal_number ~ ('^UFU-' || _year_suffix) THEN
          CAST(SUBSTRING(internal_number FROM length('UFU-' || _year_suffix) + 1) AS integer)
        WHEN internal_number ~ ('^' || _year_suffix || '[0-9]+$') THEN
          CAST(SUBSTRING(internal_number FROM 3) AS integer)
        ELSE 0
      END
    ), 0) INTO _max_num
    FROM service_purchase_invoices WHERE company_id = _company_id AND business_year_id = _year_id;

  ELSIF _invoice_type = 'advance' THEN
    _prefix := 'UFA-';
    SELECT COALESCE(MAX(
      CASE
        WHEN internal_number ~ ('^UFA-' || _year_suffix) THEN
          CAST(SUBSTRING(internal_number FROM length('UFA-' || _year_suffix) + 1) AS integer)
        WHEN internal_number ~ ('^' || _year_suffix || '[0-9]+$') THEN
          CAST(SUBSTRING(internal_number FROM 3) AS integer)
        ELSE 0
      END
    ), 0) INTO _max_num
    FROM advance_purchase_invoices WHERE company_id = _company_id AND business_year_id = _year_id;

  ELSIF _invoice_type = 'received_credit_note' THEN
    _prefix := 'PKO-';
    SELECT COALESCE(MAX(
      CASE
        WHEN internal_number ~ ('^PKO-' || _year_suffix) THEN
          CAST(SUBSTRING(internal_number FROM length('PKO-' || _year_suffix) + 1) AS integer)
        WHEN internal_number ~ ('^' || _year_suffix || '[0-9]+$') THEN
          CAST(SUBSTRING(internal_number FROM 3) AS integer)
        ELSE 0
      END
    ), 0) INTO _max_num
    FROM received_credit_notes WHERE company_id = _company_id AND business_year_id = _year_id;

  ELSE
    RAISE EXCEPTION 'Unknown invoice type: %', _invoice_type;
  END IF;

  _next := _prefix || _year_suffix || LPAD((_max_num + 1)::text, 4, '0');
  RETURN _next;
END;
$$;