import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WarehouseStockRow {
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  total_in_qty: number;
  total_in_value: number;
  total_out_qty: number;
  total_out_value: number;
  balance_qty: number;
  balance_value: number;
}

export interface ArticleMovementRow {
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

async function fetchWarehouseStock(
  companyId: string,
  warehouseId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<WarehouseStockRow[]> {
  const { data, error } = await supabase.rpc("get_warehouse_stock", {
    p_company_id: companyId,
    p_warehouse_id: warehouseId,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
  });
  if (error) throw error;
  return (data as unknown as WarehouseStockRow[]) ?? [];
}

async function fetchArticleWarehouseCard(
  companyId: string,
  warehouseId: string,
  articleId: string,
  dateFrom?: string,
  dateTo?: string,
  variantId?: string
): Promise<ArticleMovementRow[]> {
  // Use variant-aware RPC if variantId is provided
  if (variantId) {
    const { data, error } = await supabase.rpc("get_article_warehouse_card_by_variant", {
      p_company_id: companyId,
      p_warehouse_id: warehouseId,
      p_article_id: articleId,
      p_variant_id: variantId,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null,
    });
    if (error) throw error;
    return (data as unknown as ArticleMovementRow[]) ?? [];
  }
  const { data, error } = await supabase.rpc("get_article_warehouse_card", {
    p_company_id: companyId,
    p_warehouse_id: warehouseId,
    p_article_id: articleId,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
  });
  if (error) throw error;
  return (data as unknown as ArticleMovementRow[]) ?? [];
}

export function useWarehouseStock(
  companyId: string | undefined,
  warehouseId: string | undefined,
  dateFrom?: string,
  dateTo?: string
) {
  return useQuery({
    queryKey: ["warehouse-stock", companyId, warehouseId, dateFrom, dateTo],
    queryFn: () => fetchWarehouseStock(companyId!, warehouseId!, dateFrom, dateTo),
    enabled: !!companyId && !!warehouseId,
  });
}

export function useArticleWarehouseCard(
  companyId: string | undefined,
  warehouseId: string | undefined,
  articleId: string | undefined,
  dateFrom?: string,
  dateTo?: string,
  variantId?: string
) {
  return useQuery({
    queryKey: ["article-warehouse-card", companyId, warehouseId, articleId, dateFrom, dateTo, variantId],
    queryFn: () => fetchArticleWarehouseCard(companyId!, warehouseId!, articleId!, dateFrom, dateTo, variantId),
    enabled: !!companyId && !!warehouseId && !!articleId,
  });
}
