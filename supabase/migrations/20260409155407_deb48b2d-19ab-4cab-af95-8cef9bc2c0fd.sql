
-- ============================================
-- 1. Fix advance_purchase_invoice_items
-- ============================================
DROP POLICY IF EXISTS "Users can manage advance_purchase_invoice_items" ON public.advance_purchase_invoice_items;

CREATE POLICY "Users can view their company advance purchase invoice items"
ON public.advance_purchase_invoice_items FOR SELECT TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can create their company advance purchase invoice items"
ON public.advance_purchase_invoice_items FOR INSERT TO authenticated
WITH CHECK (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can update their company advance purchase invoice items"
ON public.advance_purchase_invoice_items FOR UPDATE TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
)
WITH CHECK (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can delete their company advance purchase invoice items"
ON public.advance_purchase_invoice_items FOR DELETE TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- 2. Fix bank_statements
-- ============================================
DROP POLICY IF EXISTS "Users can view bank statements" ON public.bank_statements;
DROP POLICY IF EXISTS "Users can insert bank statements" ON public.bank_statements;
DROP POLICY IF EXISTS "Users can update bank statements" ON public.bank_statements;
DROP POLICY IF EXISTS "Users can delete bank statements" ON public.bank_statements;

CREATE POLICY "Users can view their company bank statements"
ON public.bank_statements FOR SELECT TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can create their company bank statements"
ON public.bank_statements FOR INSERT TO authenticated
WITH CHECK (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can update their company bank statements"
ON public.bank_statements FOR UPDATE TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
)
WITH CHECK (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can delete their company bank statements"
ON public.bank_statements FOR DELETE TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- 3. Fix bank_statement_items
-- ============================================
DROP POLICY IF EXISTS "Users can view bank statement items" ON public.bank_statement_items;
DROP POLICY IF EXISTS "Users can insert bank statement items" ON public.bank_statement_items;
DROP POLICY IF EXISTS "Users can update bank statement items" ON public.bank_statement_items;
DROP POLICY IF EXISTS "Users can delete bank statement items" ON public.bank_statement_items;

CREATE POLICY "Users can view their company bank statement items"
ON public.bank_statement_items FOR SELECT TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can create their company bank statement items"
ON public.bank_statement_items FOR INSERT TO authenticated
WITH CHECK (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can update their company bank statement items"
ON public.bank_statement_items FOR UPDATE TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
)
WITH CHECK (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can delete their company bank statement items"
ON public.bank_statement_items FOR DELETE TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- 4. Move sensitive fields to company_secrets
-- ============================================
CREATE TABLE public.company_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  api_token TEXT,
  api_demo_token TEXT,
  responsible_person_jmbg TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.company_secrets ENABLE ROW LEVEL SECURITY;

-- Only super_admin or local admins can access secrets
CREATE POLICY "Super admins can manage company secrets"
ON public.company_secrets FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = auth.uid() AND company_id = company_secrets.company_id AND is_local_admin = true
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = auth.uid() AND company_id = company_secrets.company_id AND is_local_admin = true
  )
);

-- Migrate existing data
INSERT INTO public.company_secrets (company_id, api_token, api_demo_token, responsible_person_jmbg)
SELECT id, api_token, api_demo_token, responsible_person_jmbg
FROM public.companies
WHERE api_token IS NOT NULL OR api_demo_token IS NOT NULL OR responsible_person_jmbg IS NOT NULL;

-- Remove sensitive columns from companies table
ALTER TABLE public.companies DROP COLUMN IF EXISTS api_token;
ALTER TABLE public.companies DROP COLUMN IF EXISTS api_demo_token;
ALTER TABLE public.companies DROP COLUMN IF EXISTS responsible_person_jmbg;
