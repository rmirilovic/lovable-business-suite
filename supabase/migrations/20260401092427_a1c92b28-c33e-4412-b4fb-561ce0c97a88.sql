
-- Create partner_history table
CREATE TABLE public.partner_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL,
  company_id UUID NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB
);

-- Indexes
CREATE INDEX idx_partner_history_partner_id ON public.partner_history(partner_id);
CREATE INDEX idx_partner_history_changed_at ON public.partner_history(changed_at);

-- Enable RLS
ALTER TABLE public.partner_history ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can insert their own records
CREATE POLICY "Users can insert own partner history"
  ON public.partner_history FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- Authenticated users can read partner history for their company
CREATE POLICY "Users can read partner history"
  ON public.partner_history FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT uc.company_id FROM user_companies uc WHERE uc.user_id = auth.uid()
  ));

-- Trigger to auto-log partner changes
CREATE OR REPLACE FUNCTION public.log_partner_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.partner_history (partner_id, company_id, changed_by, change_type, new_data)
    VALUES (NEW.id, NEW.company_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'), 'insert', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.partner_history (partner_id, company_id, changed_by, change_type, old_data, new_data)
    VALUES (NEW.id, NEW.company_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'), 'update', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.partner_history (partner_id, company_id, changed_by, change_type, old_data)
    VALUES (OLD.id, OLD.company_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'), 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_partner_history
  AFTER INSERT OR UPDATE OR DELETE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.log_partner_history();
