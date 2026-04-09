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

interface WarehouseRow {
  id: string;
  code: string;
  name: string;
}

interface ArticleMovementRow {
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
      const { data: warehouses, error: warehousesError } = await supabase
        .from("warehouses")
        .select("id, code, name")
        .eq("company_id", companyId!)
        .order("code", { ascending: true });

      if (warehousesError) throw warehousesError;

      const warehouseRows = (warehouses as WarehouseRow[]) ?? [];
      const movementResults = await Promise.all(
        warehouseRows.map(async (warehouse) => {
          const { data, error } = await supabase.rpc("get_article_warehouse_card", {
            p_company_id: companyId!,
            p_warehouse_id: warehouse.id,
            p_article_id: articleId!,
            p_date_from: dateFrom || null,
            p_date_to: dateTo || null,
          });

          if (error) throw error;

          return ((data as ArticleMovementRow[]) ?? []).map((movement) => ({
            warehouse_code: warehouse.code,
            warehouse_name: warehouse.name,
            warehouse_id: warehouse.id,
            ...movement,
          }));
        })
      );

      return movementResults
        .flat()
        .sort((a, b) => {
          const warehouseCompare = a.warehouse_code.localeCompare(b.warehouse_code, undefined, { numeric: true });
          if (warehouseCompare !== 0) return warehouseCompare;
          const dateCompare = a.movement_date.localeCompare(b.movement_date);
          if (dateCompare !== 0) return dateCompare;
          const typeCompare = a.document_type.localeCompare(b.document_type);
          if (typeCompare !== 0) return typeCompare;
          return a.document_number.localeCompare(b.document_number, undefined, { numeric: true });
        });
    },
    enabled: !!companyId && !!articleId,
  });
}
