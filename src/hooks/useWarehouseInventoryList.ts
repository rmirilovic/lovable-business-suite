import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InventoryListRow {
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  opening_qty: number;
  in_qty: number;
  out_qty: number;
  turnover_qty: number;
  closing_qty: number;
}

export function useWarehouseInventoryList(
  companyId: string | undefined,
  warehouseId: string | undefined,
  dateFrom?: string,
  dateTo?: string
) {
  return useQuery({
    queryKey: ["warehouse-inventory-list", companyId, warehouseId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_warehouse_inventory_list", {
        p_company_id: companyId!,
        p_warehouse_id: warehouseId!,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
      });
      if (error) throw error;
      return (data as unknown as InventoryListRow[]) ?? [];
    },
    enabled: !!companyId && !!warehouseId,
  });
}
