
-- Add max_concurrent_sessions to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS max_concurrent_sessions integer DEFAULT NULL;

-- Create active_sessions table for tracking
CREATE TABLE public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_active_sessions_company ON public.active_sessions(company_id);
CREATE INDEX idx_active_sessions_user ON public.active_sessions(user_id);
CREATE INDEX idx_active_sessions_heartbeat ON public.active_sessions(last_heartbeat);

-- Enable RLS
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own sessions
CREATE POLICY "Users can insert own sessions" ON public.active_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own sessions" ON public.active_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own sessions" ON public.active_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions" ON public.active_sessions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Super admins can view all sessions
CREATE POLICY "Super admins can view all sessions" ON public.active_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Function to check if a company has available session slots
CREATE OR REPLACE FUNCTION public.check_session_limit(
  _company_id uuid,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max_sessions integer;
  _current_count integer;
  _stale_threshold timestamptz;
BEGIN
  -- Clean stale sessions first (no heartbeat for 10 minutes)
  _stale_threshold := now() - interval '10 minutes';
  DELETE FROM public.active_sessions
  WHERE company_id = _company_id
    AND last_heartbeat < _stale_threshold;

  -- Get limit
  SELECT max_concurrent_sessions INTO _max_sessions
  FROM public.companies
  WHERE id = _company_id;

  -- No limit set
  IF _max_sessions IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'current', 0, 'max', null);
  END IF;

  -- Count current sessions (exclude this user's existing sessions)
  SELECT count(*) INTO _current_count
  FROM public.active_sessions
  WHERE company_id = _company_id
    AND user_id != _user_id;

  IF _current_count >= _max_sessions THEN
    RETURN jsonb_build_object('allowed', false, 'current', _current_count, 'max', _max_sessions);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'current', _current_count, 'max', _max_sessions);
END;
$$;

-- Function to register a session
CREATE OR REPLACE FUNCTION public.register_session(
  _company_id uuid,
  _session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _check jsonb;
BEGIN
  _user_id := auth.uid();

  -- Remove any existing sessions for this user+company
  DELETE FROM public.active_sessions
  WHERE user_id = _user_id AND company_id = _company_id;

  -- Check limit
  _check := public.check_session_limit(_company_id, _user_id);

  IF NOT (_check->>'allowed')::boolean THEN
    RETURN _check;
  END IF;

  -- Insert new session
  INSERT INTO public.active_sessions (user_id, company_id, session_token)
  VALUES (_user_id, _company_id, _session_token);

  RETURN jsonb_build_object('allowed', true, 'current', (_check->>'current')::int + 1, 'max', _check->'max');
END;
$$;

-- Function to heartbeat a session
CREATE OR REPLACE FUNCTION public.heartbeat_session(
  _session_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.active_sessions
  SET last_heartbeat = now()
  WHERE session_token = _session_token
    AND user_id = auth.uid();
END;
$$;

-- Function to remove a session
CREATE OR REPLACE FUNCTION public.remove_session(
  _session_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.active_sessions
  WHERE session_token = _session_token
    AND user_id = auth.uid();
END;
$$;
