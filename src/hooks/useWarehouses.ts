import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Warehouse {
  id: string;
  company_id: string;
  code: string;
  name: string;
  address: string | null;
  warehouse_type: "1" | "2" | "6" | "9" | "12";
  accountant: string | null;
  inventory_account: string | null;
  is_customs_warehouse: boolean;
  customs_office_code: string | null;
  customs_warehouse_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type WarehouseInsert = Omit<Warehouse, "id" | "created_at" | "updated_at"> & {
  is_customs_warehouse?: boolean;
  customs_office_code?: string | null;
  customs_warehouse_code?: string | null;
};
export type WarehouseUpdate = Partial<Omit<Warehouse, "id" | "company_id" | "created_at" | "updated_at">>;

export const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  "1": "1 - Magacin robe",
  "2": "2 - Magacin repromaterijala",
  "6": "6 - Magacin rezervnih delova",
  "9": "9 - Magacin gotovih proizvoda",
  "12": "12 - Magacin materijala za gradnju",
};

async function fetchWarehouses(companyId: string): Promise<Warehouse[]> {
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("company_id", companyId)
    .order("code");

  if (error) throw error;
  return data as Warehouse[];
}

export function useWarehouses(companyId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["warehouses", companyId],
    queryFn: () => fetchWarehouses(companyId!),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (warehouse: WarehouseInsert) => {
      const { data, error } = await supabase
        .from("warehouses")
        .insert(warehouse)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", companyId] });
      toast.success("Magacin uspešno kreiran");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate key")) {
        toast.error("Magacin sa ovom šifrom već postoji");
      } else {
        toast.error("Greška pri kreiranju magacina");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: WarehouseUpdate }) => {
      const { data, error } = await supabase
        .from("warehouses")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", companyId] });
      toast.success("Magacin uspešno ažuriran");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate key")) {
        toast.error("Magacin sa ovom šifrom već postoji");
      } else {
        toast.error("Greška pri ažuriranju magacina");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", companyId] });
      toast.success("Magacin uspešno obrisan");
    },
    onError: () => {
      toast.error("Greška pri brisanju magacina");
    },
  });

  return {
    warehouses: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createWarehouse: createMutation.mutateAsync,
    updateWarehouse: updateMutation.mutateAsync,
    deleteWarehouse: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
