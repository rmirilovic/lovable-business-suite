CREATE POLICY "Users can set approved quotes to renewed"
ON public.quotes
FOR UPDATE
USING (
  status = 'approved'::document_status
  AND can_user_write(auth.uid(), company_id, 'prodaja.ponude'::text, org_unit_id)
)
WITH CHECK (
  status = 'renewed'::document_status
  AND can_user_write(auth.uid(), company_id, 'prodaja.ponude'::text, org_unit_id)
);