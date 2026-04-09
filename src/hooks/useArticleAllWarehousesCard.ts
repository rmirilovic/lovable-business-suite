import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AllWarehousesMovementRow {
  warehouse_code: string;
  warehouse_name: string;
  warehouse_id: string;
  movement_date: string;
  document_type: string;
  document_number: string;
  partner_name: string;
  in_quantity: number;
  out_quantity: number;
  unit_price: number;
  debit_value: number;
  credit_value: number;
}

export function useArticleAllWarehousesCard(
  companyId: string | undefined,
  articleId: string | undefined,
  dateFrom?: string,
  dateTo?: string
) {
  return useQuery({
    queryKey: ["article-all-warehouses-card", companyId, articleId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_article_all_warehouses_card", {
        p_company_id: companyId!,
        p_article_id: articleId!,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
      });
      if (error) throw error;
      return (data as unknown as AllWarehousesMovementRow[]) ?? [];
    },
    enabled: !!companyId && !!articleId,
  });
}
