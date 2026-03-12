
CREATE TABLE public.payment_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_document_type TEXT,
  source_document_id UUID,
  source_document_number TEXT,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  partner_name TEXT,
  partner_code TEXT,
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_document_number TEXT,
  supplier_document_date DATE,
  due_date DATE,
  document_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  previously_paid NUMERIC(15,2) NOT NULL DEFAULT 0,
  approved_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  partner_bank_account TEXT,
  payment_reference TEXT,
  nbs_payment_code TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_date DATE,
  sent_date DATE,
  paid_date DATE,
  paid_amount NUMERIC(15,2),
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment orders for their company"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert payment orders for their company"
  ON public.payment_orders FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
  ));

CREATE POLICY "Users can update payment orders for their company"
  ON public.payment_orders FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete payment orders for their company"
  ON public.payment_orders FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
  ));

CREATE INDEX idx_payment_orders_company ON public.payment_orders(company_id);
CREATE INDEX idx_payment_orders_source ON public.payment_orders(source_document_id);
CREATE INDEX idx_payment_orders_partner ON public.payment_orders(partner_id);
