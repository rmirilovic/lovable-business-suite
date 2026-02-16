import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WarehouseTurnoverRow {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  document_type: string;
  debit_value: number;
  credit_value: number;
  balance_value: number;
}

export function useWarehouseTurnover(
  companyId: string | undefined,
  dateFrom?: string,
  dateTo?: string
) {
  return useQuery({
    queryKey: ["warehouse-turnover", companyId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_warehouse_turnover", {
        p_company_id: companyId!,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
      });
      if (error) throw error;
      return (data as unknown as WarehouseTurnoverRow[]) ?? [];
    },
    enabled: !!companyId,
  });
}
