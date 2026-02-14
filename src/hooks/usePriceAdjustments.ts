import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PriceAdjustment {
  id: string;
  company_id: string;
  business_year_id: string;
  warehouse_id: string;
  adjustment_number: string;
  adjustment_date: string;
  note: string | null;
  status: "draft" | "posted";
  total_increase: number;
  total_decrease: number;
  journal_entry_id: string | null;
  created_by: string;
  posted_at: string | null;
  posted_by: string | null;
  created_at: string;
  updated_at: string;
  warehouse?: { id: string; code: string; name: string; warehouse_type: string };
}

export interface PriceAdjustmentItem {
  id: string;
  price_adjustment_id: string;
  company_id: string;
  article_id: string;
  item_order: number;
  item_code: string | null;
  item_name: string;
  unit: string;
  quantity: number;
  old_price: number;
  new_price: number;
  price_difference: number;
  value_difference: number;
  created_at: string;
}

export interface PriceAdjustmentFormData {
  warehouse_id: string;
  adjustment_date: string;
  note: string | null;
}

export function usePriceAdjustments() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["price-adjustments", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      const { data, error } = await supabase
        .from("price_adjustments")
        .select(`*, warehouse:warehouses(id, code, name, warehouse_type)`)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("adjustment_number", { ascending: false });
      if (error) throw error;
      return data as PriceAdjustment[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const createAdjustment = useMutation({
    mutationFn: async (formData: PriceAdjustmentFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id)
        throw new Error("Potrebno je izabrati firmu i godinu");

      const { data: numData, error: numErr } = await supabase.rpc(
        "get_next_price_adjustment_number",
        { _company_id: selectedCompany.id, _year_id: selectedYear.id }
      );
      if (numErr) throw numErr;

      const { data, error } = await supabase
        .from("price_adjustments")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          adjustment_number: numData,
          ...formData,
          created_by: user.id,
        })
        .select(`*, warehouse:warehouses(id, code, name, warehouse_type)`)
        .single();
      if (error) throw error;
      return data as PriceAdjustment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-adjustments"] });
      toast.success("Nivelacija uspešno kreirana");
    },
    onError: (e) => toast.error(`Greška pri kreiranju: ${e.message}`),
  });

  const updateAdjustment = useMutation({
    mutationFn: async ({ id, ...formData }: PriceAdjustmentFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("price_adjustments")
        .update(formData)
        .eq("id", id)
        .select(`*, warehouse:warehouses(id, code, name, warehouse_type)`)
        .single();
      if (error) throw error;
      return data as PriceAdjustment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-adjustments"] });
      toast.success("Nivelacija ažurirana");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const deleteAdjustment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("price_adjustments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-adjustments"] });
      toast.success("Nivelacija obrisana");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const postAdjustment = useMutation({
    mutationFn: async (adjustmentId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");
      const { error } = await supabase.rpc("post_price_adjustment", {
        _adjustment_id: adjustmentId,
        _user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Nivelacija uspešno proknjižena");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const unpostAdjustment = useMutation({
    mutationFn: async (adjustmentId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");
      const { error } = await supabase.rpc("unpost_price_adjustment", {
        _adjustment_id: adjustmentId,
        _user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Knjiženje nivelacije poništeno");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  return {
    adjustments: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createAdjustment,
    updateAdjustment,
    deleteAdjustment,
    postAdjustment,
    unpostAdjustment,
  };
}

export function usePriceAdjustmentItems(adjustmentId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["price-adjustment-items", adjustmentId],
    queryFn: async () => {
      if (!adjustmentId) return [];
      const { data, error } = await supabase
        .from("price_adjustment_items")
        .select("*")
        .eq("price_adjustment_id", adjustmentId)
        .order("item_order");
      if (error) throw error;
      return data as PriceAdjustmentItem[];
    },
    enabled: !!adjustmentId,
  });

  const addItem = useMutation({
    mutationFn: async (item: Omit<PriceAdjustmentItem, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("price_adjustment_items")
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data as PriceAdjustmentItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-adjustment-items", adjustmentId] });
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PriceAdjustmentItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("price_adjustment_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as PriceAdjustmentItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-adjustment-items", adjustmentId] });
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("price_adjustment_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-adjustment-items", adjustmentId] });
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  return {
    items: itemsQuery.data || [],
    isLoading: itemsQuery.isLoading,
    addItem,
    updateItem,
    deleteItem,
  };
}
