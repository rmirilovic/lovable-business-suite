-- Fix post_bank_statement to calculate closing_balance
CREATE OR REPLACE FUNCTION public.post_bank_statement(_statement_id UUID, _user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc RECORD;
  _je_id UUID;
  _je_number TEXT;
  _item RECORD;
  _item_idx INT := 0;
  _total_debit NUMERIC(18,2) := 0;
  _total_credit NUMERIC(18,2) := 0;
  _ba_code TEXT;
BEGIN
  SELECT bs.*, ba.code AS ba_code, ba.account_number AS ba_account_number
  INTO _doc
  FROM bank_statements bs
  JOIN bank_accounts ba ON ba.id = bs.bank_account_id
  WHERE bs.id = _statement_id;
  
  IF _doc.id IS NULL THEN
    RAISE EXCEPTION 'Izvod nije pronađen';
  END IF;
  
  IF _doc.status != 'draft' THEN
    RAISE EXCEPTION 'Izvod je već proknjižen';
  END IF;
  
  _ba_code := _doc.ba_code;
  _je_number := 'IB' || _doc.statement_number;
  
  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    description, status, total_debit, total_credit, created_by,
    source_document_type, source_document_id, posted_at, posted_by
  )
  SELECT
    _doc.company_id, _doc.business_year_id, _je_number, _doc.statement_date, _doc.statement_date,
    'Izvod ' || _doc.statement_number, 'posted', 0, 0, _user_id,
    'bank_statement', _doc.id, NOW(), _user_id
  RETURNING id INTO _je_id;
  
  FOR _item IN
    SELECT bsi.*, pc.account_code, pc.name AS payment_name
    FROM bank_statement_items bsi
    LEFT JOIN payment_codes pc ON pc.id = bsi.payment_code_id
    WHERE bsi.bank_statement_id = _statement_id
    ORDER BY bsi.item_order
  LOOP
    _item_idx := _item_idx + 1;
    
    IF _item.debit_amount > 0 THEN
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount, partner_id,
        cost_center_code, document_date
      ) VALUES (
        _je_id, _doc.company_id, COALESCE(_item.account_code, '9999'), _item_idx,
        COALESCE(_item.description, _item.payment_name, ''),
        _item.debit_amount, 0, _item.partner_id,
        _item.cost_center_code, _doc.statement_date
      );
      _total_debit := _total_debit + _item.debit_amount;
    END IF;
    
    IF _item.credit_amount > 0 THEN
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount, partner_id,
        cost_center_code, document_date
      ) VALUES (
        _je_id, _doc.company_id, COALESCE(_item.account_code, '9999'), _item_idx,
        COALESCE(_item.description, _item.payment_name, ''),
        0, _item.credit_amount, _item.partner_id,
        _item.cost_center_code, _doc.statement_date
      );
      _total_credit := _total_credit + _item.credit_amount;
    END IF;
  END LOOP;
  
  _item_idx := _item_idx + 1;
  
  IF _total_credit > 0 THEN
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, partner_id,
      cost_center_code, document_date
    ) VALUES (
      _je_id, _doc.company_id, '2410', _item_idx,
      'Izvod ' || _doc.statement_number || ' - uplate', _total_credit, 0, NULL,
      _ba_code, _doc.statement_date
    );
  END IF;
  
  IF _total_debit > 0 THEN
    _item_idx := _item_idx + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, partner_id,
      cost_center_code, document_date
    ) VALUES (
      _je_id, _doc.company_id, '2410', _item_idx,
      'Izvod ' || _doc.statement_number || ' - isplate', 0, _total_debit, NULL,
      _ba_code, _doc.statement_date
    );
  END IF;
  
  UPDATE journal_entries
  SET total_debit = _total_debit + _total_credit,
      total_credit = _total_debit + _total_credit
  WHERE id = _je_id;
  
  UPDATE bank_statements
  SET status = 'posted',
      journal_entry_id = _je_id,
      posted_at = NOW(),
      posted_by = _user_id,
      updated_at = NOW(),
      closing_balance = opening_balance + _total_credit - _total_debit
  WHERE id = _statement_id;
  
  RETURN _je_id;
END;
$$;

-- Fix existing posted statements with wrong closing_balance
UPDATE bank_statements
SET closing_balance = opening_balance + total_credit - total_debit
WHERE status = 'posted';