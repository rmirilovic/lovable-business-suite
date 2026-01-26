-- Add RLS policy for approving quotes (workflow action)
-- This allows users with write access to approve draft quotes

CREATE POLICY "Users can approve draft quotes"
ON public.quotes
FOR UPDATE
USING (
  status = 'draft' 
  AND can_user_write(auth.uid(), company_id, 'prodaja.ponude'::text, org_unit_id)
)
WITH CHECK (
  status = 'approved'
  AND approved_by = auth.uid()
  AND approved_at IS NOT NULL
  AND can_user_write(auth.uid(), company_id, 'prodaja.ponude'::text, org_unit_id)
);