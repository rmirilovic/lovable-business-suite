
-- Add journal_entry_id to payroll_calculations
ALTER TABLE public.payroll_calculations 
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL;

-- Function to post payroll calculation (create journal entry in GL)
CREATE OR REPLACE FUNCTION public.post_payroll_calculation(_calculation_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calc payroll_calculations%ROWTYPE;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_item_order int := 0;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_total_gross numeric := 0;
  v_total_net numeric := 0;
  v_total_tax numeric := 0;
  v_total_pio_emp numeric := 0;
  v_total_health_emp numeric := 0;
  v_total_unemployment numeric := 0;
  v_total_pio_erl numeric := 0;
  v_total_health_erl numeric := 0;
  v_total_employee_contr numeric := 0;
  v_total_employer_contr numeric := 0;
  v_calc_type_label text;
  v_description text;
BEGIN
  SELECT * INTO v_calc FROM payroll_calculations WHERE id = _calculation_id;
  IF v_calc IS NULL THEN RAISE EXCEPTION 'Obračun zarada nije pronađen'; END IF;
  IF v_calc.status = 'posted' THEN RAISE EXCEPTION 'Obračun je već proknjižen'; END IF;

  -- Aggregate from items
  SELECT
    COALESCE(SUM(gross_salary + seniority_bonus + regres + meal_allowance + transport_allowance + other_additions), 0),
    COALESCE(SUM(net_salary), 0),
    COALESCE(SUM(income_tax), 0),
    COALESCE(SUM(pio_employee), 0),
    COALESCE(SUM(health_employee), 0),
    COALESCE(SUM(unemployment), 0),
    COALESCE(SUM(pio_employer), 0),
    COALESCE(SUM(health_employer), 0),
    COALESCE(SUM(total_employee_contributions), 0),
    COALESCE(SUM(total_employer_contributions), 0)
  INTO v_total_gross, v_total_net, v_total_tax,
       v_total_pio_emp, v_total_health_emp, v_total_unemployment,
       v_total_pio_erl, v_total_health_erl,
       v_total_employee_contr, v_total_employer_contr
  FROM payroll_calculation_items WHERE calculation_id = _calculation_id;

  IF v_total_gross = 0 THEN RAISE EXCEPTION 'Obračun nema stavke'; END IF;

  -- Type label for description
  v_calc_type_label := CASE v_calc.calculation_type
    WHEN 'redovna_zarada' THEN 'Redovna zarada'
    WHEN 'bolovanje_poslodavac' THEN 'Bolovanje na teret poslodavca'
    WHEN 'bolovanje_rfzo' THEN 'Bolovanje na teret RFZO'
    WHEN 'ugovor_o_delu' THEN 'Ugovor o delu'
    WHEN 'autorski_ugovor' THEN 'Autorski ugovor'
    WHEN 'vlasnik' THEN 'Vlasnik'
    WHEN 'penzioner' THEN 'Penzioner'
    ELSE v_calc.calculation_type::text
  END;

  v_entry_number := 'ZAR' || v_calc.calculation_number;
  v_description := v_calc_type_label || ' - ' || v_calc.period_month::text || '/' || v_calc.period_year::text;

  -- Create journal entry
  INSERT INTO journal_entries (
    company_id, business_year_id, entry_number, entry_date, document_date,
    document_number, description, status, created_by,
    source_document_type, source_document_id
  ) VALUES (
    v_calc.company_id, v_calc.business_year_id, v_entry_number, v_calc.calculation_date,
    v_calc.calculation_date, v_calc.calculation_number,
    v_description, 'posted', _user_id,
    'payroll_calculation', _calculation_id
  ) RETURNING id INTO v_journal_entry_id;

  -- DEBIT: 520 - Troškovi zarada (bruto zarada sa svim dodacima)
  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, document_date
  ) VALUES (
    v_journal_entry_id, v_calc.company_id, '520', v_item_order,
    'Troškovi bruto zarada', v_total_gross, 0, v_calc.calculation_date
  );
  v_total_debit := v_total_debit + v_total_gross;

  -- DEBIT: 522 - Troškovi doprinosa na teret poslodavca
  IF v_total_employer_contr > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, document_date
    ) VALUES (
      v_journal_entry_id, v_calc.company_id, '522', v_item_order,
      'Doprinosi na teret poslodavca', v_total_employer_contr, 0, v_calc.calculation_date
    );
    v_total_debit := v_total_debit + v_total_employer_contr;
  END IF;

  -- CREDIT: 450 - Obaveze za neto zarade
  v_item_order := v_item_order + 1;
  INSERT INTO journal_entry_items (
    journal_entry_id, company_id, account_code, item_order, description,
    debit_amount, credit_amount, document_date
  ) VALUES (
    v_journal_entry_id, v_calc.company_id, '450', v_item_order,
    'Obaveze za neto zarade', 0, v_total_net, v_calc.calculation_date
  );
  v_total_credit := v_total_credit + v_total_net;

  -- CREDIT: 451 - Obaveze za porez na zarade
  IF v_total_tax > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, document_date
    ) VALUES (
      v_journal_entry_id, v_calc.company_id, '451', v_item_order,
      'Porez na dohodak građana', 0, v_total_tax, v_calc.calculation_date
    );
    v_total_credit := v_total_credit + v_total_tax;
  END IF;

  -- CREDIT: 4520 - PIO na teret zaposlenog
  IF v_total_pio_emp > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, document_date
    ) VALUES (
      v_journal_entry_id, v_calc.company_id, '4520', v_item_order,
      'PIO doprinos - zaposleni', 0, v_total_pio_emp, v_calc.calculation_date
    );
    v_total_credit := v_total_credit + v_total_pio_emp;
  END IF;

  -- CREDIT: 4521 - Zdravstvo na teret zaposlenog
  IF v_total_health_emp > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, document_date
    ) VALUES (
      v_journal_entry_id, v_calc.company_id, '4521', v_item_order,
      'Zdravstveno osiguranje - zaposleni', 0, v_total_health_emp, v_calc.calculation_date
    );
    v_total_credit := v_total_credit + v_total_health_emp;
  END IF;

  -- CREDIT: 4522 - Nezaposlenost
  IF v_total_unemployment > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, document_date
    ) VALUES (
      v_journal_entry_id, v_calc.company_id, '4522', v_item_order,
      'Doprinos za nezaposlenost', 0, v_total_unemployment, v_calc.calculation_date
    );
    v_total_credit := v_total_credit + v_total_unemployment;
  END IF;

  -- CREDIT: 4530 - PIO na teret poslodavca
  IF v_total_pio_erl > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, document_date
    ) VALUES (
      v_journal_entry_id, v_calc.company_id, '4530', v_item_order,
      'PIO doprinos - poslodavac', 0, v_total_pio_erl, v_calc.calculation_date
    );
    v_total_credit := v_total_credit + v_total_pio_erl;
  END IF;

  -- CREDIT: 4531 - Zdravstvo na teret poslodavca
  IF v_total_health_erl > 0 THEN
    v_item_order := v_item_order + 1;
    INSERT INTO journal_entry_items (
      journal_entry_id, company_id, account_code, item_order, description,
      debit_amount, credit_amount, document_date
    ) VALUES (
      v_journal_entry_id, v_calc.company_id, '4531', v_item_order,
      'Zdravstveno osiguranje - poslodavac', 0, v_total_health_erl, v_calc.calculation_date
    );
    v_total_credit := v_total_credit + v_total_health_erl;
  END IF;

  -- Update journal entry totals
  UPDATE journal_entries
  SET total_debit = v_total_debit, total_credit = v_total_credit,
      posted_at = now(), posted_by = _user_id
  WHERE id = v_journal_entry_id;

  -- Update payroll calculation status
  UPDATE payroll_calculations
  SET status = 'posted', posted_at = now(), posted_by = _user_id,
      journal_entry_id = v_journal_entry_id,
      total_gross = v_total_gross,
      total_net = v_total_net,
      total_tax = v_total_tax,
      total_employee_contributions = v_total_employee_contr,
      total_employer_contributions = v_total_employer_contr,
      total_cost = v_total_gross + v_total_employer_contr,
      updated_at = now()
  WHERE id = _calculation_id;

  RETURN v_journal_entry_id;
END;
$$;

-- Function to unpost payroll calculation
CREATE OR REPLACE FUNCTION public.unpost_payroll_calculation(_calculation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calc payroll_calculations%ROWTYPE;
  v_journal_entry_id uuid;
BEGIN
  SELECT * INTO v_calc FROM payroll_calculations WHERE id = _calculation_id;
  IF v_calc IS NULL THEN RAISE EXCEPTION 'Obračun nije pronađen'; END IF;
  IF v_calc.status != 'posted' THEN RAISE EXCEPTION 'Obračun nije proknjižen'; END IF;

  v_journal_entry_id := v_calc.journal_entry_id;

  -- Delete journal entry items and then the entry
  IF v_journal_entry_id IS NOT NULL THEN
    DELETE FROM journal_entry_items WHERE journal_entry_id = v_journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_journal_entry_id;
  END IF;

  -- Reset payroll calculation status
  UPDATE payroll_calculations
  SET status = 'draft', posted_at = NULL, posted_by = NULL,
      journal_entry_id = NULL, updated_at = now()
  WHERE id = _calculation_id;

  RETURN TRUE;
END;
$$;
