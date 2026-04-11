import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WarehouseStockByVariantRow {
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  variant_id: string | null;
  variant_code: string;
  variant_description: string;
  total_in_qty: number;
  total_in_value: number;
  total_out_qty: number;
  total_out_value: number;
  balance_qty: number;
  balance_value: number;
}

export function useWarehouseStockByVariant(
  companyId: string | undefined,
  warehouseId: string | undefined,
  dateFrom?: string,
  dateTo?: string
) {
  return useQuery({
    queryKey: ["warehouse-stock-by-variant", companyId, warehouseId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_warehouse_stock_by_variant", {
        p_company_id: companyId!,
        p_warehouse_id: warehouseId!,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
      });
      if (error) throw error;
      return (data as unknown as WarehouseStockByVariantRow[]) ?? [];
    },
    enabled: !!companyId && !!warehouseId,
  });
}
