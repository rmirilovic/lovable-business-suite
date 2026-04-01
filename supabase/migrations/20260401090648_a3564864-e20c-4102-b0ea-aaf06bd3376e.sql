
CREATE TABLE public.login_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT,
  user_name TEXT,
  company_id UUID,
  company_name TEXT,
  login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  browser TEXT,
  os TEXT,
  device_type TEXT,
  screen_resolution TEXT,
  locale TEXT,
  ip_address TEXT,
  user_agent TEXT
);

ALTER TABLE public.login_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all login audit logs"
ON public.login_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);

CREATE POLICY "Authenticated users can insert their own login logs"
ON public.login_audit_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_login_audit_log_login_at ON public.login_audit_log (login_at DESC);
CREATE INDEX idx_login_audit_log_user_id ON public.login_audit_log (user_id);
