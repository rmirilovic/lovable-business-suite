import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ReprocessingWorkOrder {
  id: string;
  company_id: string;
  business_year_id: string;
  order_number: string;
  order_date: string;
  deadline_date: string | null;
  warehouse_id: string;
  status: "draft" | "launched" | "closed";
  launched_at: string | null;
  launched_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  journal_entry_id: string | null;
  warehouse?: { id: string; code: string; name: string };
}

export interface RWOOutputItem {
  id: string;
  work_order_id: string;
  company_id: string;
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  launched_qty: number;
  unit_price: number;
  launched_value: number;
  kg_per_unit: number;
  item_order: number;
  created_at: string;
}

export interface RWOInputItem {
  id: string;
  work_order_id: string;
  company_id: string;
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  item_value: number;
  item_order: number;
  warehouse_id: string | null;
  created_at: string;
}

export interface RWOMaterial {
  id: string;
  work_order_id: string;
  company_id: string;
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  quantity: number;
  warehouse_id: string | null;
  unit_price: number;
  item_value: number;
  item_order: number;
  created_at: string;
}

export const RWO_STATUS_LABELS: Record<string, string> = {
  draft: "Nacrt",
  launched: "Lansiran",
  closed: "Zaključen",
};

export const RWO_STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  launched: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-primary text-primary-foreground",
};

export function useReprocessingWorkOrders() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;
  const yearId = selectedYear?.id;

  const ordersQuery = useQuery({
    queryKey: ["reprocessing-work-orders", companyId, yearId],
    queryFn: async () => {
      if (!companyId || !yearId) return [];
      const { data, error } = await (supabase as any)
        .from("reprocessing_work_orders")
        .select(`*, warehouse:warehouses(id, code, name)`)
        .eq("company_id", companyId)
        .eq("business_year_id", yearId)
        .order("order_number", { ascending: false });
      if (error) throw error;
      return data as ReprocessingWorkOrder[];
    },
    enabled: !!companyId && !!yearId,
  });

  const createOrder = useMutation({
    mutationFn: async (formData: {
      order_date: string;
      deadline_date?: string;
      warehouse_id: string;
      note?: string;
    }) => {
      if (!companyId || !yearId || !user?.id) throw new Error("Nedostaju podaci");

      const { data: orderNumber, error: numErr } = await (supabase as any).rpc(
        "get_next_reprocessing_wo_number",
        { _company_id: companyId, _year_id: yearId }
      );
      if (numErr) throw numErr;

      const { data, error } = await (supabase as any)
        .from("reprocessing_work_orders")
        .insert({
          company_id: companyId,
          business_year_id: yearId,
          order_number: orderNumber,
          order_date: formData.order_date,
          deadline_date: formData.deadline_date || null,
          warehouse_id: formData.warehouse_id,
          note: formData.note || null,
          created_by: user.id,
        })
        .select(`*, warehouse:warehouses(id, code, name)`)
        .single();
      if (error) throw error;
      return data as ReprocessingWorkOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reprocessing-work-orders"] });
      toast.success("RN za preradu kreiran");
    },
    onError: (e: any) => toast.error(`Greška: ${e.message}`),
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ReprocessingWorkOrder> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("reprocessing_work_orders")
        .update(updates)
        .eq("id", id)
        .select(`*, warehouse:warehouses(id, code, name)`)
        .single();
      if (error) throw error;
      return data as ReprocessingWorkOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reprocessing-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["reprocessing-work-order"] });
      toast.success("RN za preradu ažuriran");
    },
    onError: (e: any) => toast.error(`Greška: ${e.message}`),
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("reprocessing_work_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reprocessing-work-orders"] });
      toast.success("RN za preradu obrisan");
    },
    onError: (e: any) => toast.error(`Greška: ${e.message}`),
  });

  const launchOrder = useMutation({
    mutationFn: async ({ id, launched_at }: { id: string; launched_at?: string }) => {
      const { data, error } = await (supabase as any)
        .from("reprocessing_work_orders")
        .update({ status: "launched", launched_at: launched_at || new Date().toISOString(), launched_by: user?.id })
        .eq("id", id)
        .select(`*, warehouse:warehouses(id, code, name)`)
        .single();
      if (error) throw error;
      return data as ReprocessingWorkOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reprocessing-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["reprocessing-work-order"] });
      toast.success("RN za preradu lansiran");
    },
    onError: (e: any) => toast.error(`Greška: ${e.message}`),
  });

  const closeOrder = useMutation({
    mutationFn: async ({ id, closed_at }: { id: string; closed_at?: string }) => {
      const { data, error } = await (supabase as any).rpc("close_reprocessing_work_order", {
        _order_id: id,
        _user_id: user?.id,
      });
      if (error) throw error;
      // Update closed_at with provided date if different from now
      if (closed_at) {
        await (supabase as any).from("reprocessing_work_orders").update({ closed_at }).eq("id", id);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reprocessing-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["reprocessing-work-order"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("RN za preradu zaključen i proknjižen");
    },
    onError: (e: any) => toast.error(`Greška: ${e.message}`),
  });

  const reopenOrder = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("reopen_reprocessing_work_order", {
        _order_id: id,
        _user_id: user?.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reprocessing-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["reprocessing-work-order"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("RN za preradu vraćen u status Lansiran");
    },
    onError: (e: any) => toast.error(`Greška: ${e.message}`),
  });

  const unlaunchOrder = useMutation({
    mutationFn: async (id: string) => {
      // Check if there are any delivery notes
      const { data: dns } = await (supabase as any)
        .from("reprocessing_delivery_notes")
        .select("id")
        .eq("work_order_id", id)
        .limit(1);
      if (dns && dns.length > 0) {
        throw new Error("Nije moguće vratiti u Nacrt - postoje predajnice za ovaj radni nalog!");
      }
      const { data, error } = await (supabase as any)
        .from("reprocessing_work_orders")
        .update({ status: "draft", launched_at: null, launched_by: null })
        .eq("id", id)
        .select(`*, warehouse:warehouses(id, code, name)`)
        .single();
      if (error) throw error;
      return data as ReprocessingWorkOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reprocessing-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["reprocessing-work-order"] });
      toast.success("RN za preradu vraćen u status Nacrt");
    },
    onError: (e: any) => toast.error(`Greška: ${e.message}`),
  });

  return {
    orders: ordersQuery.data ?? [],
    isLoading: ordersQuery.isLoading,
    createOrder,
    updateOrder,
    deleteOrder,
    launchOrder,
    closeOrder,
    reopenOrder,
    unlaunchOrder,
  };
}

export function useReprocessingWorkOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["reprocessing-work-order", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reprocessing_work_orders")
        .select(`*, warehouse:warehouses(id, code, name)`)
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as ReprocessingWorkOrder;
    },
    enabled: !!id,
  });
}

export function useRWOOutputItems(workOrderId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["rwo-output-items", workOrderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reprocessing_wo_output_items")
        .select("*")
        .eq("work_order_id", workOrderId!)
        .order("item_order");
      if (error) throw error;
      return data as RWOOutputItem[];
    },
    enabled: !!workOrderId,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["rwo-output-items", workOrderId] });
  return { items: query.data ?? [], isLoading: query.isLoading, invalidate };
}

export function useRWOInputItems(workOrderId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["rwo-input-items", workOrderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reprocessing_wo_input_items")
        .select("*")
        .eq("work_order_id", workOrderId!)
        .order("item_order");
      if (error) throw error;
      return data as RWOInputItem[];
    },
    enabled: !!workOrderId,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["rwo-input-items", workOrderId] });
  return { items: query.data ?? [], isLoading: query.isLoading, invalidate };
}

export function useRWOMaterials(workOrderId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["rwo-materials", workOrderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reprocessing_wo_materials")
        .select("*")
        .eq("work_order_id", workOrderId!)
        .order("item_order");
      if (error) throw error;
      return data as RWOMaterial[];
    },
    enabled: !!workOrderId,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["rwo-materials", workOrderId] });
  return { materials: query.data ?? [], isLoading: query.isLoading, invalidate };
}
