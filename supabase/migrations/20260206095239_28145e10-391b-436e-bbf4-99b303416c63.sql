-- Function to get updated_at for any document (for optimistic locking)
CREATE OR REPLACE FUNCTION public.get_document_updated_at(
  _table_name TEXT,
  _document_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result TIMESTAMPTZ;
BEGIN
  EXECUTE format(
    'SELECT updated_at FROM %I WHERE id = $1',
    _table_name
  ) INTO result USING _document_id;
  
  RETURN result;
END;
$$;