
-- Drop the old overloaded versions
DROP FUNCTION IF EXISTS public.register_session(uuid, text);
DROP FUNCTION IF EXISTS public.register_session(uuid, text, text, text, text, text);

-- Recreate with UPSERT logic instead of DELETE ALL
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
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _max_sessions integer;
  _current_count integer;
  _stale_threshold timestamptz;
BEGIN
  _user_id := auth.uid();
  _stale_threshold := now() - interval '10 minutes';

  -- Clean stale sessions first
  DELETE FROM public.active_sessions
  WHERE company_id = _company_id
    AND last_heartbeat < _stale_threshold;

  -- Check if this exact session token already exists (tab reload)
  IF EXISTS (
    SELECT 1 FROM public.active_sessions
    WHERE session_token = _session_token
  ) THEN
    -- Just update the existing session
    UPDATE public.active_sessions
    SET last_heartbeat = now(),
        browser = COALESCE(_browser, browser),
        os = COALESCE(_os, os),
        device_type = COALESCE(_device_type, device_type),
        ip_address = COALESCE(_ip_address, ip_address)
    WHERE session_token = _session_token;

    SELECT max_concurrent_sessions INTO _max_sessions FROM public.companies WHERE id = _company_id;
    SELECT count(*) INTO _current_count FROM public.active_sessions WHERE company_id = _company_id;

    RETURN jsonb_build_object('allowed', true, 'current', _current_count, 'max', _max_sessions);
  END IF;

  -- Get limit
  SELECT max_concurrent_sessions INTO _max_sessions
  FROM public.companies
  WHERE id = _company_id;

  -- Count current sessions for this company (all users)
  SELECT count(*) INTO _current_count
  FROM public.active_sessions
  WHERE company_id = _company_id;

  -- Check limit (if set)
  IF _max_sessions IS NOT NULL AND _current_count >= _max_sessions THEN
    RETURN jsonb_build_object('allowed', false, 'current', _current_count, 'max', _max_sessions);
  END IF;

  -- Insert new session
  INSERT INTO public.active_sessions (user_id, company_id, session_token, browser, os, device_type, ip_address)
  VALUES (_user_id, _company_id, _session_token, _browser, _os, _device_type, _ip_address);

  RETURN jsonb_build_object('allowed', true, 'current', _current_count + 1, 'max', _max_sessions);
END;
$function$;

-- Also fix check_session_limit to count all sessions (not exclude current user)
CREATE OR REPLACE FUNCTION public.check_session_limit(_company_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _max_sessions integer;
  _current_count integer;
  _stale_threshold timestamptz;
BEGIN
  _stale_threshold := now() - interval '10 minutes';
  DELETE FROM public.active_sessions
  WHERE company_id = _company_id
    AND last_heartbeat < _stale_threshold;

  SELECT max_concurrent_sessions INTO _max_sessions
  FROM public.companies
  WHERE id = _company_id;

  IF _max_sessions IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'current', 0, 'max', null);
  END IF;

  -- Count ALL current sessions for the company
  SELECT count(*) INTO _current_count
  FROM public.active_sessions
  WHERE company_id = _company_id;

  IF _current_count >= _max_sessions THEN
    RETURN jsonb_build_object('allowed', false, 'current', _current_count, 'max', _max_sessions);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'current', _current_count, 'max', _max_sessions);
END;
$function$;
