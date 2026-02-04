-- Create function to get next goods receipt number
CREATE OR REPLACE FUNCTION get_next_goods_receipt_number(
  _company_id UUID,
  _year_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year_suffix TEXT;
  v_max_seq INTEGER;
  v_new_number TEXT;
BEGIN
  -- Get the 2-digit year suffix
  SELECT RIGHT(year::TEXT, 2) INTO v_year_suffix
  FROM business_years
  WHERE id = _year_id;

  -- Find the maximum sequence number for this year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(receipt_number FROM 'PRI-' || v_year_suffix || '-(\d+)') AS INTEGER
      )
    ),
    0
  ) INTO v_max_seq
  FROM goods_receipts
  WHERE company_id = _company_id
    AND business_year_id = _year_id
    AND receipt_number ~ ('^PRI-' || v_year_suffix || '-\d+$');

  -- Generate new number with zero-padded 4-digit sequence
  v_new_number := 'PRI-' || v_year_suffix || '-' || LPAD((v_max_seq + 1)::TEXT, 4, '0');
  
  RETURN v_new_number;
END;
$$;

-- Create function to post goods receipt (updates stock)
CREATE OR REPLACE FUNCTION post_goods_receipt(
  _receipt_id UUID,
  _user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt goods_receipts%ROWTYPE;
  v_item RECORD;
BEGIN
  -- Get receipt details
  SELECT * INTO v_receipt
  FROM goods_receipts
  WHERE id = _receipt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prijemnica nije pronađena';
  END IF;

  IF v_receipt.status = 'posted' THEN
    RAISE EXCEPTION 'Prijemnica je već proknjižena';
  END IF;

  -- Check if there are items
  IF NOT EXISTS (SELECT 1 FROM goods_receipt_items WHERE goods_receipt_id = _receipt_id) THEN
    RAISE EXCEPTION 'Prijemnica nema stavki';
  END IF;

  -- Update stock for each item
  FOR v_item IN 
    SELECT article_id, quantity 
    FROM goods_receipt_items 
    WHERE goods_receipt_id = _receipt_id
      AND article_id IS NOT NULL
  LOOP
    UPDATE articles
    SET stock = COALESCE(stock, 0) + v_item.quantity,
        updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  -- Update receipt status to posted
  UPDATE goods_receipts
  SET 
    status = 'posted',
    posted_at = now(),
    posted_by = _user_id,
    updated_at = now()
  WHERE id = _receipt_id;

  RETURN _receipt_id;
END;
$$;

-- Create function to unpost goods receipt (reverses stock changes)
CREATE OR REPLACE FUNCTION unpost_goods_receipt(
  _receipt_id UUID,
  _user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt goods_receipts%ROWTYPE;
  v_item RECORD;
BEGIN
  -- Get receipt details
  SELECT * INTO v_receipt
  FROM goods_receipts
  WHERE id = _receipt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prijemnica nije pronađena';
  END IF;

  IF v_receipt.status != 'posted' THEN
    RAISE EXCEPTION 'Samo proknjižene prijemnice mogu biti poništene';
  END IF;

  -- Cannot unpost if created from invoice
  IF v_receipt.source_invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'Prijemnica kreirana iz ulazne fakture se ne može poništiti ovde. Poništite fakturu.';
  END IF;

  -- Reverse stock for each item
  FOR v_item IN 
    SELECT article_id, quantity 
    FROM goods_receipt_items 
    WHERE goods_receipt_id = _receipt_id
      AND article_id IS NOT NULL
  LOOP
    UPDATE articles
    SET stock = COALESCE(stock, 0) - v_item.quantity,
        updated_at = now()
    WHERE id = v_item.article_id;
  END LOOP;

  -- Update receipt status to draft
  UPDATE goods_receipts
  SET 
    status = 'draft',
    posted_at = NULL,
    posted_by = NULL,
    updated_at = now()
  WHERE id = _receipt_id;

  RETURN _receipt_id;
END;
$$;

-- Add missing columns to goods_receipts if needed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'goods_receipts' AND column_name = 'posted_at') THEN
    ALTER TABLE public.goods_receipts ADD COLUMN posted_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'goods_receipts' AND column_name = 'posted_by') THEN
    ALTER TABLE public.goods_receipts ADD COLUMN posted_by UUID;
  END IF;
END;
$$;