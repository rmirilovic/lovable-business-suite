-- Bank accounts: currency + GL account
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'RSD',
  ADD COLUMN IF NOT EXISTS gl_account_code text NOT NULL DEFAULT '2410';

-- Bank statements: exchange rate
ALTER TABLE public.bank_statements
  ADD COLUMN IF NOT EXISTS exchange_rate numeric NOT NULL DEFAULT 1;

-- Bank statement items: original amounts + closed-document link
ALTER TABLE public.bank_statement_items
  ADD COLUMN IF NOT EXISTS original_debit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_credit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closed_document_type text,
  ADD COLUMN IF NOT EXISTS closed_document_id uuid;

-- Backfill original amounts = RSD amounts for existing RSD statements
UPDATE public.bank_statement_items
SET original_debit_amount = debit_amount,
    original_credit_amount = credit_amount
WHERE original_debit_amount = 0 AND original_credit_amount = 0
  AND (debit_amount > 0 OR credit_amount > 0);

-- post_bank_statement: handle foreign currency + FX differences
CREATE OR REPLACE FUNCTION public.post_bank_statement(_statement_id uuid, _user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _doc RECORD;
  _je_id UUID;
  _je_number TEXT;
  _item RECORD;
  _item_idx INT := 0;
  _total_debit_rsd NUMERIC(18,2) := 0;
  _total_credit_rsd NUMERIC(18,2) := 0;
  _ba_code TEXT;
  _ba_currency TEXT;
  _ba_gl TEXT;
  _fx NUMERIC := 1;
  _is_foreign BOOLEAN := false;
  _orig_debit NUMERIC;
  _orig_credit NUMERIC;
  _rsd_debit NUMERIC;
  _rsd_credit NUMERIC;
  -- FX calculation vars
  _inv RECORD;
  _purch RECORD;
  _adv RECORD;
  _adv_purch RECORD;
  _doc_currency TEXT;
  _doc_fx NUMERIC;
  _doc_total NUMERIC;
  _expected_rsd NUMERIC;
  _fx_diff NUMERIC;
  _fx_account TEXT;
  _fx_partner UUID;
BEGIN
  SELECT bs.*, ba.code AS ba_code, ba.account_number AS ba_account_number,
         ba.currency AS ba_currency, ba.gl_account_code AS ba_gl
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
  _ba_currency := COALESCE(_doc.ba_currency, 'RSD');
  _ba_gl := COALESCE(_doc.ba_gl, '2410');
  _is_foreign := (_ba_currency != 'RSD');
  _fx := COALESCE(NULLIF(_doc.exchange_rate, 0), 1);
  IF NOT _is_foreign THEN _fx := 1; END IF;

  _je_number := 'IB' || _doc.statement_number;

  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    description, status, total_debit, total_credit, created_by,
    source_document_type, source_document_id, posted_at, posted_by
  )
  VALUES (
    _doc.company_id, _doc.business_year_id, _je_number, _doc.statement_date, _doc.statement_date,
    'Izvod ' || _doc.statement_number
      || CASE WHEN _is_foreign THEN ' (' || _ba_currency || ' @ ' || _fx || ')' ELSE '' END,
    'posted', 0, 0, _user_id,
    'bank_statement', _doc.id, NOW(), _user_id
  )
  RETURNING id INTO _je_id;

  FOR _item IN
    SELECT bsi.*, pc.account_code, pc.name AS payment_name
    FROM bank_statement_items bsi
    LEFT JOIN payment_codes pc ON pc.id = bsi.payment_code_id
    WHERE bsi.bank_statement_id = _statement_id
    ORDER BY bsi.item_order
  LOOP
    _item_idx := _item_idx + 1;

    -- Determine original amounts (for foreign use original_*, for RSD fall back to debit/credit)
    IF _is_foreign THEN
      _orig_debit := COALESCE(NULLIF(_item.original_debit_amount, 0), _item.debit_amount);
      _orig_credit := COALESCE(NULLIF(_item.original_credit_amount, 0), _item.credit_amount);
      _rsd_debit := round(_orig_debit * _fx, 2);
      _rsd_credit := round(_orig_credit * _fx, 2);
    ELSE
      _rsd_debit := _item.debit_amount;
      _rsd_credit := _item.credit_amount;
      _orig_debit := _item.debit_amount;
      _orig_credit := _item.credit_amount;
    END IF;

    IF _rsd_debit > 0 THEN
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount, partner_id,
        cost_center_code, document_date
      ) VALUES (
        _je_id, _doc.company_id, COALESCE(_item.account_code, '9999'), _item_idx,
        COALESCE(_item.description, _item.payment_name, '')
          || CASE WHEN _is_foreign THEN ' (' || _ba_currency || ' ' || _orig_debit || ')' ELSE '' END,
        _rsd_debit, 0, _item.partner_id,
        _item.cost_center_code, _doc.statement_date
      );
      _total_debit_rsd := _total_debit_rsd + _rsd_debit;
    END IF;

    IF _rsd_credit > 0 THEN
      INSERT INTO journal_entry_items (
        journal_entry_id, company_id, account_code, item_order,
        description, debit_amount, credit_amount, partner_id,
        cost_center_code, document_date
      ) VALUES (
        _je_id, _doc.company_id, COALESCE(_item.account_code, '9999'), _item_idx,
        COALESCE(_item.description, _item.payment_name, '')
          || CASE WHEN _is_foreign THEN ' (' || _ba_currency || ' ' || _orig_credit || ')' ELSE '' END,
        0, _rsd_credit, _item.partner_id,
        _item.cost_center_code, _doc.statement_date
      );
      _total_credit_rsd := _total_credit_rsd + _rsd_credit;
    END IF;

    -- Kursne razlike za zatvaranje devizne fakture/avansa
    IF _is_foreign AND _item.closed_document_type IS NOT NULL AND _item.closed_document_id IS NOT NULL THEN
      _doc_currency := NULL;
      _doc_fx := NULL;
      _doc_total := NULL;

      IF _item.closed_document_type = 'invoice' THEN
        SELECT currency, exchange_rate, total_amount, partner_id
          INTO _inv FROM invoices WHERE id = _item.closed_document_id;
        IF FOUND THEN
          _doc_currency := COALESCE(_inv.currency, 'RSD');
          _doc_fx := COALESCE(NULLIF(_inv.exchange_rate, 0), 1);
          _doc_total := _inv.total_amount;
          _fx_partner := _inv.partner_id;
        END IF;
      ELSIF _item.closed_document_type = 'purchase_invoice' THEN
        SELECT currency, exchange_rate, total_amount, partner_id
          INTO _purch FROM purchase_invoices WHERE id = _item.closed_document_id;
        IF FOUND THEN
          _doc_currency := COALESCE(_purch.currency, 'RSD');
          _doc_fx := COALESCE(NULLIF(_purch.exchange_rate, 0), 1);
          _doc_total := _purch.total_amount;
          _fx_partner := _purch.partner_id;
        END IF;
      ELSIF _item.closed_document_type = 'advance_invoice' THEN
        SELECT total_amount, partner_id
          INTO _adv FROM advance_invoices WHERE id = _item.closed_document_id;
        IF FOUND THEN
          _doc_currency := 'RSD';
          _doc_fx := 1;
          _doc_total := _adv.total_amount;
          _fx_partner := _adv.partner_id;
        END IF;
      END IF;

      IF _doc_currency IS NOT NULL AND _doc_currency = _ba_currency AND _doc_currency != 'RSD' THEN
        -- iznos uplate (kredit za potraživanja) ili isplate (debit za obaveze) u originalnoj valuti
        DECLARE
          _orig_used NUMERIC := GREATEST(_orig_debit, _orig_credit);
        BEGIN
          _expected_rsd := round(_orig_used * _doc_fx, 2);
          _fx_diff := round(_orig_used * _fx, 2) - _expected_rsd;

          IF abs(_fx_diff) >= 0.01 THEN
            _item_idx := _item_idx + 1;
            IF _item.closed_document_type = 'invoice' THEN
              -- Potraživanje (2050) za uplatu (credit): ako uplata RSD > očekivano → 662 (pozitivna),
              -- iznos koji nedostaje na potraživanju ide na 662/552 strana, a stavka 2050 dobija dodatni iznos
              IF _fx_diff > 0 THEN
                -- pozitivna kursna razlika: dodatno potraživanje zatvoreno → 2050 D, 662 P
                INSERT INTO journal_entry_items (
                  journal_entry_id, company_id, account_code, item_order,
                  description, debit_amount, credit_amount, partner_id, document_date
                ) VALUES (
                  _je_id, _doc.company_id, '2050', _item_idx,
                  'Pozitivna kursna razlika - ' || _ba_currency || ' ' || _orig_used,
                  _fx_diff, 0, _fx_partner, _doc.statement_date
                );
                _item_idx := _item_idx + 1;
                INSERT INTO journal_entry_items (
                  journal_entry_id, company_id, account_code, item_order,
                  description, debit_amount, credit_amount, partner_id, document_date
                ) VALUES (
                  _je_id, _doc.company_id, '662', _item_idx,
                  'Pozitivna kursna razlika - ' || _ba_currency || ' ' || _orig_used,
                  0, _fx_diff, _fx_partner, _doc.statement_date
                );
                _total_debit_rsd := _total_debit_rsd + _fx_diff;
                _total_credit_rsd := _total_credit_rsd + _fx_diff;
              ELSE
                -- negativna: manji RSD na uplati nego potraživanje → storno potraživanja 2050 P, 552 D
                INSERT INTO journal_entry_items (
                  journal_entry_id, company_id, account_code, item_order,
                  description, debit_amount, credit_amount, partner_id, document_date
                ) VALUES (
                  _je_id, _doc.company_id, '552', _item_idx,
                  'Negativna kursna razlika - ' || _ba_currency || ' ' || _orig_used,
                  -_fx_diff, 0, _fx_partner, _doc.statement_date
                );
                _item_idx := _item_idx + 1;
                INSERT INTO journal_entry_items (
                  journal_entry_id, company_id, account_code, item_order,
                  description, debit_amount, credit_amount, partner_id, document_date
                ) VALUES (
                  _je_id, _doc.company_id, '2050', _item_idx,
                  'Negativna kursna razlika - ' || _ba_currency || ' ' || _orig_used,
                  0, -_fx_diff, _fx_partner, _doc.statement_date
                );
                _total_debit_rsd := _total_debit_rsd + (-_fx_diff);
                _total_credit_rsd := _total_credit_rsd + (-_fx_diff);
              END IF;
            ELSIF _item.closed_document_type = 'purchase_invoice' THEN
              -- Obaveza (435 ili sl. ino - po standardu 435 za ino dobavljače). Koristimo 435.
              IF _fx_diff < 0 THEN
                -- isplata RSD < obaveza RSD → pozitivna kursna razlika (manje smo platili)
                INSERT INTO journal_entry_items (
                  journal_entry_id, company_id, account_code, item_order,
                  description, debit_amount, credit_amount, partner_id, document_date
                ) VALUES (
                  _je_id, _doc.company_id, '435', _item_idx,
                  'Pozitivna kursna razlika - ' || _ba_currency || ' ' || _orig_used,
                  -_fx_diff, 0, _fx_partner, _doc.statement_date
                );
                _item_idx := _item_idx + 1;
                INSERT INTO journal_entry_items (
                  journal_entry_id, company_id, account_code, item_order,
                  description, debit_amount, credit_amount, partner_id, document_date
                ) VALUES (
                  _je_id, _doc.company_id, '662', _item_idx,
                  'Pozitivna kursna razlika - ' || _ba_currency || ' ' || _orig_used,
                  0, -_fx_diff, _fx_partner, _doc.statement_date
                );
                _total_debit_rsd := _total_debit_rsd + (-_fx_diff);
                _total_credit_rsd := _total_credit_rsd + (-_fx_diff);
              ELSE
                -- isplata RSD > obaveza RSD → negativna kursna razlika
                INSERT INTO journal_entry_items (
                  journal_entry_id, company_id, account_code, item_order,
                  description, debit_amount, credit_amount, partner_id, document_date
                ) VALUES (
                  _je_id, _doc.company_id, '552', _item_idx,
                  'Negativna kursna razlika - ' || _ba_currency || ' ' || _orig_used,
                  _fx_diff, 0, _fx_partner, _doc.statement_date
                );
                _item_idx := _item_idx + 1;
                INSERT INTO journal_entry_items (
                  journal_entry_id, company_id, account_code, item_order,
                  description, debit_amount, credit_amount, partner_id, document_date
                ) VALUES (
                  _je_id, _doc.company_id, '435', _item_idx,
                  'Negativna kursna razlika - ' || _ba_currency || ' ' || _orig_used,
                  0, _fx_diff, _fx_partner, _doc.statement_date
                );
                _total_debit_rsd := _total_debit_rsd + _fx_diff;
                _total_credit_rsd := _total_credit_rsd + _fx_diff;
              END IF;
            END IF;
          END IF;
        END;
      END IF;
    END IF;
  END LOOP;

  -- Bank account leg (242 for foreign, 2410 for RSD)
  _item_idx := _item_idx + 1;

  IF _total_credit_rsd > 0 THEN
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, partner_id,
      cost_center_code, document_date
    ) VALUES (
      _je_id, _doc.company_id, _ba_gl, _item_idx,
      'Izvod ' || _doc.statement_number || ' - uplate', _total_credit_rsd, 0, NULL,
      _ba_code, _doc.statement_date
    );
  END IF;

  IF _total_debit_rsd > 0 THEN
    _item_idx := _item_idx + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order,
      description, debit_amount, credit_amount, partner_id,
      cost_center_code, document_date
    ) VALUES (
      _je_id, _doc.company_id, _ba_gl, _item_idx,
      'Izvod ' || _doc.statement_number || ' - isplate', 0, _total_debit_rsd, NULL,
      _ba_code, _doc.statement_date
    );
  END IF;

  UPDATE journal_entries
  SET total_debit = _total_debit_rsd + _total_credit_rsd,
      total_credit = _total_debit_rsd + _total_credit_rsd
  WHERE id = _je_id;

  UPDATE bank_statements
  SET status = 'posted',
      journal_entry_id = _je_id,
      posted_at = NOW(),
      posted_by = _user_id,
      updated_at = NOW(),
      closing_balance = opening_balance + COALESCE((
        SELECT SUM(COALESCE(NULLIF(original_credit_amount,0), credit_amount))
               - SUM(COALESCE(NULLIF(original_debit_amount,0), debit_amount))
        FROM bank_statement_items WHERE bank_statement_id = _statement_id
      ), 0)
  WHERE id = _statement_id;

  RETURN _je_id;
END;
$function$;