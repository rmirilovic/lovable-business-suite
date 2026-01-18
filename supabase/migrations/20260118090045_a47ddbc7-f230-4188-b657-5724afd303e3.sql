-- Create article_classifications table for hierarchical classification
CREATE TABLE public.article_classifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_code TEXT DEFAULT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint: code must be unique per company
  CONSTRAINT unique_classification_code_per_company UNIQUE (company_id, code)
);

-- Create index for faster lookups
CREATE INDEX idx_article_classifications_company ON public.article_classifications(company_id);
CREATE INDEX idx_article_classifications_parent ON public.article_classifications(parent_code);

-- Enable Row Level Security
ALTER TABLE public.article_classifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view classifications from their companies"
ON public.article_classifications
FOR SELECT
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Admins can insert classifications"
ON public.article_classifications
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can update classifications"
ON public.article_classifications
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete classifications"
ON public.article_classifications
FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_local_admin_for_company(auth.uid(), company_id));

-- Trigger for updated_at
CREATE TRIGGER update_article_classifications_updated_at
BEFORE UPDATE ON public.article_classifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();