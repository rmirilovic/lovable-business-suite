
-- Add document history triggers for material norms

-- Variant changes (header-level per norm)
CREATE TRIGGER log_material_norm_variant_changes
AFTER INSERT OR UPDATE OR DELETE ON public.material_norm_variants
FOR EACH ROW EXECUTE FUNCTION public.log_document_changes('material_norm_variant', 'norm_id');

-- Item changes (child of variant, but we want document_id = norm_id)
-- We need a wrapper since items reference variant_id, not norm_id directly
CREATE OR REPLACE FUNCTION public.log_norm_item_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_norm_id UUID;
  v_company_id UUID;
  v_record_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_company_id := OLD.company_id;
    SELECT norm_id INTO v_norm_id FROM material_norm_variants WHERE id = OLD.variant_id;
    INSERT INTO document_history (document_type, document_id, record_id, company_id, changed_by, change_type, old_data)
    VALUES ('material_norm_item', v_norm_id, v_record_id, v_company_id,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'delete', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_company_id := NEW.company_id;
    SELECT norm_id INTO v_norm_id FROM material_norm_variants WHERE id = NEW.variant_id;
    INSERT INTO document_history (document_type, document_id, record_id, company_id, changed_by, change_type, new_data)
    VALUES ('material_norm_item', v_norm_id, v_record_id, v_company_id,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'insert', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;
    v_company_id := NEW.company_id;
    SELECT norm_id INTO v_norm_id FROM material_norm_variants WHERE id = NEW.variant_id;
    INSERT INTO document_history (document_type, document_id, record_id, company_id, changed_by, change_type, old_data, new_data)
    VALUES ('material_norm_item', v_norm_id, v_record_id, v_company_id,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'update', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER log_material_norm_item_changes
AFTER INSERT OR UPDATE OR DELETE ON public.material_norm_items
FOR EACH ROW EXECUTE FUNCTION public.log_norm_item_changes();
