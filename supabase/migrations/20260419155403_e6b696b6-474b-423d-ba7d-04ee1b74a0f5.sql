-- 1. Tabela vat_period_locks
CREATE TABLE public.vat_period_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id UUID NOT NULL REFERENCES public.business_years(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_label TEXT NOT NULL,
  pp_pdv_return_id UUID REFERENCES public.pp_pdv_returns(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by UUID NOT NULL,
  unlocked_at TIMESTAMPTZ,
  unlocked_by UUID,
  unlock_reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vat_period_locks_period_check CHECK (period_end >= period_start)
);

CREATE INDEX idx_vat_period_locks_company_active
  ON public.vat_period_locks(company_id, is_active) WHERE is_active = true;
CREATE INDEX idx_vat_period_locks_period
  ON public.vat_period_locks(company_id, period_start, period_end) WHERE is_active = true;
CREATE UNIQUE INDEX idx_vat_period_locks_unique_active
  ON public.vat_period_locks(company_id, period_start, period_end) WHERE is_active = true;

ALTER TABLE public.vat_period_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vat period locks"
  ON public.vat_period_locks FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can manage vat period locks"
  ON public.vat_period_locks FOR ALL
  USING (
    has_company_access(auth.uid(), company_id)
    AND (has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'local_admin'::app_role))
  )
  WITH CHECK (
    has_company_access(auth.uid(), company_id)
    AND (has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'local_admin'::app_role))
  );

CREATE TRIGGER update_vat_period_locks_updated_at
  BEFORE UPDATE ON public.vat_period_locks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Audit log
CREATE TABLE public.vat_period_lock_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  vat_period_lock_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('lock', 'unlock')),
  performed_by UUID NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  details JSONB
);

CREATE INDEX idx_vat_period_lock_audit_company
  ON public.vat_period_lock_audit(company_id, performed_at DESC);

ALTER TABLE public.vat_period_lock_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vat period lock audit"
  ON public.vat_period_lock_audit FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "System can insert audit"
  ON public.vat_period_lock_audit FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));

-- 3. is_vat_period_locked
CREATE OR REPLACE FUNCTION public.is_vat_period_locked(
  _company_id UUID,
  _check_date DATE
)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vat_period_locks
    WHERE company_id = _company_id
      AND is_active = true
      AND _check_date BETWEEN period_start AND period_end
  );
$$;

-- 4. Generic trigger function
CREATE OR REPLACE FUNCTION public.check_vat_period_lock_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _date_field TEXT := TG_ARGV[0];
  _doc_label TEXT := TG_ARGV[1];
  _check_date DATE;
  _company UUID;
  _date_text TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    EXECUTE format('SELECT ($1).%I::text, ($1).company_id', _date_field)
      INTO _date_text, _company USING OLD;
  ELSE
    EXECUTE format('SELECT ($1).%I::text, ($1).company_id', _date_field)
      INTO _date_text, _company USING NEW;
  END IF;

  IF _date_text IS NULL OR _company IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  BEGIN
    _check_date := _date_text::date;
  EXCEPTION WHEN OTHERS THEN
    RETURN COALESCE(NEW, OLD);
  END;

  IF public.is_vat_period_locked(_company, _check_date) THEN
    IF has_role(auth.uid(), 'super_admin'::app_role) THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
    RAISE EXCEPTION 'PDV period za datum % je zaključan. Dokument "%" se ne može menjati. Otključajte period u Računovodstvo → Zaključavanje PDV perioda.',
      to_char(_check_date, 'DD.MM.YYYY'), _doc_label
      USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5. Trigeri
CREATE TRIGGER trg_vat_lock_invoices
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.check_vat_period_lock_trigger('invoice_date', 'Izlazna faktura');

CREATE TRIGGER trg_vat_lock_advance_invoices
  BEFORE INSERT OR UPDATE OR DELETE ON public.advance_invoices
  FOR EACH ROW EXECUTE FUNCTION public.check_vat_period_lock_trigger('advance_date', 'Avansna faktura (izlazna)');

CREATE TRIGGER trg_vat_lock_credit_notes
  BEFORE INSERT OR UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.check_vat_period_lock_trigger('credit_note_date', 'Knjižno odobrenje');

CREATE TRIGGER trg_vat_lock_purchase_invoices
  BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.check_vat_period_lock_trigger('invoice_date', 'UFR (ulazna faktura - roba)');

CREATE TRIGGER trg_vat_lock_service_purchase_invoices
  BEFORE INSERT OR UPDATE OR DELETE ON public.service_purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.check_vat_period_lock_trigger('invoice_date', 'UFU (ulazna faktura - usluga)');

CREATE TRIGGER trg_vat_lock_advance_purchase_invoices
  BEFORE INSERT OR UPDATE OR DELETE ON public.advance_purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.check_vat_period_lock_trigger('invoice_date', 'Avansna faktura (ulazna)');

CREATE TRIGGER trg_vat_lock_customs_clearances
  BEFORE INSERT OR UPDATE OR DELETE ON public.customs_clearances
  FOR EACH ROW EXECUTE FUNCTION public.check_vat_period_lock_trigger('clearance_date', 'Carinski obračun');

-- 6. RPC: lock_vat_period
CREATE OR REPLACE FUNCTION public.lock_vat_period(
  _pp_pdv_return_id UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ret RECORD;
  _lock_id UUID;
BEGIN
  SELECT id, company_id, business_year_id, period_start, period_end, period_label, status
  INTO _ret
  FROM public.pp_pdv_returns
  WHERE id = _pp_pdv_return_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PDV prijava nije pronađena';
  END IF;

  IF NOT has_company_access(auth.uid(), _ret.company_id) THEN
    RAISE EXCEPTION 'Nemate pristup ovoj firmi';
  END IF;

  IF NOT (has_role(auth.uid(), 'super_admin'::app_role)
       OR has_role(auth.uid(), 'local_admin'::app_role)) THEN
    RAISE EXCEPTION 'Samo administrator može da zaključa PDV period';
  END IF;

  IF _ret.status NOT IN ('finalized', 'submitted', 'posted') THEN
    RAISE EXCEPTION 'PDV prijava mora biti finalizovana ili proknjižena pre zaključavanja perioda (trenutni status: %)', _ret.status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vat_period_locks
    WHERE company_id = _ret.company_id
      AND is_active = true
      AND period_start = _ret.period_start
      AND period_end = _ret.period_end
  ) THEN
    RAISE EXCEPTION 'Period % je već zaključan', _ret.period_label;
  END IF;

  INSERT INTO public.vat_period_locks (
    company_id, business_year_id, period_start, period_end, period_label,
    pp_pdv_return_id, locked_by
  ) VALUES (
    _ret.company_id, _ret.business_year_id, _ret.period_start, _ret.period_end, _ret.period_label,
    _ret.id, auth.uid()
  ) RETURNING id INTO _lock_id;

  INSERT INTO public.vat_period_lock_audit (
    company_id, vat_period_lock_id, action, performed_by, details
  ) VALUES (
    _ret.company_id, _lock_id, 'lock', auth.uid(),
    jsonb_build_object('period_label', _ret.period_label, 'pp_pdv_return_id', _ret.id)
  );

  RETURN _lock_id;
END;
$$;

-- 7. RPC: unlock_vat_period
CREATE OR REPLACE FUNCTION public.unlock_vat_period(
  _lock_id UUID,
  _reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lock RECORD;
BEGIN
  SELECT * INTO _lock FROM public.vat_period_locks WHERE id = _lock_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lock zapis nije pronađen';
  END IF;

  IF NOT has_company_access(auth.uid(), _lock.company_id) THEN
    RAISE EXCEPTION 'Nemate pristup ovoj firmi';
  END IF;

  IF NOT (has_role(auth.uid(), 'super_admin'::app_role)
       OR has_role(auth.uid(), 'local_admin'::app_role)) THEN
    RAISE EXCEPTION 'Samo administrator može da otključa PDV period';
  END IF;

  IF NOT _lock.is_active THEN
    RAISE EXCEPTION 'Period je već otključan';
  END IF;

  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'Razlog za otključavanje je obavezan (minimum 5 karaktera)';
  END IF;

  UPDATE public.vat_period_locks
  SET is_active = false,
      unlocked_at = now(),
      unlocked_by = auth.uid(),
      unlock_reason = _reason
  WHERE id = _lock_id;

  INSERT INTO public.vat_period_lock_audit (
    company_id, vat_period_lock_id, action, performed_by, reason, details
  ) VALUES (
    _lock.company_id, _lock_id, 'unlock', auth.uid(), _reason,
    jsonb_build_object('period_label', _lock.period_label)
  );

  RETURN true;
END;
$$;