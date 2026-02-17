import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface WorkOrder {
  id: string;
  company_id: string;
  business_year_id: string;
  order_number: string;
  order_date: string;
  deadline_date: string | null;
  warehouse_id: string;
  issued_by: string;
  production_note: string | null;
  plant_note: string | null;
  status: "draft" | "launched" | "closed";
  launched_at: string | null;
  launched_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  warehouse?: { id: string; code: string; name: string };
}

export interface WorkOrderItem {
  id: string;
  work_order_id: string;
  company_id: string;
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  variant_id: string | null;
  variant_name: string | null;
  launched_qty: number;
  kg_per_unit: number;
  launched_kg: number;
  launched_m: number;
  launched_pcs: number;
  unit_price: number;
  launched_value: number;
  item_order: number;
  created_at: string;
}

export interface WorkOrderMaterial {
  id: string;
  work_order_id: string;
  company_id: string;
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  norm_qty: number;
  approved_qty: number;
  warehouse_id: string | null;
  unit_price: number;
  material_value: number;
  item_order: number;
  created_at: string;
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Nacrt",
  launched: "Lansiran",
  closed: "Zaključen",
};

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  launched: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  closed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

export function useWorkOrders() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;
  const yearId = selectedYear?.id;

  const ordersQuery = useQuery({
    queryKey: ["work-orders", companyId, yearId],
    queryFn: async () => {
      if (!companyId || !yearId) return [];
      const { data, error } = await supabase
        .from("work_orders")
        .select(`*, warehouse:warehouses(id, code, name)`)
        .eq("company_id", companyId)
        .eq("business_year_id", yearId)
        .order("order_number", { ascending: false });
      if (error) throw error;
      return data as WorkOrder[];
    },
    enabled: !!companyId && !!yearId,
  });

  const createOrder = useMutation({
    mutationFn: async (formData: {
      order_date: string;
      deadline_date?: string;
      warehouse_id: string;
      issued_by: string;
      production_note?: string;
      plant_note?: string;
    }) => {
      if (!companyId || !yearId || !user?.id) throw new Error("Nedostaju podaci");

      const { data: orderNumber, error: numErr } = await supabase.rpc(
        "get_next_work_order_number",
        { _company_id: companyId, _year_id: yearId }
      );
      if (numErr) throw numErr;

      const { data, error } = await supabase
        .from("work_orders")
        .insert({
          company_id: companyId,
          business_year_id: yearId,
          order_number: orderNumber,
          order_date: formData.order_date,
          deadline_date: formData.deadline_date || null,
          warehouse_id: formData.warehouse_id,
          issued_by: formData.issued_by,
          production_note: formData.production_note || null,
          plant_note: formData.plant_note || null,
          created_by: user.id,
        })
        .select(`*, warehouse:warehouses(id, code, name)`)
        .single();
      if (error) throw error;
      return data as WorkOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      toast.success("Radni nalog uspešno kreiran");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from("work_orders")
        .update(updates)
        .eq("id", id)
        .select(`*, warehouse:warehouses(id, code, name)`)
        .single();
      if (error) throw error;
      return data as WorkOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-order"] });
      toast.success("Radni nalog ažuriran");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      toast.success("Radni nalog obrisan");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const launchOrder = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("work_orders")
        .update({ status: "launched", launched_at: new Date().toISOString(), launched_by: user?.id })
        .eq("id", id)
        .select(`*, warehouse:warehouses(id, code, name)`)
        .single();
      if (error) throw error;
      return data as WorkOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-order"] });
      toast.success("Radni nalog lansiran");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const closeOrder = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("work_orders")
        .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: user?.id })
        .eq("id", id)
        .select(`*, warehouse:warehouses(id, code, name)`)
        .single();
      if (error) throw error;
      return data as WorkOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-order"] });
      toast.success("Radni nalog zaključen");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  return {
    orders: ordersQuery.data ?? [],
    isLoading: ordersQuery.isLoading,
    createOrder,
    updateOrder,
    deleteOrder,
    launchOrder,
    closeOrder,
  };
}

export function useWorkOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["work-order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`*, warehouse:warehouses(id, code, name)`)
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as WorkOrder;
    },
    enabled: !!id,
  });
}

export function useWorkOrderItems(workOrderId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["work-order-items", workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_order_items")
        .select("*")
        .eq("work_order_id", workOrderId!)
        .order("item_order");
      if (error) throw error;
      return data as WorkOrderItem[];
    },
    enabled: !!workOrderId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["work-order-items", workOrderId] });

  return { items: query.data ?? [], isLoading: query.isLoading, invalidate };
}

export function useWorkOrderMaterials(workOrderId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["work-order-materials", workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_order_materials")
        .select("*")
        .eq("work_order_id", workOrderId!)
        .order("item_order");
      if (error) throw error;
      return data as WorkOrderMaterial[];
    },
    enabled: !!workOrderId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["work-order-materials", workOrderId] });

  return { materials: query.data ?? [], isLoading: query.isLoading, invalidate };
}
