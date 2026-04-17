-- ============================================================================
-- WAC Reconciliation Service - Database Schema (v2)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.wac_recon_status AS ENUM ('draft', 'previewed', 'applied', 'reverted', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wac_recon_trigger AS ENUM ('manual', 'auto', 'cron');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.wac_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id uuid REFERENCES public.business_years(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL,
  reconcile_from_date date NOT NULL,
  reconcile_to_date date,
  trigger_type public.wac_recon_trigger NOT NULL DEFAULT 'manual',
  trigger_source_type text,
  trigger_source_id uuid,
  status public.wac_recon_status NOT NULL DEFAULT 'draft',
  affected_documents_count integer NOT NULL DEFAULT 0,
  affected_articles_count integer NOT NULL DEFAULT 0,
  total_value_difference numeric(18, 4) NOT NULL DEFAULT 0,
  correction_journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  previewed_at timestamp with time zone,
  previewed_by uuid,
  applied_at timestamp with time zone,
  applied_by uuid,
  reverted_at timestamp with time zone,
  reverted_by uuid,
  override_pdv_period boolean NOT NULL DEFAULT false,
  override_reason text,
  notes text,
  error_message text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wac_recon_runs_company ON public.wac_reconciliation_runs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wac_recon_runs_warehouse ON public.wac_reconciliation_runs(company_id, warehouse_id, reconcile_from_date);
CREATE INDEX IF NOT EXISTS idx_wac_recon_runs_status ON public.wac_reconciliation_runs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_wac_recon_runs_business_year ON public.wac_reconciliation_runs(business_year_id);

CREATE TABLE IF NOT EXISTS public.wac_reconciliation_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.wac_reconciliation_runs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_id uuid NOT NULL,
  document_item_id uuid NOT NULL,
  document_number text,
  document_date date NOT NULL,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.article_variants(id) ON DELETE SET NULL,
  quantity numeric(18, 6) NOT NULL DEFAULT 0,
  old_unit_cost numeric(18, 6) NOT NULL DEFAULT 0,
  new_unit_cost numeric(18, 6) NOT NULL DEFAULT 0,
  old_total_cost numeric(18, 4) NOT NULL DEFAULT 0,
  new_total_cost numeric(18, 4) NOT NULL DEFAULT 0,
  cost_difference numeric(18, 4) NOT NULL DEFAULT 0,
  account_code text,
  cost_center_code text,
  processing_order integer NOT NULL DEFAULT 0,
  applied boolean NOT NULL DEFAULT false,
  applied_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wac_recon_changes_run ON public.wac_reconciliation_changes(run_id, processing_order);
CREATE INDEX IF NOT EXISTS idx_wac_recon_changes_doc ON public.wac_reconciliation_changes(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_wac_recon_changes_article ON public.wac_reconciliation_changes(company_id, warehouse_id, article_id, document_date);
CREATE INDEX IF NOT EXISTS idx_wac_recon_changes_account ON public.wac_reconciliation_changes(run_id, account_code);

CREATE TABLE IF NOT EXISTS public.wac_reconciliation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.wac_reconciliation_runs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid NOT NULL,
  performed_at timestamp with time zone NOT NULL DEFAULT now(),
  details jsonb,
  ip_address text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_wac_recon_audit_run ON public.wac_reconciliation_audit_log(run_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_wac_recon_audit_company ON public.wac_reconciliation_audit_log(company_id, performed_at DESC);

CREATE OR REPLACE FUNCTION public.update_wac_recon_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wac_recon_runs_updated_at ON public.wac_reconciliation_runs;
CREATE TRIGGER trg_wac_recon_runs_updated_at
  BEFORE UPDATE ON public.wac_reconciliation_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wac_recon_updated_at();

ALTER TABLE public.wac_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wac_reconciliation_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wac_reconciliation_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wac_runs_select" ON public.wac_reconciliation_runs;
CREATE POLICY "wac_runs_select" ON public.wac_reconciliation_runs
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "wac_runs_insert" ON public.wac_reconciliation_runs;
CREATE POLICY "wac_runs_insert" ON public.wac_reconciliation_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_company_access(auth.uid(), company_id)
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.is_local_admin_for_company(auth.uid(), company_id)
    )
  );

DROP POLICY IF EXISTS "wac_runs_update" ON public.wac_reconciliation_runs;
CREATE POLICY "wac_runs_update" ON public.wac_reconciliation_runs
  FOR UPDATE TO authenticated
  USING (
    public.has_company_access(auth.uid(), company_id)
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.is_local_admin_for_company(auth.uid(), company_id)
    )
  );

DROP POLICY IF EXISTS "wac_runs_delete" ON public.wac_reconciliation_runs;
CREATE POLICY "wac_runs_delete" ON public.wac_reconciliation_runs
  FOR DELETE TO authenticated
  USING (
    public.has_company_access(auth.uid(), company_id)
    AND status = 'draft'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.is_local_admin_for_company(auth.uid(), company_id)
    )
  );

DROP POLICY IF EXISTS "wac_changes_select" ON public.wac_reconciliation_changes;
CREATE POLICY "wac_changes_select" ON public.wac_reconciliation_changes
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "wac_changes_insert" ON public.wac_reconciliation_changes;
CREATE POLICY "wac_changes_insert" ON public.wac_reconciliation_changes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_company_access(auth.uid(), company_id)
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.is_local_admin_for_company(auth.uid(), company_id)
    )
  );

DROP POLICY IF EXISTS "wac_changes_update" ON public.wac_reconciliation_changes;
CREATE POLICY "wac_changes_update" ON public.wac_reconciliation_changes
  FOR UPDATE TO authenticated
  USING (
    public.has_company_access(auth.uid(), company_id)
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.is_local_admin_for_company(auth.uid(), company_id)
    )
  );

DROP POLICY IF EXISTS "wac_changes_delete" ON public.wac_reconciliation_changes;
CREATE POLICY "wac_changes_delete" ON public.wac_reconciliation_changes
  FOR DELETE TO authenticated
  USING (
    public.has_company_access(auth.uid(), company_id)
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.is_local_admin_for_company(auth.uid(), company_id)
    )
  );

DROP POLICY IF EXISTS "wac_audit_select" ON public.wac_reconciliation_audit_log;
CREATE POLICY "wac_audit_select" ON public.wac_reconciliation_audit_log
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "wac_audit_insert" ON public.wac_reconciliation_audit_log;
CREATE POLICY "wac_audit_insert" ON public.wac_reconciliation_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(auth.uid(), company_id));