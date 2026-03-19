import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CrmType {
  id: string;
  company_id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useCrmTypes() {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["crm-types", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await (supabase.from as any)("crm_types")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("sort_order");
      if (error) throw error;
      return data as CrmType[];
    },
    enabled: !!selectedCompany?.id,
  });

  const createType = useMutation({
    mutationFn: async (values: { code: string; name: string; description?: string }) => {
      if (!selectedCompany?.id) throw new Error("No company");
      const { error } = await (supabase.from as any)("crm_types").insert({
        company_id: selectedCompany.id,
        code: values.code,
        name: values.name,
        description: values.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-types"] });
      toast.success("Vrsta CRM-a kreirana");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateType = useMutation({
    mutationFn: async (values: { id: string; code: string; name: string; description?: string; is_active: boolean }) => {
      const { error } = await (supabase.from as any)("crm_types").update({
        code: values.code,
        name: values.name,
        description: values.description || null,
        is_active: values.is_active,
        updated_at: new Date().toISOString(),
      }).eq("id", values.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-types"] });
      toast.success("Vrsta CRM-a ažurirana");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("crm_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-types"] });
      toast.success("Vrsta CRM-a obrisana");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    types: query.data || [],
    isLoading: query.isLoading,
    createType,
    updateType,
    deleteType,
  };
}
