-- Create article_history table for audit log
CREATE TABLE public.article_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL,
  company_id UUID NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL CHECK (change_type IN ('insert', 'update', 'delete')),
  old_data JSONB,
  new_data JSONB
);

-- Create index for faster lookups
CREATE INDEX idx_article_history_article_id ON public.article_history(article_id);
CREATE INDEX idx_article_history_changed_at ON public.article_history(changed_at DESC);

-- Enable RLS
ALTER TABLE public.article_history ENABLE ROW LEVEL SECURITY;

-- Users can view history for articles in their companies
CREATE POLICY "Users can view article history from their companies"
ON public.article_history
FOR SELECT
USING (has_company_access(auth.uid(), company_id));

-- Only admins can insert history (via trigger)
CREATE POLICY "System can insert article history"
ON public.article_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_local_admin_for_company(auth.uid(), company_id));

-- Create trigger function to log article changes
CREATE OR REPLACE FUNCTION public.log_article_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.article_history (article_id, company_id, changed_by, change_type, new_data)
    VALUES (NEW.id, NEW.company_id, auth.uid(), 'insert', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.article_history (article_id, company_id, changed_by, change_type, old_data, new_data)
    VALUES (NEW.id, NEW.company_id, auth.uid(), 'update', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.article_history (article_id, company_id, changed_by, change_type, old_data)
    VALUES (OLD.id, OLD.company_id, auth.uid(), 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger on articles table
CREATE TRIGGER article_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.log_article_changes();