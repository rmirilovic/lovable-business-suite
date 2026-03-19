CREATE TABLE public.crm_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

ALTER TABLE public.crm_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage crm_types for their company"
  ON public.crm_types FOR ALL TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE TABLE public.crm_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  crm_type_id uuid NOT NULL REFERENCES public.crm_types(id),
  case_number text NOT NULL,
  subject text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  priority text NOT NULL DEFAULT 'normal',
  partner_id uuid REFERENCES public.partners(id),
  owner_user_id uuid NOT NULL,
  assigned_to uuid,
  deadline timestamptz,
  closed_at timestamptz,
  closing_reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, case_number)
);

ALTER TABLE public.crm_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage crm_cases for their company"
  ON public.crm_cases FOR ALL TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

CREATE TABLE public.crm_workflow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.crm_cases(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  from_status text,
  to_status text,
  note text,
  performed_by uuid NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_workflow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage crm_workflow"
  ON public.crm_workflow FOR ALL TO authenticated
  USING (case_id IN (SELECT id FROM public.crm_cases WHERE company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid())))
  WITH CHECK (case_id IN (SELECT id FROM public.crm_cases WHERE company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid())));

CREATE TABLE public.crm_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.crm_cases(id) ON DELETE CASCADE,
  comm_type text NOT NULL DEFAULT 'note',
  direction text,
  subject text,
  body text,
  contact_name text,
  contact_info text,
  comm_date timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage crm_communications"
  ON public.crm_communications FOR ALL TO authenticated
  USING (case_id IN (SELECT id FROM public.crm_cases WHERE company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid())))
  WITH CHECK (case_id IN (SELECT id FROM public.crm_cases WHERE company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid())));

CREATE TABLE public.crm_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.crm_cases(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  description text,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage crm_documents"
  ON public.crm_documents FOR ALL TO authenticated
  USING (case_id IN (SELECT id FROM public.crm_cases WHERE company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid())))
  WITH CHECK (case_id IN (SELECT id FROM public.crm_cases WHERE company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid())));

INSERT INTO storage.buckets (id, name, public) VALUES ('crm-documents', 'crm-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can manage crm documents"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'crm-documents')
  WITH CHECK (bucket_id = 'crm-documents');