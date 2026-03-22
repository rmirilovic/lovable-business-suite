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
      AND c.status <> 'closed'
      AND (
        (c.assigned_to IS NOT NULL AND c.assigned_to = _user_id)
        OR (c.assigned_to IS NULL AND c.status = 'draft' AND c.owner_user_id = _user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_crm_case_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  can_reassign boolean;
  allowed_status_change boolean;
  assignment_changed boolean;
  case_content_changed boolean;
  status_changed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Morate biti prijavljeni.';
  END IF;

  is_admin := public.has_role(auth.uid(), 'super_admin')
    OR public.is_local_admin_for_company(auth.uid(), OLD.company_id);

  assignment_changed :=
    NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at;

  case_content_changed :=
    NEW.crm_type_id IS DISTINCT FROM OLD.crm_type_id
    OR NEW.subject IS DISTINCT FROM OLD.subject
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.partner_id IS DISTINCT FROM OLD.partner_id
    OR NEW.priority IS DISTINCT FROM OLD.priority
    OR NEW.deadline IS DISTINCT FROM OLD.deadline
    OR NEW.contact_person IS DISTINCT FROM OLD.contact_person;

  status_changed :=
    NEW.status IS DISTINCT FROM OLD.status
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

  IF assignment_changed THEN
    can_reassign :=
      is_admin
      OR (OLD.status = 'draft' AND OLD.owner_user_id = auth.uid())
      OR (
        OLD.assigned_to = auth.uid()
        AND public.get_user_access_level(auth.uid(), OLD.company_id, 'pisarnica.predmeti.predodela', NULL) IN ('write'::public.access_level, 'admin'::public.access_level)
      );

    IF NOT can_reassign THEN
      RAISE EXCEPTION 'Nemate pravo da dodelite ili predodelite predmet.';
    END IF;
  END IF;

  IF case_content_changed AND NOT public.can_edit_crm_case(OLD.id, auth.uid()) THEN
    RAISE EXCEPTION 'Samo zaduženi operater može menjati podatke na predmetu.';
  END IF;

  IF status_changed THEN
    allowed_status_change :=
      is_admin
      OR (assignment_changed AND NEW.status = 'assigned')
      OR (
        OLD.status = 'assigned'
        AND NEW.status = 'in_progress'
        AND OLD.assigned_to = auth.uid()
      )
      OR (
        OLD.status <> 'closed'
        AND NEW.status = 'closed'
        AND auth.uid() IN (OLD.owner_user_id, COALESCE(OLD.assigned_to, auth.uid()))
      );

    IF NOT allowed_status_change THEN
      RAISE EXCEPTION 'Nemate pravo da promenite status predmeta.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;