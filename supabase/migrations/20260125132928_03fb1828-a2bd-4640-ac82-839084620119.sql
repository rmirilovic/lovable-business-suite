-- =====================================================
-- FAZA 1: SISTEM DOZVOLA
-- =====================================================

-- 1. ENUM za nivoe pristupa
CREATE TYPE public.access_level AS ENUM ('none', 'read', 'write', 'admin');

-- 2. ENUM za tipove modula
CREATE TYPE public.module_type AS ENUM (
  'sifarnici',
  'robno_materijalno', 
  'proizvodnja',
  'nabavka',
  'prodaja',
  'finansije',
  'racunovodstvo',
  'administracija'
);

-- 3. Tabela MODULI - definicije sistemskih modula
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  module_type module_type NOT NULL,
  parent_code TEXT REFERENCES public.modules(code) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tabela ULOGE - definicije uloga u firmi
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- 5. Tabela DOZVOLE ULOGA - mapiranje uloga na module sa nivoima pristupa
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL REFERENCES public.modules(code) ON DELETE CASCADE,
  access_level access_level NOT NULL DEFAULT 'none',
  can_post BOOLEAN NOT NULL DEFAULT false,
  can_unpost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, module_code)
);

-- 6. Tabela DODELA ULOGA KORISNICIMA
CREATE TABLE public.user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  org_unit_id UUID REFERENCES public.organizational_units(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from DATE,
  valid_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id, role_id, org_unit_id)
);

-- 7. Tabela INDIVIDUALNI IZUZECI - override za specifične korisnike
CREATE TABLE public.user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL REFERENCES public.modules(code) ON DELETE CASCADE,
  org_unit_id UUID REFERENCES public.organizational_units(id) ON DELETE SET NULL,
  access_level access_level NOT NULL,
  can_post BOOLEAN,
  can_unpost BOOLEAN,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id, module_code, org_unit_id)
);

-- =====================================================
-- FUNKCIJE ZA PROVERU DOZVOLA
-- =====================================================

-- Funkcija za dobijanje efektivnog nivoa pristupa korisnika za modul
CREATE OR REPLACE FUNCTION public.get_user_access_level(
  _user_id UUID,
  _company_id UUID,
  _module_code TEXT,
  _org_unit_id UUID DEFAULT NULL
)
RETURNS access_level
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  override_level access_level;
  role_level access_level;
  max_level access_level := 'none';
BEGIN
  -- Super admin ima uvek admin pristup
  IF public.has_role(_user_id, 'super_admin') THEN
    RETURN 'admin';
  END IF;

  -- Local admin za firmu ima admin pristup
  IF public.is_local_admin_for_company(_user_id, _company_id) THEN
    RETURN 'admin';
  END IF;

  -- Proveri override za korisnika (specifičan za org jedinicu ili globalan)
  SELECT access_level INTO override_level
  FROM public.user_permission_overrides
  WHERE user_id = _user_id 
    AND company_id = _company_id 
    AND module_code = _module_code
    AND (org_unit_id = _org_unit_id OR (org_unit_id IS NULL AND _org_unit_id IS NULL))
  LIMIT 1;
  
  IF override_level IS NOT NULL THEN
    RETURN override_level;
  END IF;

  -- Uzmi maksimalni nivo iz dodeljenih uloga
  SELECT MAX(rp.access_level) INTO max_level
  FROM public.user_role_assignments ura
  JOIN public.role_permissions rp ON rp.role_id = ura.role_id
  WHERE ura.user_id = _user_id
    AND ura.company_id = _company_id
    AND ura.is_active = true
    AND rp.module_code = _module_code
    AND (ura.org_unit_id IS NULL OR ura.org_unit_id = _org_unit_id)
    AND (ura.valid_from IS NULL OR ura.valid_from <= CURRENT_DATE)
    AND (ura.valid_to IS NULL OR ura.valid_to >= CURRENT_DATE);

  RETURN COALESCE(max_level, 'none');
END;
$$;

-- Funkcija za proveru da li korisnik može knjižiti
CREATE OR REPLACE FUNCTION public.can_user_post(
  _user_id UUID,
  _company_id UUID,
  _module_code TEXT,
  _org_unit_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  override_can_post BOOLEAN;
  role_can_post BOOLEAN := false;
BEGIN
  -- Super admin i local admin mogu sve
  IF public.has_role(_user_id, 'super_admin') OR public.is_local_admin_for_company(_user_id, _company_id) THEN
    RETURN true;
  END IF;

  -- Proveri override
  SELECT can_post INTO override_can_post
  FROM public.user_permission_overrides
  WHERE user_id = _user_id 
    AND company_id = _company_id 
    AND module_code = _module_code
    AND (org_unit_id = _org_unit_id OR org_unit_id IS NULL)
  LIMIT 1;
  
  IF override_can_post IS NOT NULL THEN
    RETURN override_can_post;
  END IF;

  -- Proveri iz uloga
  SELECT COALESCE(bool_or(rp.can_post), false) INTO role_can_post
  FROM public.user_role_assignments ura
  JOIN public.role_permissions rp ON rp.role_id = ura.role_id
  WHERE ura.user_id = _user_id
    AND ura.company_id = _company_id
    AND ura.is_active = true
    AND rp.module_code = _module_code
    AND (ura.org_unit_id IS NULL OR ura.org_unit_id = _org_unit_id);

  RETURN role_can_post;
END;
$$;

-- Funkcija za proveru čitanja (read ili više)
CREATE OR REPLACE FUNCTION public.can_user_read(
  _user_id UUID,
  _company_id UUID,
  _module_code TEXT,
  _org_unit_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_access_level(_user_id, _company_id, _module_code, _org_unit_id) 
    IN ('read', 'write', 'admin')
$$;

-- Funkcija za proveru pisanja (write ili admin)
CREATE OR REPLACE FUNCTION public.can_user_write(
  _user_id UUID,
  _company_id UUID,
  _module_code TEXT,
  _org_unit_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_access_level(_user_id, _company_id, _module_code, _org_unit_id) 
    IN ('write', 'admin')
$$;

-- =====================================================
-- RLS POLISE
-- =====================================================

-- MODULES - svi mogu čitati, samo super admin menja
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view modules"
  ON public.modules FOR SELECT
  USING (true);

CREATE POLICY "Super admins can manage modules"
  ON public.modules FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ROLES - vidljive po firmi, admini menjaju
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view roles in their companies"
  ON public.roles FOR SELECT
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can manage roles"
  ON public.roles FOR ALL
  USING (
    public.has_role(auth.uid(), 'super_admin') 
    OR public.is_local_admin_for_company(auth.uid(), company_id)
  );

-- ROLE_PERMISSIONS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view role permissions"
  ON public.role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r 
      WHERE r.id = role_id 
      AND public.has_company_access(auth.uid(), r.company_id)
    )
  );

CREATE POLICY "Admins can manage role permissions"
  ON public.role_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r 
      WHERE r.id = role_id 
      AND (
        public.has_role(auth.uid(), 'super_admin') 
        OR public.is_local_admin_for_company(auth.uid(), r.company_id)
      )
    )
  );

-- USER_ROLE_ASSIGNMENTS
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assignments"
  ON public.user_role_assignments FOR SELECT
  USING (
    user_id = auth.uid() 
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_local_admin_for_company(auth.uid(), company_id)
  );

CREATE POLICY "Admins can manage role assignments"
  ON public.user_role_assignments FOR ALL
  USING (
    public.has_role(auth.uid(), 'super_admin') 
    OR public.is_local_admin_for_company(auth.uid(), company_id)
  );

-- USER_PERMISSION_OVERRIDES
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own overrides"
  ON public.user_permission_overrides FOR SELECT
  USING (
    user_id = auth.uid() 
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_local_admin_for_company(auth.uid(), company_id)
  );

CREATE POLICY "Admins can manage permission overrides"
  ON public.user_permission_overrides FOR ALL
  USING (
    public.has_role(auth.uid(), 'super_admin') 
    OR public.is_local_admin_for_company(auth.uid(), company_id)
  );

-- =====================================================
-- TRIGERI ZA UPDATED_AT
-- =====================================================

CREATE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_role_assignments_updated_at
  BEFORE UPDATE ON public.user_role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_permission_overrides_updated_at
  BEFORE UPDATE ON public.user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();