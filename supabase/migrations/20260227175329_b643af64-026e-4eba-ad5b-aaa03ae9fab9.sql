
-- post_advance_invoice: Posts advance invoice and creates journal entry
-- Accounts: 2010 Kupci (debit), 4309 Primljeni avansi (credit), 4700 PDV (credit)
CREATE OR REPLACE FUNCTION public.post_advance_invoice(_invoice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc advance_invoices%ROWTYPE;
  _journal_entry_id uuid;
  _journal_entry_number text;
  _partner partners%ROWTYPE;
  _receivable_account text := '2010';
  _advance_account text := '4309';
  _vat_account text := '4700';
BEGIN
  SELECT * INTO _doc FROM advance_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Avansni račun nije pronađen'; END IF;
  IF _doc.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;
  IF _doc.total_amount <= 0 THEN RAISE EXCEPTION 'Dokument mora imati pozitivan iznos'; END IF;

  SELECT * INTO _partner FROM partners WHERE id = _doc.partner_id;

  _journal_entry_number := 'AVR' || _doc.advance_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, org_unit_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit, posted_at, posted_by,
    source_document_type, source_document_id, created_by
  ) VALUES (
    _doc.company_id, _doc.business_year_id, _doc.org_unit_id,
    _journal_entry_number, _doc.advance_date, _doc.advance_date,
    _doc.advance_number,
    'Avansni račun ' || _doc.advance_number || ' - ' || _partner.name,
    'posted', _doc.total_amount, _doc.total_amount,
    now(), _user_id, 'advance_invoice', _invoice_id, _user_id
  ) RETURNING id INTO _journal_entry_id;

  -- Debit: Kupci (receivable)
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id
  ) VALUES (
    _journal_entry_id, _doc.company_id, _receivable_account, 1,
    'Potraživanje po avansu - ' || _partner.name,
    _doc.total_amount, 0, _doc.partner_id
  );

  -- Credit: Primljeni avansi
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id
  ) VALUES (
    _journal_entry_id, _doc.company_id, _advance_account, 2,
    'Primljeni avans - ' || _doc.advance_number,
    0, _doc.subtotal, NULL
  );

  -- Credit: PDV
  IF _doc.vat_amount > 0 THEN
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, partner_id
    ) VALUES (
      _journal_entry_id, _doc.company_id, _vat_account, 3,
      'PDV obaveza - avansni račun ' || _doc.advance_number,
      0, _doc.vat_amount, NULL
    );
  END IF;

  UPDATE advance_invoices
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = _journal_entry_id
  WHERE id = _invoice_id;

  RETURN TRUE;
END;
$$;


-- post_credit_note: Posts credit note and creates journal entry
-- Accounts: 6100 Prihodi (debit - umanjenje), 4700 PDV (debit - umanjenje), 2010 Kupci (credit)
CREATE OR REPLACE FUNCTION public.post_credit_note(_credit_note_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc credit_notes%ROWTYPE;
  _journal_entry_id uuid;
  _journal_entry_number text;
  _partner partners%ROWTYPE;
  _receivable_account text := '2010';
  _revenue_account text := '6100';
  _vat_account text := '4700';
BEGIN
  SELECT * INTO _doc FROM credit_notes WHERE id = _credit_note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Knjižno odobrenje nije pronađeno'; END IF;
  IF _doc.status != 'draft' THEN RAISE EXCEPTION 'Samo nacrti mogu biti proknjiženi'; END IF;
  IF _doc.total_amount <= 0 THEN RAISE EXCEPTION 'Dokument mora imati pozitivan iznos'; END IF;

  SELECT * INTO _partner FROM partners WHERE id = _doc.partner_id;

  _journal_entry_number := 'KNO' || _doc.credit_note_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, org_unit_id, entry_number, entry_date,
    document_date, document_number, description, status,
    total_debit, total_credit, posted_at, posted_by,
    source_document_type, source_document_id, created_by
  ) VALUES (
    _doc.company_id, _doc.business_year_id, _doc.org_unit_id,
    _journal_entry_number, _doc.credit_note_date, _doc.credit_note_date,
    _doc.credit_note_number,
    'Knjižno odobrenje ' || _doc.credit_note_number || ' - ' || _partner.name,
    'posted', _doc.total_amount, _doc.total_amount,
    now(), _user_id, 'credit_note', _credit_note_id, _user_id
  ) RETURNING id INTO _journal_entry_id;

  -- Debit: Umanjenje prihoda
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id
  ) VALUES (
    _journal_entry_id, _doc.company_id, _revenue_account, 1,
    'Umanjenje prihoda - knjižno odobrenje ' || _doc.credit_note_number,
    _doc.subtotal, 0, NULL
  );

  -- Debit: PDV korekcija
  IF _doc.vat_amount > 0 THEN
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, partner_id
    ) VALUES (
      _journal_entry_id, _doc.company_id, _vat_account, 2,
      'Korekcija PDV-a - knjižno odobrenje ' || _doc.credit_note_number,
      _doc.vat_amount, 0, NULL
    );
  END IF;

  -- Credit: Umanjenje potraživanja od kupca
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, partner_id
  ) VALUES (
    _journal_entry_id, _doc.company_id, _receivable_account, 3,
    'Umanjenje potraživanja - ' || _partner.name,
    0, _doc.total_amount, _doc.partner_id
  );

  UPDATE credit_notes
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = _journal_entry_id
  WHERE id = _credit_note_id;

  RETURN TRUE;
END;
$$;


-- unpost_advance_invoice: Reverts posted advance invoice to draft
CREATE OR REPLACE FUNCTION public.unpost_advance_invoice(_invoice_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc advance_invoices%ROWTYPE;
BEGIN
  SELECT * INTO _doc FROM advance_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Avansni račun nije pronađen'; END IF;
  IF _doc.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjiženi dokumenti mogu biti poništeni'; END IF;

  -- Delete journal entry
  IF _doc.journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = _doc.journal_entry_id;
    DELETE FROM journal_entries WHERE id = _doc.journal_entry_id;
  END IF;

  UPDATE advance_invoices
  SET status = 'draft', posted_at = NULL, posted_by = NULL, journal_entry_id = NULL
  WHERE id = _invoice_id;

  RETURN TRUE;
END;
$$;


-- unpost_credit_note: Reverts posted credit note to draft
CREATE OR REPLACE FUNCTION public.unpost_credit_note(_credit_note_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc credit_notes%ROWTYPE;
BEGIN
  SELECT * INTO _doc FROM credit_notes WHERE id = _credit_note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Knjižno odobrenje nije pronađeno'; END IF;
  IF _doc.status != 'posted' THEN RAISE EXCEPTION 'Samo proknjiženi dokumenti mogu biti poništeni'; END IF;

  -- Delete journal entry
  IF _doc.journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = _doc.journal_entry_id;
    DELETE FROM journal_entries WHERE id = _doc.journal_entry_id;
  END IF;

  UPDATE credit_notes
  SET status = 'draft', posted_at = NULL, posted_by = NULL, journal_entry_id = NULL
  WHERE id = _credit_note_id;

  RETURN TRUE;
END;
$$;
