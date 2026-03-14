
-- Create update_updated_at function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create incoming mail table
CREATE TABLE public.incoming_mail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id UUID NOT NULL REFERENCES public.business_years(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  mail_number TEXT NOT NULL,
  registration_date DATE,
  document_type TEXT NOT NULL,
  document_number TEXT NOT NULL,
  document_date DATE NOT NULL,
  partner_id UUID REFERENCES public.partners(id),
  sender_name TEXT NOT NULL,
  sender_pib TEXT,
  sender_mb TEXT,
  amount NUMERIC(15,2),
  note VARCHAR(127),
  is_correct BOOLEAN DEFAULT true,
  incorrect_reason TEXT,
  attachment_path TEXT,
  attachment_name TEXT,
  liquidator_user_id UUID,
  liquidator_name TEXT,
  archive_label VARCHAR(15),
  cost_center_distribution VARCHAR(31),
  liquidation_date DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT incoming_mail_number_unique UNIQUE (company_id, business_year_id, mail_number)
);

ALTER TABLE public.incoming_mail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view incoming mail for their company"
  ON public.incoming_mail FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT ura.company_id FROM public.user_role_assignments ura 
    WHERE ura.user_id = auth.uid() AND ura.is_active = true
  ));

CREATE POLICY "Users can insert incoming mail"
  ON public.incoming_mail FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT ura.company_id FROM public.user_role_assignments ura 
    WHERE ura.user_id = auth.uid() AND ura.is_active = true
  ));

CREATE POLICY "Users can update incoming mail"
  ON public.incoming_mail FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT ura.company_id FROM public.user_role_assignments ura 
    WHERE ura.user_id = auth.uid() AND ura.is_active = true
  ));

CREATE POLICY "Users can delete incoming mail"
  ON public.incoming_mail FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT ura.company_id FROM public.user_role_assignments ura 
    WHERE ura.user_id = auth.uid() AND ura.is_active = true
  ));

CREATE INDEX idx_incoming_mail_company_year ON public.incoming_mail(company_id, business_year_id);
CREATE INDEX idx_incoming_mail_status ON public.incoming_mail(status);
CREATE INDEX idx_incoming_mail_liquidator ON public.incoming_mail(liquidator_user_id, status);

CREATE TRIGGER incoming_mail_updated_at
  BEFORE UPDATE ON public.incoming_mail
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

INSERT INTO storage.buckets (id, name, public) VALUES ('mail-attachments', 'mail-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload mail attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mail-attachments');

CREATE POLICY "Authenticated users can view mail attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mail-attachments');

CREATE POLICY "Authenticated users can delete mail attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mail-attachments');
