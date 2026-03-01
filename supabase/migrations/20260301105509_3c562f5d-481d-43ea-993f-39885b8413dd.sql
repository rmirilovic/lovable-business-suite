
-- PP-PDV poreska prijava
CREATE TABLE public.pp_pdv_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  popdv_report_id UUID REFERENCES public.popdv_reports(id),
  period_type TEXT NOT NULL DEFAULT 'monthly',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',

  -- Podaci o firmi (snapshot)
  pib TEXT,
  company_name TEXT,
  municipality_code TEXT,
  activity_code TEXT,
  responsible_person_name TEXT,
  responsible_person_jmbg TEXT,
  email TEXT,

  -- Polja PP-PDV obrasca
  -- I. Promet dobara i usluga
  field_001 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Promet po opštoj stopi - osnovica
  field_002 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Obračunati PDV po opštoj stopi
  field_003 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Promet po posebnoj stopi - osnovica
  field_004 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Obračunati PDV po posebnoj stopi
  field_005 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Promet oslobođen PDV sa pravom na odbitak
  field_006 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Promet oslobođen PDV bez prava na odbitak
  field_007 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Promet koji nije predmet oporezivanja
  field_008 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Ukupan promet (001+003+005+006+007)
  
  -- II. PDV iz primljenih avansa
  field_009 NUMERIC(18,2) NOT NULL DEFAULT 0, -- PDV iz avansa po opštoj stopi
  field_010 NUMERIC(18,2) NOT NULL DEFAULT 0, -- PDV iz avansa po posebnoj stopi
  
  -- III. Ukupna poreska obaveza (002+004+009+010)
  field_011 NUMERIC(18,2) NOT NULL DEFAULT 0,
  
  -- IV. Prethodni porez
  field_101 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Prethodni PDV po opštoj stopi - dobra
  field_102 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Prethodni PDV po posebnoj stopi - dobra
  field_103 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Prethodni PDV po opštoj stopi - usluge
  field_104 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Prethodni PDV po posebnoj stopi - usluge
  field_105 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Prethodni PDV plaćen pri uvozu
  field_106 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Ispravka prethodnog poreza - povećanje
  field_107 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Ispravka prethodnog poreza - smanjenje
  field_108 NUMERIC(18,2) NOT NULL DEFAULT 0, -- Ukupan prethodni porez (101+102+103+104+105+106-107)
  
  -- V. Poreska obaveza za uplatu / iznos za povraćaj
  field_201 NUMERIC(18,2) NOT NULL DEFAULT 0, -- PDV za uplatu (011-108) ako pozitivno
  field_202 NUMERIC(18,2) NOT NULL DEFAULT 0, -- PDV za povraćaj (108-011) ako pozitivno

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at TIMESTAMPTZ,
  finalized_by UUID,
  note TEXT
);

-- RLS
ALTER TABLE public.pp_pdv_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pp_pdv_returns for their company"
  ON public.pp_pdv_returns FOR SELECT
  USING (company_id IN (
    SELECT ura.company_id FROM public.user_role_assignments ura WHERE ura.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert pp_pdv_returns for their company"
  ON public.pp_pdv_returns FOR INSERT
  WITH CHECK (company_id IN (
    SELECT ura.company_id FROM public.user_role_assignments ura WHERE ura.user_id = auth.uid()
  ));

CREATE POLICY "Users can update pp_pdv_returns for their company"
  ON public.pp_pdv_returns FOR UPDATE
  USING (company_id IN (
    SELECT ura.company_id FROM public.user_role_assignments ura WHERE ura.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete draft pp_pdv_returns for their company"
  ON public.pp_pdv_returns FOR DELETE
  USING (
    status = 'draft' AND
    company_id IN (
      SELECT ura.company_id FROM public.user_role_assignments ura WHERE ura.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_pp_pdv_returns_company ON public.pp_pdv_returns(company_id);
CREATE INDEX idx_pp_pdv_returns_year ON public.pp_pdv_returns(business_year_id);
CREATE INDEX idx_pp_pdv_returns_popdv ON public.pp_pdv_returns(popdv_report_id);
