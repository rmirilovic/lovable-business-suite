-- Enum for attribute data types
CREATE TYPE public.attribute_data_type AS ENUM (
  'text',       -- do 511 karaktera
  'string',     -- do 31 karakter
  'predefined', -- izbor iz comboboxa
  'bit',        -- 0/1 (Da/Ne)
  'integer',    -- do 65535
  'decimal',    -- do 6 decimala
  'date'        -- YYYY-MM-DD
);

-- Article attributes master table
CREATE TABLE public.article_attributes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  data_type attribute_data_type NOT NULL DEFAULT 'string',
  is_repeatable BOOLEAN NOT NULL DEFAULT false,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Predefined values for attributes (for 'predefined' data_type)
CREATE TABLE public.article_attribute_predefined_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attribute_id UUID NOT NULL REFERENCES public.article_attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL CHECK (char_length(value) <= 31),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(attribute_id, value)
);

-- Article-attribute assignments
CREATE TABLE public.article_attribute_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES public.article_attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(article_id, attribute_id, value)
);

-- Enable RLS
ALTER TABLE public.article_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_attribute_predefined_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_attribute_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for article_attributes
CREATE POLICY "Users can view attributes from their companies"
ON public.article_attributes FOR SELECT
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can insert attributes"
ON public.article_attributes FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can update attributes"
ON public.article_attributes FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete attributes"
ON public.article_attributes FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

-- RLS policies for predefined values (inherit from parent attribute)
CREATE POLICY "Users can view predefined values"
ON public.article_attribute_predefined_values FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.article_attributes aa 
  WHERE aa.id = attribute_id AND has_company_access(auth.uid(), aa.company_id)
));

CREATE POLICY "Admins can insert predefined values"
ON public.article_attribute_predefined_values FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.article_attributes aa 
  WHERE aa.id = attribute_id AND (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), aa.company_id))
));

CREATE POLICY "Admins can update predefined values"
ON public.article_attribute_predefined_values FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.article_attributes aa 
  WHERE aa.id = attribute_id AND (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), aa.company_id))
));

CREATE POLICY "Admins can delete predefined values"
ON public.article_attribute_predefined_values FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.article_attributes aa 
  WHERE aa.id = attribute_id AND (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), aa.company_id))
));

-- RLS policies for article_attribute_assignments
CREATE POLICY "Users can view attribute assignments from their companies"
ON public.article_attribute_assignments FOR SELECT
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can insert attribute assignments"
ON public.article_attribute_assignments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can update attribute assignments"
ON public.article_attribute_assignments FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete attribute assignments"
ON public.article_attribute_assignments FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

-- Trigger for updated_at
CREATE TRIGGER update_article_attributes_updated_at
BEFORE UPDATE ON public.article_attributes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_article_attribute_assignments_updated_at
BEFORE UPDATE ON public.article_attribute_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to validate non-repeatable attribute constraint
CREATE OR REPLACE FUNCTION public.check_attribute_repeatable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attr_repeatable BOOLEAN;
  existing_count INTEGER;
BEGIN
  -- Get if attribute is repeatable
  SELECT is_repeatable INTO attr_repeatable
  FROM public.article_attributes
  WHERE id = NEW.attribute_id;
  
  -- If not repeatable, check if already exists for this article
  IF NOT attr_repeatable THEN
    SELECT COUNT(*) INTO existing_count
    FROM public.article_attribute_assignments
    WHERE article_id = NEW.article_id 
      AND attribute_id = NEW.attribute_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'Atribut nije ponavljajući i već postoji za ovaj artikal';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_attribute_repeatable_trigger
BEFORE INSERT OR UPDATE ON public.article_attribute_assignments
FOR EACH ROW EXECUTE FUNCTION public.check_attribute_repeatable();

-- Indexes for performance
CREATE INDEX idx_article_attributes_company ON public.article_attributes(company_id);
CREATE INDEX idx_article_attribute_predefined_values_attribute ON public.article_attribute_predefined_values(attribute_id);
CREATE INDEX idx_article_attribute_assignments_article ON public.article_attribute_assignments(article_id);
CREATE INDEX idx_article_attribute_assignments_attribute ON public.article_attribute_assignments(attribute_id);
CREATE INDEX idx_article_attribute_assignments_company ON public.article_attribute_assignments(company_id);