
CREATE POLICY "Users can update company on their own login logs"
ON public.login_audit_log
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
