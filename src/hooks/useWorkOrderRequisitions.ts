import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WorkOrderRequisitionRow {
  id: string;
  requisition_date: string;
  requisition_number: string;
  warehouse_code: string;
  warehouse_name: string;
  total_value: number;
}

export function useWorkOrderRequisitions(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ["work-order-requisitions", workOrderId],
    queryFn: async () => {
      if (!workOrderId) return [];

      const { data: reqs, error } = await (supabase as any)
        .from("material_requisitions")
        .select("id, requisition_date, requisition_number, warehouse_id, status")
        .eq("work_order_id", workOrderId)
        .order("requisition_date", { ascending: true });

      if (error) throw error;
      if (!reqs || reqs.length === 0) return [];

      // Get warehouse info
      const whIds = [...new Set(reqs.map((r: any) => r.warehouse_id))];
      const { data: warehouses } = await (supabase as any)
        .from("warehouses")
        .select("id, code, name")
        .in("id", whIds);

      const whMap: Record<string, { code: string; name: string }> = {};
      for (const w of warehouses || []) {
        whMap[w.id] = { code: w.code, name: w.name };
      }

      // Get total values per requisition
      const reqIds = reqs.map((r: any) => r.id);
      const { data: items } = await (supabase as any)
        .from("material_requisition_items")
        .select("requisition_id, item_value")
        .in("requisition_id", reqIds);

      const valueMap: Record<string, number> = {};
      for (const item of items || []) {
        valueMap[item.requisition_id] = (valueMap[item.requisition_id] || 0) + (Number(item.item_value) || 0);
      }

      return reqs.map((r: any) => ({
        id: r.id,
        requisition_date: r.requisition_date,
        requisition_number: r.requisition_number,
        warehouse_code: whMap[r.warehouse_id]?.code || "",
        warehouse_name: whMap[r.warehouse_id]?.name || "",
        total_value: valueMap[r.id] || 0,
      })) as WorkOrderRequisitionRow[];
    },
    enabled: !!workOrderId,
  });
}
