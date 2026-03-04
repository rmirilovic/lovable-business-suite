
-- Payment codes reference table (šifarnik plaćanja)
CREATE TABLE public.payment_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(200) NOT NULL,
  account_code VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

ALTER TABLE public.payment_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment codes" ON public.payment_codes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert payment codes" ON public.payment_codes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update payment codes" ON public.payment_codes
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete payment codes" ON public.payment_codes
  FOR DELETE TO authenticated USING (true);

-- Bank statements table
CREATE TABLE public.bank_statements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  statement_number VARCHAR(20) NOT NULL,
  statement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, business_year_id, statement_number)
);

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bank statements" ON public.bank_statements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert bank statements" ON public.bank_statements
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update bank statements" ON public.bank_statements
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete bank statements" ON public.bank_statements
  FOR DELETE TO authenticated USING (true);

-- Bank statement items table
CREATE TABLE public.bank_statement_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_order INT NOT NULL DEFAULT 0,
  payment_code_id UUID REFERENCES public.payment_codes(id),
  partner_id UUID REFERENCES public.partners(id),
  reference_number VARCHAR(100),
  description TEXT,
  debit_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_statement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bank statement items" ON public.bank_statement_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert bank statement items" ON public.bank_statement_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update bank statement items" ON public.bank_statement_items
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete bank statement items" ON public.bank_statement_items
  FOR DELETE TO authenticated USING (true);

-- Function to get next bank statement number
CREATE OR REPLACE FUNCTION public.get_next_bank_statement_number(
  _company_id UUID,
  _year_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year INT;
  _next INT;
  _prefix TEXT;
BEGIN
  SELECT year INTO _year FROM business_years WHERE id = _year_id;
  _prefix := 'I-' || RIGHT(_year::TEXT, 2);
  
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(statement_number, '^I-\d{2}', ''), '')::INT
  ), 0) + 1
  INTO _next
  FROM bank_statements
  WHERE company_id = _company_id AND business_year_id = _year_id;
  
  RETURN _prefix || LPAD(_next::TEXT, 4, '0');
END;
$$;

-- Function to post bank statement
CREATE OR REPLACE FUNCTION public.post_bank_statement(
  _statement_id UUID,
  _user_id UUID
)
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
  -- Get statement
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
  
  -- Get next journal entry number
  SELECT get_next_journal_entry_number(_doc.company_id, _doc.business_year_id) INTO _je_number;
  
  -- Create journal entry
  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    description, status, total_debit, total_credit, created_by,
    source_document_type, source_document_id, posted_at, posted_by
  )
  SELECT
    _doc.company_id, _doc.business_year_id, _je_number, _doc.statement_date, _doc.statement_date,
    'Izvod br. ' || _doc.statement_number, 'posted', 0, 0, _user_id,
    'bank_statement', _doc.id, NOW(), _user_id
  RETURNING id INTO _je_id;
  
  -- Create journal entry items for each bank statement item
  FOR _item IN
    SELECT bsi.*, pc.account_code, pc.name AS payment_name
    FROM bank_statement_items bsi
    LEFT JOIN payment_codes pc ON pc.id = bsi.payment_code_id
    WHERE bsi.bank_statement_id = _statement_id
    ORDER BY bsi.item_order
  LOOP
    _item_idx := _item_idx + 1;
    
    IF _item.debit_amount > 0 THEN
      -- Uplata: protivkonto duguje
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount, partner_id,
        cost_center_code, document_date
      ) VALUES (
        _je_id, _doc.company_id, COALESCE(_item.account_code, '9999'), _item_idx,
        COALESCE(_item.description, _item.payment_name, ''),
        _item.debit_amount, 0, _item.partner_id,
        NULL, _doc.statement_date
      );
      _total_debit := _total_debit + _item.debit_amount;
    END IF;
    
    IF _item.credit_amount > 0 THEN
      -- Isplata: protivkonto potražuje
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount, partner_id,
        cost_center_code, document_date
      ) VALUES (
        _je_id, _doc.company_id, COALESCE(_item.account_code, '9999'), _item_idx,
        COALESCE(_item.description, _item.payment_name, ''),
        0, _item.credit_amount, _item.partner_id,
        NULL, _doc.statement_date
      );
      _total_credit := _total_credit + _item.credit_amount;
    END IF;
  END LOOP;
  
  -- Contra entry on 2410 with analytics = bank account code
  _item_idx := _item_idx + 1;
  
  IF _total_debit > 0 THEN
    -- Credit 2410 for total debits (uplate na TR)
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, partner_id,
      cost_center_code, document_date
    ) VALUES (
      _je_id, _doc.company_id, '2410', _item_idx,
      'Žiro račun - uplate', 0, _total_debit, NULL,
      _ba_code, _doc.statement_date
    );
  END IF;
  
  IF _total_credit > 0 THEN
    _item_idx := _item_idx + 1;
    -- Debit 2410 for total credits (isplate sa TR)
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, partner_id,
      cost_center_code, document_date
    ) VALUES (
      _je_id, _doc.company_id, '2410', _item_idx,
      'Žiro račun - isplate', _total_credit, 0, NULL,
      _ba_code, _doc.statement_date
    );
  END IF;
  
  -- Update journal entry totals
  UPDATE journal_entries
  SET total_debit = _total_debit + _total_credit,
      total_credit = _total_debit + _total_credit
  WHERE id = _je_id;
  
  -- Update bank statement status
  UPDATE bank_statements
  SET status = 'posted',
      journal_entry_id = _je_id,
      posted_at = NOW(),
      posted_by = _user_id,
      updated_at = NOW()
  WHERE id = _statement_id;
  
  RETURN _je_id;
END;
$$;

-- Function to unpost bank statement
CREATE OR REPLACE FUNCTION public.unpost_bank_statement(
  _statement_id UUID,
  _user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc RECORD;
BEGIN
  SELECT * INTO _doc FROM bank_statements WHERE id = _statement_id;
  
  IF _doc.status != 'posted' THEN
    RAISE EXCEPTION 'Izvod nije proknjižen';
  END IF;
  
  -- Delete journal entry items first, then journal entry
  IF _doc.journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = _doc.journal_entry_id;
    DELETE FROM journal_entries WHERE id = _doc.journal_entry_id;
  END IF;
  
  -- Update statement status
  UPDATE bank_statements
  SET status = 'draft',
      journal_entry_id = NULL,
      posted_at = NULL,
      posted_by = NULL,
      updated_at = NOW()
  WHERE id = _statement_id;
END;
$$;
