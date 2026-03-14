
CREATE TABLE public.outgoing_mail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id UUID NOT NULL REFERENCES public.business_years(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  mail_number TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_number TEXT NOT NULL DEFAULT '',
  document_date TEXT NOT NULL DEFAULT '',
  registration_date TEXT,
  recipient_partner_id UUID REFERENCES public.partners(id),
  recipient_name TEXT NOT NULL DEFAULT '',
  recipient_address TEXT,
  amount NUMERIC(15,2),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outgoing_mail_company ON public.outgoing_mail(company_id, business_year_id);
CREATE INDEX idx_outgoing_mail_number ON public.outgoing_mail(mail_number);

ALTER TABLE public.outgoing_mail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view outgoing mail for their companies"
  ON public.outgoing_mail FOR SELECT
  USING (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Users can insert outgoing mail for their companies"
  ON public.outgoing_mail FOR INSERT
  WITH CHECK (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Users can update outgoing mail for their companies"
  ON public.outgoing_mail FOR UPDATE
  USING (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Users can delete outgoing mail for their companies"
  ON public.outgoing_mail FOR DELETE
  USING (
    has_company_access(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE TRIGGER outgoing_mail_updated_at
  BEFORE UPDATE ON public.outgoing_mail
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER log_outgoing_mail_changes AFTER INSERT OR UPDATE OR DELETE ON public.outgoing_mail
  FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('outgoing_mail');
