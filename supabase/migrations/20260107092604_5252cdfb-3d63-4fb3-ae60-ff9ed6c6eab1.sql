-- Create articles table
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_year_id UUID NOT NULL REFERENCES public.business_years(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  article_group TEXT,
  unit TEXT NOT NULL DEFAULT 'kom',
  purchase_price NUMERIC(15,2) DEFAULT 0,
  selling_price NUMERIC(15,2) DEFAULT 0,
  stock NUMERIC(15,3) DEFAULT 0,
  min_stock NUMERIC(15,3) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, business_year_id, code)
);

-- Enable RLS
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view articles from companies they have access to
CREATE POLICY "Users can view articles from their companies"
ON public.articles
FOR SELECT
USING (has_company_access(auth.uid(), company_id));

-- Policy: Local admins and super admins can insert articles
CREATE POLICY "Admins can insert articles"
ON public.articles
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  is_local_admin_for_company(auth.uid(), company_id)
);

-- Policy: Local admins and super admins can update articles
CREATE POLICY "Admins can update articles"
ON public.articles
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  is_local_admin_for_company(auth.uid(), company_id)
);

-- Policy: Local admins and super admins can delete articles
CREATE POLICY "Admins can delete articles"
ON public.articles
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  is_local_admin_for_company(auth.uid(), company_id)
);

-- Create trigger for updated_at
CREATE TRIGGER update_articles_updated_at
BEFORE UPDATE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_articles_company_year ON public.articles(company_id, business_year_id);
CREATE INDEX idx_articles_code ON public.articles(code);
CREATE INDEX idx_articles_name ON public.articles(name);