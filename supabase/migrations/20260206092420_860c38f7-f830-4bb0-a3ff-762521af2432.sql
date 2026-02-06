-- Function to unpost a journal entry
-- Only users with can_unpost permission OR admin access can use this
CREATE OR REPLACE FUNCTION public.unpost_journal_entry(_entry_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _entry journal_entries%ROWTYPE;
  _access_level text;
  _can_unpost boolean;
BEGIN
  -- Get the journal entry
  SELECT * INTO _entry FROM journal_entries WHERE id = _entry_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nalog za knjiženje nije pronađen';
  END IF;
  
  IF _entry.status != 'posted' THEN
    RAISE EXCEPTION 'Samo proknjiženi nalozi mogu biti poništeni';
  END IF;
  
  -- Check if entry was created from another document (invoice, purchase invoice, etc.)
  IF _entry.source_document_type IS NOT NULL AND _entry.source_document_id IS NOT NULL THEN
    RAISE EXCEPTION 'Nalog kreiran iz drugog dokumenta (%) se poništava kroz originalni dokument', _entry.source_document_type;
  END IF;
  
  -- Check user permissions on racunovodstvo.nalozi module
  _access_level := get_user_access_level(_user_id, _entry.company_id, 'racunovodstvo.nalozi', _entry.org_unit_id);
  
  -- Admin always can unpost
  IF _access_level = 'admin' THEN
    -- Proceed with unpost
    NULL;
  ELSE
    -- Check can_unpost permission
    SELECT COALESCE(bool_or(rp.can_unpost), false) INTO _can_unpost
    FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE ura.user_id = _user_id
      AND ura.company_id = _entry.company_id
      AND ura.is_active = true
      AND rp.module_code = 'racunovodstvo.nalozi'
      AND (ura.org_unit_id IS NULL OR ura.org_unit_id = _entry.org_unit_id);
    
    -- Also check overrides
    IF NOT _can_unpost THEN
      SELECT can_unpost INTO _can_unpost
      FROM public.user_permission_overrides
      WHERE user_id = _user_id 
        AND company_id = _entry.company_id 
        AND module_code = 'racunovodstvo.nalozi'
        AND (org_unit_id = _entry.org_unit_id OR org_unit_id IS NULL)
      LIMIT 1;
    END IF;
    
    IF NOT COALESCE(_can_unpost, false) THEN
      RAISE EXCEPTION 'Nemate dozvolu za storniranje naloga za knjiženje';
    END IF;
  END IF;
  
  -- Unpost the journal entry
  UPDATE journal_entries
  SET status = 'draft',
      posted_at = NULL,
      posted_by = NULL
  WHERE id = _entry_id;
  
  RETURN TRUE;
END;
$$;