-- Ažuriraj funkciju za generisanje broja dokumenta sa 2-cifrenom godinom
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
  _year integer;
  _year_short text;
  _next_num integer;
  _prefix text;
BEGIN
  SELECT year INTO _year FROM business_years WHERE id = _year_id;
  
  -- Uzmi poslednje 2 cifre godine
  _year_short := RIGHT(_year::text, 2);
  
  CASE _doc_type
    WHEN 'quote' THEN _prefix := 'PON';
    WHEN 'invoice' THEN _prefix := 'FAK';
    WHEN 'delivery_note' THEN _prefix := 'OTP';
    ELSE _prefix := 'DOK';
  END CASE;
  
  CASE _doc_type
    WHEN 'quote' THEN
      SELECT COALESCE(MAX(
        NULLIF(regexp_replace(quote_number, '[^0-9]', '', 'g'), '')::integer
      ), 0) + 1 INTO _next_num
      FROM quotes
      WHERE company_id = _company_id AND business_year_id = _year_id;
    WHEN 'invoice' THEN
      SELECT COALESCE(MAX(
        NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '')::integer
      ), 0) + 1 INTO _next_num
      FROM invoices
      WHERE company_id = _company_id AND business_year_id = _year_id;
    WHEN 'delivery_note' THEN
      SELECT COALESCE(MAX(
        NULLIF(regexp_replace(delivery_number, '[^0-9]', '', 'g'), '')::integer
      ), 0) + 1 INTO _next_num
      FROM delivery_notes
      WHERE company_id = _company_id AND business_year_id = _year_id;
    ELSE
      _next_num := 1;
  END CASE;
  
  -- Format: PREFIX-YY-NNNN (npr. PON-26-0001)
  RETURN _prefix || '-' || _year_short || '-' || LPAD(_next_num::text, 4, '0');
END;
$$;