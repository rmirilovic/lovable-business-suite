
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  code VARCHAR(15) NOT NULL,
  account_number VARCHAR(31) NOT NULL,
  bank_name VARCHAR(63) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bank accounts"
  ON public.bank_accounts FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can insert bank accounts"
  ON public.bank_accounts FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can update bank accounts"
  ON public.bank_accounts FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can delete bank accounts"
  ON public.bank_accounts FOR DELETE
  USING (has_company_access(auth.uid(), company_id));

CREATE OR REPLACE FUNCTION public.ensure_single_default_bank_account()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.bank_accounts SET is_default = false
    WHERE company_id = NEW.company_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_single_default_bank_account
BEFORE INSERT OR UPDATE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_bank_account();

CREATE TRIGGER update_bank_accounts_updated_at
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
