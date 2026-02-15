import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ArticleSwap {
  id: string;
  company_id: string;
  business_year_id: string;
  warehouse_id: string;
  swap_number: string;
  swap_date: string;
  status: "draft" | "posted";
  article_1_id: string;
  article_1_code: string;
  article_1_name: string;
  article_1_unit: string;
  quantity_1: number;
  price_1: number;
  article_2_id: string;
  article_2_code: string;
  article_2_name: string;
  article_2_unit: string;
  quantity_2: number;
  price_2: number;
  swap_value: number;
  note: string | null;
  created_by: string;
  posted_at: string | null;
  posted_by: string | null;
  created_at: string;
  updated_at: string;
  warehouse?: { id: string; code: string; name: string; warehouse_type: string };
}

export interface ArticleSwapFormData {
  warehouse_id: string;
  swap_date: string;
  article_1_id: string;
  article_1_code: string;
  article_1_name: string;
  article_1_unit: string;
  quantity_1: number;
  price_1: number;
  article_2_id: string;
  article_2_code: string;
  article_2_name: string;
  article_2_unit: string;
  quantity_2: number;
  price_2: number;
  swap_value: number;
  note: string | null;
}

export function useArticleSwaps() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const swapsQuery = useQuery({
    queryKey: ["article-swaps", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      const { data, error } = await supabase
        .from("article_swaps")
        .select(`*, warehouse:warehouses!article_swaps_warehouse_id_fkey(id, code, name, warehouse_type)`)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("swap_number", { ascending: false });
      if (error) throw error;
      return data as unknown as ArticleSwap[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const createSwap = useMutation({
    mutationFn: async (formData: ArticleSwapFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id)
        throw new Error("Potrebno je izabrati firmu i godinu");

      const { data: numberData, error: numberError } = await supabase.rpc(
        "get_next_swap_number",
        { _company_id: selectedCompany.id, _year_id: selectedYear.id }
      );
      if (numberError) throw numberError;

      const { data, error } = await supabase
        .from("article_swaps")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          swap_number: numberData,
          created_by: user.id,
          ...formData,
        })
        .select(`*, warehouse:warehouses!article_swaps_warehouse_id_fkey(id, code, name, warehouse_type)`)
        .single();
      if (error) throw error;
      return data as unknown as ArticleSwap;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-swaps"] });
      toast.success("Zamena artikla uspešno kreirana");
    },
    onError: (error) => toast.error(`Greška pri kreiranju: ${error.message}`),
  });

  const updateSwap = useMutation({
    mutationFn: async ({ id, ...formData }: ArticleSwapFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("article_swaps")
        .update(formData)
        .eq("id", id)
        .select(`*, warehouse:warehouses!article_swaps_warehouse_id_fkey(id, code, name, warehouse_type)`)
        .single();
      if (error) throw error;
      return data as unknown as ArticleSwap;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-swaps"] });
      toast.success("Zamena uspešno ažurirana");
    },
    onError: (error) => toast.error(`Greška pri ažuriranju: ${error.message}`),
  });

  const deleteSwap = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("article_swaps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-swaps"] });
      toast.success("Zamena uspešno obrisana");
    },
    onError: (error) => toast.error(`Greška pri brisanju: ${error.message}`),
  });

  const postSwap = useMutation({
    mutationFn: async (swapId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");
      const { data, error } = await supabase.rpc("post_article_swap", {
        _swap_id: swapId,
        _user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-swaps"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      toast.success("Zamena artikla uspešno proknjižena");
    },
    onError: (error) => toast.error(`Greška pri knjiženju: ${error.message}`),
  });

  const unpostSwap = useMutation({
    mutationFn: async (swapId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");
      const { data, error } = await supabase.rpc("unpost_article_swap", {
        _swap_id: swapId,
        _user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-swaps"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      toast.success("Knjiženje poništeno");
    },
    onError: (error) => toast.error(`Greška pri poništavanju: ${error.message}`),
  });

  return {
    swaps: swapsQuery.data || [],
    isLoading: swapsQuery.isLoading,
    error: swapsQuery.error,
    createSwap,
    updateSwap,
    deleteSwap,
    postSwap,
    unpostSwap,
  };
}
