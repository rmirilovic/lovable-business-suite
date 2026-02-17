import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IssuedMaterialRow {
  article_code: string;
  article_name: string;
  unit: string;
  total_qty: number;
  avg_price: number;
  total_value: number;
}

export function useIssuedMaterials(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ["issued-materials", workOrderId],
    queryFn: async () => {
      if (!workOrderId) return [];

      // Get all items from posted requisitions for this work order
      const { data: reqs, error: reqErr } = await (supabase as any)
        .from("material_requisitions")
        .select("id")
        .eq("work_order_id", workOrderId)
        .eq("status", "posted");

      if (reqErr) throw reqErr;
      if (!reqs || reqs.length === 0) return [];

      const reqIds = reqs.map((r: any) => r.id);

      const { data: items, error: itemErr } = await (supabase as any)
        .from("material_requisition_items")
        .select("article_code, article_name, unit, quantity, unit_price, item_value")
        .in("requisition_id", reqIds);

      if (itemErr) throw itemErr;
      if (!items || items.length === 0) return [];

      // Aggregate by article_code
      const map: Record<string, { article_code: string; article_name: string; unit: string; total_qty: number; total_value: number }> = {};

      for (const item of items) {
        const key = item.article_code;
        if (!map[key]) {
          map[key] = {
            article_code: item.article_code,
            article_name: item.article_name,
            unit: item.unit,
            total_qty: 0,
            total_value: 0,
          };
        }
        map[key].total_qty += Number(item.quantity) || 0;
        map[key].total_value += Number(item.item_value) || 0;
      }

      return Object.values(map).map((m) => ({
        ...m,
        avg_price: m.total_qty > 0 ? m.total_value / m.total_qty : 0,
      })) as IssuedMaterialRow[];
    },
    enabled: !!workOrderId,
  });
}
