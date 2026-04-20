-- ============================================
-- advance_purchase_invoices
-- ============================================
DROP POLICY IF EXISTS "Users can manage advance_purchase_invoices" ON public.advance_purchase_invoices;
DROP POLICY IF EXISTS "Users can view advance_purchase_invoices" ON public.advance_purchase_invoices;
DROP POLICY IF EXISTS "Users can insert advance_purchase_invoices" ON public.advance_purchase_invoices;
DROP POLICY IF EXISTS "Users can update advance_purchase_invoices" ON public.advance_purchase_invoices;
DROP POLICY IF EXISTS "Users can delete advance_purchase_invoices" ON public.advance_purchase_invoices;

CREATE POLICY "advance_purchase_invoices_select"
  ON public.advance_purchase_invoices FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "advance_purchase_invoices_insert"
  ON public.advance_purchase_invoices FOR INSERT TO authenticated
  WITH CHECK (has_company_access(auth.uid(), company_id)
              OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "advance_purchase_invoices_update"
  ON public.advance_purchase_invoices FOR UPDATE TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (has_company_access(auth.uid(), company_id)
              OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "advance_purchase_invoices_delete"
  ON public.advance_purchase_invoices FOR DELETE TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- ============================================
-- article_variants
-- ============================================
DROP POLICY IF EXISTS "Users can view article variants" ON public.article_variants;
DROP POLICY IF EXISTS "Users can insert article variants" ON public.article_variants;
DROP POLICY IF EXISTS "Users can update article variants" ON public.article_variants;
DROP POLICY IF EXISTS "Users can delete article variants" ON public.article_variants;
DROP POLICY IF EXISTS "Users can manage article variants" ON public.article_variants;

CREATE POLICY "article_variants_select"
  ON public.article_variants FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "article_variants_insert"
  ON public.article_variants FOR INSERT TO authenticated
  WITH CHECK (has_company_access(auth.uid(), company_id)
              OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "article_variants_update"
  ON public.article_variants FOR UPDATE TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (has_company_access(auth.uid(), company_id)
              OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "article_variants_delete"
  ON public.article_variants FOR DELETE TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- ============================================
-- article_variant_assignments
-- ============================================
DROP POLICY IF EXISTS "Users can manage article variant assignments" ON public.article_variant_assignments;
DROP POLICY IF EXISTS "Users can view article variant assignments" ON public.article_variant_assignments;
DROP POLICY IF EXISTS "Users can insert article variant assignments" ON public.article_variant_assignments;
DROP POLICY IF EXISTS "Users can update article variant assignments" ON public.article_variant_assignments;
DROP POLICY IF EXISTS "Users can delete article variant assignments" ON public.article_variant_assignments;

CREATE POLICY "article_variant_assignments_select"
  ON public.article_variant_assignments FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "article_variant_assignments_insert"
  ON public.article_variant_assignments FOR INSERT TO authenticated
  WITH CHECK (has_company_access(auth.uid(), company_id)
              OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "article_variant_assignments_update"
  ON public.article_variant_assignments FOR UPDATE TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (has_company_access(auth.uid(), company_id)
              OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "article_variant_assignments_delete"
  ON public.article_variant_assignments FOR DELETE TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- ============================================
-- variant_swaps
-- ============================================
DROP POLICY IF EXISTS "Users can manage variant swaps" ON public.variant_swaps;
DROP POLICY IF EXISTS "Users can view variant swaps" ON public.variant_swaps;
DROP POLICY IF EXISTS "Users can insert variant swaps" ON public.variant_swaps;
DROP POLICY IF EXISTS "Users can update variant swaps" ON public.variant_swaps;
DROP POLICY IF EXISTS "Users can delete variant swaps" ON public.variant_swaps;

CREATE POLICY "variant_swaps_select"
  ON public.variant_swaps FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "variant_swaps_insert"
  ON public.variant_swaps FOR INSERT TO authenticated
  WITH CHECK (has_company_access(auth.uid(), company_id)
              OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "variant_swaps_update"
  ON public.variant_swaps FOR UPDATE TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (has_company_access(auth.uid(), company_id)
              OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "variant_swaps_delete"
  ON public.variant_swaps FOR DELETE TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- ============================================
-- customs_clearance_posting_schema
-- ============================================
DROP POLICY IF EXISTS "Users can manage customs clearance posting schema" ON public.customs_clearance_posting_schema;
DROP POLICY IF EXISTS "Users can view customs clearance posting schema" ON public.customs_clearance_posting_schema;
DROP POLICY IF EXISTS "Users can insert customs clearance posting schema" ON public.customs_clearance_posting_schema;
DROP POLICY IF EXISTS "Users can update customs clearance posting schema" ON public.customs_clearance_posting_schema;
DROP POLICY IF EXISTS "Users can delete customs clearance posting schema" ON public.customs_clearance_posting_schema;

CREATE POLICY "customs_clearance_posting_schema_select"
  ON public.customs_clearance_posting_schema FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "customs_clearance_posting_schema_insert"
  ON public.customs_clearance_posting_schema FOR INSERT TO authenticated
  WITH CHECK (has_company_access(auth.uid(), company_id)
              OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "customs_clearance_posting_schema_update"
  ON public.customs_clearance_posting_schema FOR UPDATE TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (has_company_access(auth.uid(), company_id)
              OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "customs_clearance_posting_schema_delete"
  ON public.customs_clearance_posting_schema FOR DELETE TO authenticated
  USING (has_company_access(auth.uid(), company_id)
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- ============================================
-- payment_codes (uklanjam permisivne 'true' politike)
-- ============================================
DROP POLICY IF EXISTS "Users can view payment codes" ON public.payment_codes;
DROP POLICY IF EXISTS "Users can insert payment codes" ON public.payment_codes;
DROP POLICY IF EXISTS "Users can update payment codes" ON public.payment_codes;
DROP POLICY IF EXISTS "Users can delete payment codes" ON public.payment_codes;
DROP POLICY IF EXISTS "Users can manage payment codes" ON public.payment_codes;

-- ============================================
-- document_history (sprečavam falsifikovanje audit log-a)
-- ============================================
DROP POLICY IF EXISTS "System can insert document history" ON public.document_history;
DROP POLICY IF EXISTS "Users can insert document history" ON public.document_history;

CREATE POLICY "document_history_insert"
  ON public.document_history FOR INSERT TO authenticated
  WITH CHECK (
    (has_company_access(auth.uid(), company_id) AND changed_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );