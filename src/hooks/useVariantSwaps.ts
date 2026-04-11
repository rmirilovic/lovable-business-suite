import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface VariantSwap {
  id: string;
  company_id: string;
  business_year_id: string;
  swap_number: string;
  swap_date: string;
  article_id: string;
  warehouse_id: string;
  source_variant_id: string | null;
  target_variant_id: string;
  quantity: number;
  status: "draft" | "posted";
  note: string | null;
  created_by: string;
  posted_at: string | null;
  posted_by: string | null;
  created_at: string;
  updated_at: string;
  article?: { id: string; code: string; name: string; unit: string };
  warehouse?: { id: string; code: string; name: string };
  source_variant?: { id: string; code: string; description: string } | null;
  target_variant?: { id: string; code: string; description: string };
}

export interface VariantSwapFormData {
  swap_date: string;
  article_id: string;
  warehouse_id: string;
  source_variant_id: string | null;
  target_variant_id: string;
  quantity: number;
  note: string | null;
}

const SELECT_QUERY = `*, 
  article:articles!variant_swaps_article_id_fkey(id, code, name, unit),
  warehouse:warehouses!variant_swaps_warehouse_id_fkey(id, code, name),
  source_variant:article_variants!variant_swaps_source_variant_id_fkey(id, code, description),
  target_variant:article_variants!variant_swaps_target_variant_id_fkey(id, code, description)`;

export function useVariantSwaps() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const swapsQuery = useQuery({
    queryKey: ["variant-swaps", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("variant_swaps")
        .select(SELECT_QUERY)
        .eq("company_id", selectedCompany!.id)
        .eq("business_year_id", selectedYear!.id)
        .order("swap_number", { ascending: false });
      if (error) throw error;
      return data as unknown as VariantSwap[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const getNextNumber = async () => {
    // Generate next swap number in format YYNNNN
    const yearStr = String(selectedYear!.year).slice(-2);
    const { data, error } = await supabase
      .from("variant_swaps")
      .select("swap_number")
      .eq("company_id", selectedCompany!.id)
      .eq("business_year_id", selectedYear!.id)
      .order("swap_number", { ascending: false })
      .limit(1);
    if (error) throw error;
    
    let nextNum = 1;
    if (data && data.length > 0) {
      const lastNum = parseInt(data[0].swap_number.slice(2), 10);
      nextNum = lastNum + 1;
    }
    return yearStr + String(nextNum).padStart(4, "0");
  };

  const createSwap = useMutation({
    mutationFn: async (formData: VariantSwapFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id)
        throw new Error("Potrebno je izabrati firmu i godinu");

      const swapNumber = await getNextNumber();
      const { data, error } = await supabase
        .from("variant_swaps")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          swap_number: swapNumber,
          created_by: user.id,
          ...formData,
        })
        .select(SELECT_QUERY)
        .single();
      if (error) throw error;
      return data as unknown as VariantSwap;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variant-swaps"] });
      toast.success("Zamena varijante uspešno kreirana");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const updateSwap = useMutation({
    mutationFn: async ({ id, ...formData }: VariantSwapFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("variant_swaps")
        .update(formData)
        .eq("id", id)
        .select(SELECT_QUERY)
        .single();
      if (error) throw error;
      return data as unknown as VariantSwap;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variant-swaps"] });
      toast.success("Zamena varijante ažurirana");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const deleteSwap = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("variant_swaps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variant-swaps"] });
      toast.success("Zamena varijante obrisana");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const postSwap = useMutation({
    mutationFn: async (swapId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");
      // Simple post - just update status, no journal entry
      const { error } = await supabase
        .from("variant_swaps")
        .update({ status: "posted", posted_at: new Date().toISOString(), posted_by: user.id })
        .eq("id", swapId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variant-swaps"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock-by-variant"] });
      toast.success("Zamena varijante proknjižena");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const unpostSwap = useMutation({
    mutationFn: async (swapId: string) => {
      const { error } = await supabase
        .from("variant_swaps")
        .update({ status: "draft", posted_at: null, posted_by: null })
        .eq("id", swapId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variant-swaps"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock-by-variant"] });
      toast.success("Knjiženje poništeno");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  return {
    swaps: swapsQuery.data || [],
    isLoading: swapsQuery.isLoading,
    createSwap,
    updateSwap,
    deleteSwap,
    postSwap,
    unpostSwap,
  };
}
