CREATE OR REPLACE FUNCTION public.get_company_users_for_display(_company_id uuid)
RETURNS TABLE(id uuid, first_name text, last_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    p.id,
    COALESCE(p.first_name, ''),
    COALESCE(p.last_name, ''),
    COALESCE(p.email, '')
  FROM public.profiles p
  WHERE public.has_company_access(auth.uid(), _company_id)
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_companies uc
        WHERE uc.company_id = _company_id
          AND uc.user_id = p.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_role_assignments ura
        WHERE ura.company_id = _company_id
          AND ura.user_id = p.id
          AND ura.is_active = true
          AND (ura.valid_from IS NULL OR ura.valid_from <= CURRENT_DATE)
          AND (ura.valid_to IS NULL OR ura.valid_to >= CURRENT_DATE)
      )
      OR public.has_role(p.id, 'super_admin')
      OR EXISTS (
        SELECT 1
        FROM public.crm_cases c
        WHERE c.company_id = _company_id
          AND (c.owner_user_id = p.id OR c.assigned_to = p.id OR c.created_by = p.id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.crm_workflow w
        JOIN public.crm_cases c ON c.id = w.case_id
        WHERE c.company_id = _company_id
          AND w.performed_by = p.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.crm_communications cm
        JOIN public.crm_cases c ON c.id = cm.case_id
        WHERE c.company_id = _company_id
          AND cm.created_by = p.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.crm_documents d
        JOIN public.crm_cases c ON c.id = d.case_id
        WHERE c.company_id = _company_id
          AND d.uploaded_by = p.id
      )
    )
  ORDER BY 2, 3, 4;
$$;

REVOKE ALL ON FUNCTION public.get_company_users_for_display(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_users_for_display(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_edit_crm_case(_case_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.crm_cases c
    WHERE c.id = _case_id
      AND (
        public.has_role(_user_id, 'super_admin')
        OR public.is_local_admin_for_company(_user_id, c.company_id)
        OR (
          c.status <> 'closed'
          AND (
            (c.assigned_to IS NOT NULL AND c.assigned_to = _user_id)
            OR (c.assigned_to IS NULL AND c.status = 'draft' AND c.owner_user_id = _user_id)
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_edit_crm_case(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_crm_case(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_crm_case_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  can_reassign boolean;
  assignment_changed boolean;
  non_assignment_fields_changed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Morate biti prijavljeni.';
  END IF;

  is_admin := public.has_role(auth.uid(), 'super_admin')
    OR public.is_local_admin_for_company(auth.uid(), OLD.company_id);

  assignment_changed :=
    NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at;

  non_assignment_fields_changed :=
    NEW.crm_type_id IS DISTINCT FROM OLD.crm_type_id
    OR NEW.subject IS DISTINCT FROM OLD.subject
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.partner_id IS DISTINCT FROM OLD.partner_id
    OR NEW.priority IS DISTINCT FROM OLD.priority
    OR NEW.deadline IS DISTINCT FROM OLD.deadline
    OR NEW.contact_person IS DISTINCT FROM OLD.contact_person
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.closing_reason IS DISTINCT FROM OLD.closing_reason
    OR NEW.closed_at IS DISTINCT FROM OLD.closed_at;

  IF NOT is_admin AND (
    NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.case_number IS DISTINCT FROM OLD.case_number
    OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Nije dozvoljena izmena sistemskih podataka predmeta.';
  END IF;

  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF assignment_changed THEN
    can_reassign :=
      (OLD.status = 'draft' AND OLD.owner_user_id = auth.uid())
      OR (
        OLD.assigned_to = auth.uid()
        AND public.get_user_access_level(auth.uid(), OLD.company_id, 'pisarnica.predmeti.predodela', NULL) IN ('write'::public.access_level, 'admin'::public.access_level)
      );

    IF NOT can_reassign THEN
      RAISE EXCEPTION 'Nemate pravo da dodelite ili predodelite predmet.';
    END IF;
  END IF;

  IF non_assignment_fields_changed AND NOT public.can_edit_crm_case(OLD.id, auth.uid()) THEN
    RAISE EXCEPTION 'Samo zaduženi operater može menjati otvoren predmet.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_crm_case_update ON public.crm_cases;
CREATE TRIGGER validate_crm_case_update
BEFORE UPDATE ON public.crm_cases
FOR EACH ROW
EXECUTE FUNCTION public.validate_crm_case_update();