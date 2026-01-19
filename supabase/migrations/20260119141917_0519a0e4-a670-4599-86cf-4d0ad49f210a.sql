
-- Create partner_groups table
CREATE TABLE public.partner_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Create partners table
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  legal_status smallint NOT NULL DEFAULT 1 CHECK (legal_status BETWEEN 1 AND 4),
  address text,
  postal_code text,
  city text,
  country text DEFAULT 'Republika Srbija',
  email text,
  group_id uuid REFERENCES public.partner_groups(id) ON DELETE SET NULL,
  pib text,
  mb text,
  activity_code text,
  jbkjs text,
  website text,
  responsible_person text,
  phone text,
  is_customer boolean NOT NULL DEFAULT true,
  is_supplier boolean NOT NULL DEFAULT false,
  assigned_to text,
  note text,
  other_data text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Create partner_bank_accounts table
CREATE TABLE public.partner_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_number text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create partner_contacts table
CREATE TABLE public.partner_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  position text,
  phone1 text,
  phone2 text,
  email text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_contacts ENABLE ROW LEVEL SECURITY;

-- Partner groups policies
CREATE POLICY "Users can view partner groups from their companies"
ON public.partner_groups FOR SELECT
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can insert partner groups"
ON public.partner_groups FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can update partner groups"
ON public.partner_groups FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete partner groups"
ON public.partner_groups FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

-- Partners policies
CREATE POLICY "Users can view partners from their companies"
ON public.partners FOR SELECT
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can insert partners"
ON public.partners FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can update partners"
ON public.partners FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete partners"
ON public.partners FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

-- Partner bank accounts policies
CREATE POLICY "Users can view partner bank accounts from their companies"
ON public.partner_bank_accounts FOR SELECT
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can insert partner bank accounts"
ON public.partner_bank_accounts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can update partner bank accounts"
ON public.partner_bank_accounts FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete partner bank accounts"
ON public.partner_bank_accounts FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

-- Partner contacts policies
CREATE POLICY "Users can view partner contacts from their companies"
ON public.partner_contacts FOR SELECT
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can insert partner contacts"
ON public.partner_contacts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can update partner contacts"
ON public.partner_contacts FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete partner contacts"
ON public.partner_contacts FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

-- Triggers for updated_at
CREATE TRIGGER update_partner_groups_updated_at
BEFORE UPDATE ON public.partner_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partners_updated_at
BEFORE UPDATE ON public.partners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_bank_accounts_updated_at
BEFORE UPDATE ON public.partner_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_contacts_updated_at
BEFORE UPDATE ON public.partner_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
