CREATE OR REPLACE FUNCTION public.register_session(
  _company_id uuid,
  _session_token text,
  _browser text DEFAULT NULL,
  _os text DEFAULT NULL,
  _device_type text DEFAULT NULL,
  _ip_address text DEFAULT NULL
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

  -- Insert new session with device info
  INSERT INTO public.active_sessions (user_id, company_id, session_token, browser, os, device_type, ip_address)
  VALUES (_user_id, _company_id, _session_token, _browser, _os, _device_type, _ip_address);

  RETURN jsonb_build_object('allowed', true, 'current', (_check->>'current')::int + 1, 'max', _check->'max');
END;
$$;