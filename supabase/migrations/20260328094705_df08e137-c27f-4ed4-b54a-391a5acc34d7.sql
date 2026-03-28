
-- Tabela work_hours already created by previous partial migration attempt, so use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.work_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  working_days INTEGER NOT NULL DEFAULT 0,
  worked_days INTEGER NOT NULL DEFAULT 0,
  hours_regular NUMERIC(8,2) NOT NULL DEFAULT 0,
  hours_overtime NUMERIC(8,2) NOT NULL DEFAULT 0,
  hours_holiday NUMERIC(8,2) NOT NULL DEFAULT 0,
  hours_night NUMERIC(8,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, employee_id, year, month)
);

ALTER TABLE public.work_hours ENABLE ROW LEVEL SECURITY;

-- RLS policies (use IF NOT EXISTS pattern via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'work_hours' AND policyname = 'Users can view work_hours for their company') THEN
    CREATE POLICY "Users can view work_hours for their company"
      ON public.work_hours FOR SELECT TO authenticated
      USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'work_hours' AND policyname = 'Users can insert work_hours for their company') THEN
    CREATE POLICY "Users can insert work_hours for their company"
      ON public.work_hours FOR INSERT TO authenticated
      WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'work_hours' AND policyname = 'Users can update work_hours for their company') THEN
    CREATE POLICY "Users can update work_hours for their company"
      ON public.work_hours FOR UPDATE TO authenticated
      USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'work_hours' AND policyname = 'Users can delete work_hours for their company') THEN
    CREATE POLICY "Users can delete work_hours for their company"
      ON public.work_hours FOR DELETE TO authenticated
      USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'work_hours' AND policyname = 'Super admins full access on work_hours') THEN
    CREATE POLICY "Super admins full access on work_hours"
      ON public.work_hours FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

-- Module
INSERT INTO public.modules (code, name, module_type, parent_code)
VALUES ('zarade.evidencija_sati', 'Evidencija radnog vremena', 'zarade', 'zarade')
ON CONFLICT DO NOTHING;

-- Role permissions
INSERT INTO public.role_permissions (role_id, module_code, access_level)
SELECT DISTINCT rp.role_id, 'zarade.evidencija_sati', rp.access_level
FROM public.role_permissions rp
WHERE rp.module_code = 'zarade'
ON CONFLICT DO NOTHING;
