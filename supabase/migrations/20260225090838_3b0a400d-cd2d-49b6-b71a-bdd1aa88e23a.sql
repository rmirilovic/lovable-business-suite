-- Allow reverting approved quotes back to draft
CREATE POLICY "Users can revert approved quotes to draft"
ON public.quotes
FOR UPDATE
USING (
  status = 'approved'::document_status
  AND converted_to_invoice_id IS NULL
  AND can_user_write(auth.uid(), company_id, 'prodaja.ponude'::text, org_unit_id)
)
WITH CHECK (
  status = 'draft'::document_status
  AND approved_by IS NULL
  AND approved_at IS NULL
  AND can_user_write(auth.uid(), company_id, 'prodaja.ponude'::text, org_unit_id)
);