import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CustomsClearance {
  id: string;
  clearance_number: string;
  clearance_date: string;
  company_id: string;
  business_year_id: string;
  source_invoice_id: string;
  jci_number: string | null;
  jci_date: string | null;
  customs_office_code: string | null;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  exchange_rate: number;
  currency: string;
  customs_duty_amount: number;
  excise_amount: number;
  invoice_value_rsd: number;
  additional_costs_total: number;
  customs_base: number;
  vat_rate: number;
  vat_base: number;
  vat_amount: number;
  total_cost_value: number;
  journal_entry_id: string | null;
  transfer_id: string | null;
  customs_duty_account: string | null;
  excise_account: string | null;
  vat_account: string | null;
  customs_obligation_account: string | null;
  status: string;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  posted_at: string | null;
  posted_by: string | null;
  source_invoice?: {
    id: string;
    internal_number: string;
    supplier_invoice_number: string;
    partner_id: string;
    supplier_name: string | null;
  };
  source_warehouse?: { id: string; code: string; name: string };
  destination_warehouse?: { id: string; code: string; name: string };
}

export interface CustomsClearanceItem {
  id: string;
  customs_clearance_id: string;
  company_id: string;
  article_id: string | null;
  item_code: string | null;
  item_name: string;
  unit: string;
  source_item_id: string | null;
  available_quantity: number;
  quantity: number;
  invoice_price: number;
  invoice_price_rsd: number;
  invoice_value_rsd: number;
  allocated_costs: number;
  allocated_customs_duty: number;
  allocated_excise: number;
  customs_base: number;
  vat_base: number;
  vat_amount: number;
  cost_price: number;
  cost_value: number;
  item_order: number;
  created_at: string;
}

export interface CustomsClearanceCost {
  id: string;
  customs_clearance_id: string;
  company_id: string;
  description: string;
  amount: number;
  distribution_method: string;
  partner_id: string | null;
  account_code: string | null;
  item_order: number;
  created_at: string;
  partner?: { id: string; name: string; code: string } | null;
}

export interface CustomsClearanceFormData {
  clearance_date: string;
  source_invoice_id: string;
  jci_number: string | null;
  jci_date: string | null;
  customs_office_code: string | null;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  exchange_rate: number;
  currency: string;
  customs_duty_amount: number;
  excise_amount: number;
  vat_rate: number;
  vat_amount_20: number;
  vat_amount_10: number;
  customs_duty_account: string | null;
  excise_account: string | null;
  vat_account: string | null;
  customs_obligation_account: string | null;
  note: string | null;
}

export function useCustomsClearances() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const clearancesQuery = useQuery({
    queryKey: ["customs-clearances", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];

      const { data, error } = await (supabase as any)
        .from("customs_clearances")
        .select(`
          *,
          source_invoice:goods_purchase_invoices(id, internal_number, supplier_invoice_number, partner_id, supplier_name),
          source_warehouse:warehouses!customs_clearances_source_warehouse_id_fkey(id, code, name),
          destination_warehouse:warehouses!customs_clearances_destination_warehouse_id_fkey(id, code, name)
        `)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("clearance_number", { ascending: false });

      if (error) throw error;
      return (data || []) as CustomsClearance[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const getNextNumber = async (): Promise<string> => {
    if (!selectedYear?.year) return "000001";
    const prefix = String(selectedYear.year).slice(-2);

    const { data } = await (supabase as any)
      .from("customs_clearances")
      .select("clearance_number")
      .eq("company_id", selectedCompany!.id)
      .eq("business_year_id", selectedYear!.id)
      .order("clearance_number", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastNum = parseInt(data[0].clearance_number.slice(2), 10);
      return `${prefix}${String(lastNum + 1).padStart(6, "0")}`;
    }
    return `${prefix}000001`;
  };

  const createMutation = useMutation({
    mutationFn: async (formData: CustomsClearanceFormData) => {
      const clearanceNumber = await getNextNumber();

      const { data, error } = await (supabase as any)
        .from("customs_clearances")
        .insert({
          clearance_number: clearanceNumber,
          company_id: selectedCompany!.id,
          business_year_id: selectedYear!.id,
          created_by: user!.id,
          ...formData,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CustomsClearance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customs-clearances"] });
      toast.success("Carinski obračun kreiran");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...formData }: CustomsClearanceFormData & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("customs_clearances")
        .update(formData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as CustomsClearance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customs-clearances"] });
      toast.success("Carinski obračun ažuriran");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("customs_clearances")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customs-clearances"] });
      toast.success("Carinski obračun obrisan");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const saveTotals = async (id: string, totals: {
    invoice_value_rsd: number;
    additional_costs_total: number;
    customs_base: number;
    vat_base: number;
    vat_amount: number;
    total_cost_value: number;
  }) => {
    const { error } = await (supabase as any)
      .from("customs_clearances")
      .update(totals)
      .eq("id", id);

    if (error) throw error;
  };

  // Items CRUD
  const fetchItems = async (clearanceId: string): Promise<CustomsClearanceItem[]> => {
    const { data, error } = await (supabase as any)
      .from("customs_clearance_items")
      .select("*")
      .eq("customs_clearance_id", clearanceId)
      .order("item_order");

    if (error) throw error;
    return (data || []) as CustomsClearanceItem[];
  };

  const saveItems = async (clearanceId: string, items: Omit<CustomsClearanceItem, "id" | "created_at">[]) => {
    // Delete existing items
    await (supabase as any)
      .from("customs_clearance_items")
      .delete()
      .eq("customs_clearance_id", clearanceId);

    if (items.length === 0) return;

    const { error } = await (supabase as any)
      .from("customs_clearance_items")
      .insert(items);

    if (error) throw error;
  };

  // Costs CRUD
  const fetchCosts = async (clearanceId: string): Promise<CustomsClearanceCost[]> => {
    const { data, error } = await (supabase as any)
      .from("customs_clearance_costs")
      .select("*, partner:partners(id, name, code)")
      .eq("customs_clearance_id", clearanceId)
      .order("item_order");

    if (error) throw error;
    return (data || []) as CustomsClearanceCost[];
  };

  const saveCosts = async (clearanceId: string, costs: Omit<CustomsClearanceCost, "id" | "created_at" | "partner">[]) => {
    await (supabase as any)
      .from("customs_clearance_costs")
      .delete()
      .eq("customs_clearance_id", clearanceId);

    if (costs.length === 0) return;

    const { error } = await (supabase as any)
      .from("customs_clearance_costs")
      .insert(costs);

    if (error) throw error;
  };

  // Fetch source invoice items for importing
  const fetchSourceInvoiceItems = async (invoiceId: string) => {
    const { data, error } = await supabase
      .from("goods_purchase_invoice_items")
      .select("*, article:articles(id, code, name, unit)")
      .eq("goods_purchase_invoice_id", invoiceId)
      .order("item_order");

    if (error) throw error;
    return data || [];
  };

  // Fetch already cleared quantities for a source invoice
  const fetchClearedQuantities = async (invoiceId: string, excludeClearanceId?: string) => {
    let query = (supabase as any)
      .from("customs_clearance_items")
      .select("source_item_id, quantity")
      .eq("company_id", selectedCompany!.id);

    // We need to join through clearances to filter by source_invoice_id
    const { data: clearances } = await (supabase as any)
      .from("customs_clearances")
      .select("id")
      .eq("source_invoice_id", invoiceId)
      .eq("company_id", selectedCompany!.id);

    if (!clearances || clearances.length === 0) return new Map<string, number>();

    const clearanceIds = clearances
      .map((c: any) => c.id)
      .filter((id: string) => id !== excludeClearanceId);

    if (clearanceIds.length === 0) return new Map<string, number>();

    const { data: items } = await (supabase as any)
      .from("customs_clearance_items")
      .select("source_item_id, quantity")
      .in("customs_clearance_id", clearanceIds);

    const map = new Map<string, number>();
    for (const item of items || []) {
      if (item.source_item_id) {
        map.set(item.source_item_id, (map.get(item.source_item_id) || 0) + item.quantity);
      }
    }
    return map;
  };

  const postClearance = async (id: string) => {
    if (!user?.id) throw new Error("Korisnik nije prijavljen");
    const { error } = await (supabase as any).rpc("post_customs_clearance", {
      _clearance_id: id,
      _user_id: user.id,
    });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["customs-clearances"] });
    queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfers"] });
    queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
  };

  const unpostClearance = async (id: string) => {
    if (!user?.id) throw new Error("Korisnik nije prijavljen");
    const { error } = await (supabase as any).rpc("unpost_customs_clearance", {
      _clearance_id: id,
      _user_id: user.id,
    });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["customs-clearances"] });
    queryClient.invalidateQueries({ queryKey: ["inter-warehouse-transfers"] });
    queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
  };

  return {
    clearances: clearancesQuery.data || [],
    isLoading: clearancesQuery.isLoading,
    createClearance: createMutation.mutateAsync,
    updateClearance: updateMutation.mutateAsync,
    deleteClearance: deleteMutation.mutateAsync,
    saveTotals,
    fetchItems,
    saveItems,
    fetchCosts,
    saveCosts,
    fetchSourceInvoiceItems,
    fetchClearedQuantities,
    postClearance,
    unpostClearance,
    isCreating: createMutation.isPending,
  };
}
