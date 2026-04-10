
-- Replace remove_session to allow super_admins to remove any session
CREATE OR REPLACE FUNCTION public.remove_session(_session_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if it's your own session OR you are a super_admin
  IF EXISTS (
    SELECT 1 FROM public.active_sessions
    WHERE session_token = _session_token AND user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'super_admin') THEN
    DELETE FROM public.active_sessions WHERE session_token = _session_token;
  END IF;
END;
$$;

-- Add DELETE policy for super admins
CREATE POLICY "Super admins can delete any session"
ON public.active_sessions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'::app_role
  )
);
