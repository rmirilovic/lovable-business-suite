import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface InventoryCount {
  id: string;
  company_id: string;
  business_year_id: string;
  warehouse_id: string;
  count_number: string;
  count_date: string;
  note: string | null;
  status: "draft" | "posted";
  journal_entry_id: string | null;
  created_by: string;
  posted_at: string | null;
  posted_by: string | null;
  created_at: string;
  updated_at: string;
  warehouse?: { id: string; code: string; name: string; warehouse_type: string };
}

export interface InventoryCountItem {
  id: string;
  inventory_count_id: string;
  company_id: string;
  article_id: string;
  variant_id: string | null;
  item_order: number;
  item_code: string | null;
  item_name: string;
  unit: string;
  book_quantity: number;
  counted_quantity: number;
  surplus_qty: number;
  deficit_qty: number;
  price: number;
  surplus_value: number;
  deficit_value: number;
  created_at: string;
  variant?: { id: string; code: string; description: string } | null;
}

export interface InventoryCountFormData {
  warehouse_id: string;
  count_date: string;
  note: string | null;
}

export function useInventoryCounts() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const countsQuery = useQuery({
    queryKey: ["inventory-counts", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      const { data, error } = await supabase
        .from("inventory_counts")
        .select(`*, warehouse:warehouses(id, code, name)`)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("count_number", { ascending: false });
      if (error) throw error;
      return data as InventoryCount[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const createCount = useMutation({
    mutationFn: async (formData: InventoryCountFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id)
        throw new Error("Potrebno je izabrati firmu i godinu");

      const { data: numData, error: numErr } = await supabase.rpc(
        "get_next_inventory_count_number",
        { _company_id: selectedCompany.id, _year_id: selectedYear.id }
      );
      if (numErr) throw numErr;

      const { data, error } = await supabase
        .from("inventory_counts")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          count_number: numData,
          ...formData,
          created_by: user.id,
        })
        .select(`*, warehouse:warehouses(id, code, name)`)
        .single();
      if (error) throw error;
      return data as InventoryCount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-counts"] });
      toast.success("Popisna lista uspešno kreirana");
    },
    onError: (e) => toast.error(`Greška pri kreiranju: ${e.message}`),
  });

  const updateCount = useMutation({
    mutationFn: async ({ id, ...formData }: InventoryCountFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("inventory_counts")
        .update(formData)
        .eq("id", id)
        .select(`*, warehouse:warehouses(id, code, name)`)
        .single();
      if (error) throw error;
      return data as InventoryCount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-counts"] });
      toast.success("Popisna lista ažurirana");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const deleteCount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_counts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-counts"] });
      toast.success("Popisna lista obrisana");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const postCount = useMutation({
    mutationFn: async (countId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");
      const { error } = await supabase.rpc("post_inventory_count", {
        _count_id: countId,
        _user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-counts"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      toast.success("Popis uspešno proknjižen");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const unpostCount = useMutation({
    mutationFn: async (countId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");
      const { error } = await supabase.rpc("unpost_inventory_count", {
        _count_id: countId,
        _user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-counts"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      toast.success("Knjiženje popisa poništeno");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  return {
    counts: countsQuery.data || [],
    isLoading: countsQuery.isLoading,
    error: countsQuery.error,
    createCount,
    updateCount,
    deleteCount,
    postCount,
    unpostCount,
  };
}

export function useInventoryCountItems(countId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["inventory-count-items", countId],
    queryFn: async () => {
      if (!countId) return [];
      const { data, error } = await supabase
        .from("inventory_count_items")
        .select("*")
        .eq("inventory_count_id", countId)
        .order("item_order");
      if (error) throw error;
      return data as InventoryCountItem[];
    },
    enabled: !!countId,
  });

  const upsertItems = useMutation({
    mutationFn: async (items: Omit<InventoryCountItem, "id" | "created_at">[]) => {
      if (!selectedCompany?.id) throw new Error("Firma nije izabrana");
      // Delete existing items and insert new ones
      if (countId) {
        await supabase.from("inventory_count_items").delete().eq("inventory_count_id", countId);
      }
      if (items.length > 0) {
        // Batch insert in groups of 50
        for (let i = 0; i < items.length; i += 50) {
          const batch = items.slice(i, i + 50);
          const { error } = await supabase.from("inventory_count_items").insert(batch);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-count-items", countId] });
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InventoryCountItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("inventory_count_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as InventoryCountItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-count-items", countId] });
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const addItem = useMutation({
    mutationFn: async (item: Omit<InventoryCountItem, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("inventory_count_items")
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data as InventoryCountItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-count-items", countId] });
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_count_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-count-items", countId] });
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  return {
    items: itemsQuery.data || [],
    isLoading: itemsQuery.isLoading,
    upsertItems,
    updateItem,
    addItem,
    deleteItem,
  };
}
