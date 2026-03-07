CREATE OR REPLACE FUNCTION public.get_next_document_number(
  _company_id uuid,
  _year_id uuid,
  _doc_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year_short text;
  _next_num integer;
BEGIN
  SELECT RIGHT(year::text, 2) INTO _year_short FROM business_years WHERE id = _year_id;

  CASE _doc_type
    WHEN 'quote' THEN
      SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
      FROM (
        SELECT CAST(SUBSTRING(quote_number FROM '(\d{4})$') AS INTEGER) as seq
        FROM quotes
        WHERE company_id = _company_id AND business_year_id = _year_id
          AND (
            quote_number ~ ('^' || _year_short || '\d{4}$')
            OR quote_number ~ ('^[A-Z]+-' || _year_short || '-\d{4}$')
          )
      ) t;

    WHEN 'invoice' THEN
      SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
      FROM (
        SELECT CAST(SUBSTRING(invoice_number FROM '(\d{4})$') AS INTEGER) as seq
        FROM invoices
        WHERE company_id = _company_id AND business_year_id = _year_id
          AND (
            invoice_number ~ ('^' || _year_short || '\d{4}$')
            OR invoice_number ~ ('^[A-Z]+-' || _year_short || '-\d{4}$')
          )
      ) t;

    WHEN 'delivery_note' THEN
      SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
      FROM (
        SELECT CAST(SUBSTRING(delivery_number FROM '(\d{4})$') AS INTEGER) as seq
        FROM delivery_notes
        WHERE company_id = _company_id AND business_year_id = _year_id
          AND (
            delivery_number ~ ('^' || _year_short || '\d{4}$')
            OR delivery_number ~ ('^[A-Z]+-' || _year_short || '-\d{4}$')
          )
      ) t;

    WHEN 'advance_invoice' THEN
      SELECT COALESCE(MAX(seq), 0) + 1 INTO _next_num
      FROM (
        SELECT CAST(SUBSTRING(advance_number FROM '(\d{4})$') AS INTEGER) as seq
        FROM advance_invoices
        WHERE company_id = _company_id AND business_year_id = _year_id
          AND (
            advance_number ~ ('^' || _year_short || '\d{4}$')
            OR advance_number ~ ('^[A-Z]+-' || _year_short || '-\d{4}$')
          )
      ) t;

    ELSE
      _next_num := 1;
  END CASE;

  RETURN _year_short || LPAD(_next_num::text, 4, '0');
END;
$$;