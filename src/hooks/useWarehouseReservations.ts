import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WarehouseReservation {
  id: string;
  company_id: string;
  business_year_id: string;
  warehouse_id: string;
  warehouse_code: string;
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  quantity: number;
  reservation_date: string;
  document_type: string;
  document_id: string | null;
  document_number: string;
  partner_id: string | null;
  partner_code: string | null;
  partner_name: string | null;
  note: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface StockWithReservationsRow {
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  balance_qty: number;
  balance_value: number;
  unit_price: number;
  reserved_delivery_notes: number;
  reserved_delivery_orders: number;
  reserved_other: number;
  total_reserved: number;
  available_qty: number;
}

export function useWarehouseReservations(
  companyId: string | undefined,
  warehouseId?: string,
  businessYearId?: string
) {
  return useQuery({
    queryKey: ["warehouse-reservations", companyId, warehouseId, businessYearId],
    queryFn: async () => {
      let query = supabase
        .from("warehouse_reservations")
        .select("*, warehouses!warehouse_reservations_warehouse_id_fkey(code)")
        .eq("company_id", companyId!)
        .order("reservation_date", { ascending: false });

      if (warehouseId) query = query.eq("warehouse_id", warehouseId);
      if (businessYearId) query = query.eq("business_year_id", businessYearId);

      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        warehouse_code: r.warehouses?.code ?? "",
      })) as WarehouseReservation[];
    },
    enabled: !!companyId,
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reservation: Omit<WarehouseReservation, "id" | "created_at" | "updated_at">) => {
      const { warehouse_code, ...insertData } = reservation;
      const { data, error } = await supabase
        .from("warehouse_reservations")
        .insert(insertData as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["stock-with-reservations"] });
    },
  });
}

export function useDeleteReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("warehouse_reservations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["stock-with-reservations"] });
    },
  });
}

export function useStockWithReservations(
  companyId: string | undefined,
  warehouseId: string | undefined,
  dateTo?: string
) {
  return useQuery({
    queryKey: ["stock-with-reservations", companyId, warehouseId, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_warehouse_stock_with_reservations", {
        p_company_id: companyId!,
        p_warehouse_id: warehouseId!,
        p_date_to: dateTo || null,
      });
      if (error) throw error;
      return (data as unknown as StockWithReservationsRow[]) ?? [];
    },
    enabled: !!companyId && !!warehouseId,
  });
}
