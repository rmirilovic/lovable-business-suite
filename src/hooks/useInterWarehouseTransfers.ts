import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface InterWarehouseTransfer {
  id: string;
  company_id: string;
  business_year_id: string;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  transfer_number: string;
  transfer_date: string;
  status: "draft" | "posted";
  note: string | null;
  journal_entry_id: string | null;
  created_by: string;
  posted_at: string | null;
  posted_by: string | null;
  created_at: string;
  updated_at: string;
  source_warehouse?: { id: string; code: string; name: string; warehouse_type: string };
  destination_warehouse?: { id: string; code: string; name: string; warehouse_type: string };
}

export interface InterWarehouseTransferItem {
  id: string;
  transfer_id: string;
  company_id: string;
  article_id: string;
  item_code: string | null;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  item_order: number;
  variant_id: string | null;
  created_at: string;
  article?: { id: string; code: string; name: string; unit: string };
  variant?: { id: string; code: string; description: string } | null;
}

export interface TransferFormData {
  source_warehouse_id: string;
  destination_warehouse_id: string;
  transfer_date: string;
  note: string | null;
}

export interface TransferItemFormData {
  article_id: string;
  item_code: string | null;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  variant_id: string | null;
}

export function useInterWarehouseTransfers() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const transfersQuery = useQuery({
    queryKey: ["inter-warehouse-transfers", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      const { data, error } = await supabase
        .from("inter_warehouse_transfers")
        .select(`
          *,
          source_warehouse:warehouses!inter_warehouse_transfers_source_warehouse_id_fkey(id, code, name, warehouse_type),
          destination_warehouse:warehouses!inter_warehouse_transfers_destination_warehouse_id_fkey(id, code, name, warehouse_type)
        `)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("transfer_number", { ascending: false });
      if (error) throw error;
      return data as InterWarehouseTransfer[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const createTransfer = useMutation({
    mutationFn: async (formData: TransferFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id)
        throw new Error("Potrebno je izabrati firmu i godinu");

      const { data: numberData, error: numberError } = await supabase.rpc(
        "get_next_transfer_number",
        { _company_id: selectedCompany.id, _year_id: selectedYear.id }
      );
      if (numberError) throw numberError;

      const { data, error } = await supabase
        .from("inter_warehouse_transfers")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          transfer_number: numberData,
          ...formData,
          created_by: user.id,
        })
        .select(`
          *,
          source_warehouse:warehouses!inter_warehouse_transfers_source_warehouse_id_fkey(id, code, name, warehouse_type),
          destination_warehouse:warehouses!inter_warehouse_transfers_destination_warehouse_id_fkey(id, code, name, warehouse_type)
        `)
        .single();
      if (error) throw error;
      return data as InterWarehouseTransfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfers"] });
      toast.success("Međumagacinski prenos uspešno kreiran");
    },
    onError: (error) => toast.error(`Greška pri kreiranju: ${error.message}`),
  });

  const updateTransfer = useMutation({
    mutationFn: async ({ id, ...formData }: TransferFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("inter_warehouse_transfers")
        .update(formData)
        .eq("id", id)
        .select(`
          *,
          source_warehouse:warehouses!inter_warehouse_transfers_source_warehouse_id_fkey(id, code, name, warehouse_type),
          destination_warehouse:warehouses!inter_warehouse_transfers_destination_warehouse_id_fkey(id, code, name, warehouse_type)
        `)
        .single();
      if (error) throw error;
      return data as InterWarehouseTransfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfers"] });
      toast.success("Prenos uspešno ažuriran");
    },
    onError: (error) => toast.error(`Greška pri ažuriranju: ${error.message}`),
  });

  const deleteTransfer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("inter_warehouse_transfers")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfers"] });
      toast.success("Prenos uspešno obrisan");
    },
    onError: (error) => toast.error(`Greška pri brisanju: ${error.message}`),
  });

  const postTransfer = useMutation({
    mutationFn: async (transferId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");
      const { data, error } = await supabase.rpc("post_inter_warehouse_transfer", {
        _transfer_id: transferId,
        _user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Međumagacinski prenos uspešno proknjižen");
    },
    onError: (error) => toast.error(`Greška pri knjiženju: ${error.message}`),
  });

  const unpostTransfer = useMutation({
    mutationFn: async (transferId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");
      const { data, error } = await supabase.rpc("unpost_inter_warehouse_transfer", {
        _transfer_id: transferId,
        _user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Knjiženje poništeno");
    },
    onError: (error) => toast.error(`Greška pri poništavanju: ${error.message}`),
  });

  return {
    transfers: transfersQuery.data || [],
    isLoading: transfersQuery.isLoading,
    error: transfersQuery.error,
    createTransfer,
    updateTransfer,
    deleteTransfer,
    postTransfer,
    unpostTransfer,
  };
}

export function useInterWarehouseTransferItems(transferId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["inter-warehouse-transfer-items", transferId],
    queryFn: async () => {
      if (!transferId) return [];
      const { data, error } = await supabase
        .from("inter_warehouse_transfer_items")
        .select(`*, article:articles(id, code, name, unit), variant:article_variants(id, code, description)`)
        .eq("transfer_id", transferId)
        .order("item_order");
      if (error) throw error;
      return data as unknown as InterWarehouseTransferItem[];
    },
    enabled: !!transferId,
  });

  const addItem = useMutation({
    mutationFn: async (item: TransferItemFormData & { transfer_id: string }) => {
      if (!selectedCompany?.id) throw new Error("Potrebno je izabrati firmu");
      const { data: existingItems } = await supabase
        .from("inter_warehouse_transfer_items")
        .select("item_order")
        .eq("transfer_id", item.transfer_id)
        .order("item_order", { ascending: false })
        .limit(1);
      const nextOrder = (existingItems?.[0]?.item_order || 0) + 1;

      const { data, error } = await supabase
        .from("inter_warehouse_transfer_items")
        .insert({
          transfer_id: item.transfer_id,
          company_id: selectedCompany.id,
          item_order: nextOrder,
          article_id: item.article_id,
          item_code: item.item_code,
          item_name: item.item_name,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          variant_id: item.variant_id || null,
        })
        .select(`*, article:articles(id, code, name, unit), variant:article_variants(id, code, description)`)
        .single();
      if (error) throw error;
      return data as unknown as InterWarehouseTransferItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfer-items", transferId] });
    },
    onError: (error) => toast.error(`Greška pri dodavanju stavke: ${error.message}`),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...item }: TransferItemFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("inter_warehouse_transfer_items")
        .update({
          article_id: item.article_id,
          item_code: item.item_code,
          item_name: item.item_name,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          variant_id: item.variant_id || null,
        })
        .eq("id", id)
        .select(`*, article:articles(id, code, name, unit), variant:article_variants(id, code, description)`)
        .single();
      if (error) throw error;
      return data as unknown as InterWarehouseTransferItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfer-items", transferId] });
      toast.success("Stavka uspešno ažurirana");
    },
    onError: (error) => toast.error(`Greška pri ažuriranju stavke: ${error.message}`),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("inter_warehouse_transfer_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfer-items", transferId] });
    },
    onError: (error) => toast.error(`Greška pri brisanju stavke: ${error.message}`),
  });

  return {
    items: itemsQuery.data || [],
    isLoading: itemsQuery.isLoading,
    addItem,
    updateItem,
    deleteItem,
  };
}
