import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface InputCost {
  id: string;
  company_id: string;
  code: string;
  account_code: string;
  name: string;
  vat_rate: number;
  is_vat_deductible: boolean;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface InputCostFormData {
  code: string;
  account_code: string;
  name: string;
  vat_rate: number;
  is_vat_deductible: boolean;
  is_active: boolean;
  description?: string | null;
}

export function useInputCosts() {
  const { selectedCompany } = useAuth();

  return useQuery({
    queryKey: ["input-costs", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const { data, error } = await supabase
        .from("input_costs")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("code");

      if (error) throw error;
      return data as InputCost[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useInputCostsMutations() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useAuth();

  const createInputCost = useMutation({
    mutationFn: async (data: InputCostFormData) => {
      if (!selectedCompany?.id) throw new Error("Nije izabrana firma");

      const { data: result, error } = await supabase
        .from("input_costs")
        .insert({ ...data, company_id: selectedCompany.id })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["input-costs"] });
      toast.success("Trošak je uspešno kreiran");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const updateInputCost = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InputCost> & { id: string }) => {
      const { data, error } = await supabase
        .from("input_costs")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["input-costs"] });
      toast.success("Trošak je uspešno ažuriran");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const deleteInputCost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("input_costs")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["input-costs"] });
      toast.success("Trošak je uspešno obrisan");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const bulkCreateInputCosts = useMutation({
    mutationFn: async (costs: InputCostFormData[]) => {
      if (!selectedCompany?.id) throw new Error("Nije izabrana firma");

      const costsWithCompany = costs.map((c) => ({
        ...c,
        company_id: selectedCompany.id,
      }));

      const { data, error } = await supabase
        .from("input_costs")
        .upsert(costsWithCompany, { onConflict: "company_id,code" })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["input-costs"] });
      toast.success(`Uspešno uvezeno ${data?.length || 0} troškova`);
    },
    onError: (error: Error) => {
      toast.error(`Greška pri uvozu: ${error.message}`);
    },
  });

  return { createInputCost, updateInputCost, deleteInputCost, bulkCreateInputCosts };
}
