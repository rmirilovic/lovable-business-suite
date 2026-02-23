import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DeliveryOrder {
  id: string;
  company_id: string;
  business_year_id: string;
  order_number: string;
  order_date: string;
  partner_id: string;
  delivery_address: string | null;
  delivery_method: string | null;
  warehouse_id: string | null;
  payment_method: string | null;
  contact_person: string | null;
  ordered_by: string | null;
  note: string | null;
  composed_by: string | null;
  status: "draft" | "approved" | "reserved" | "shipped";
  source_quote_id: string | null;
  delivery_note_id: string | null;
  invoice_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  partner?: { id: string; code: string; name: string };
  warehouse?: { id: string; code: string; name: string } | null;
}

export interface DeliveryOrderItem {
  id: string;
  delivery_order_id: string;
  article_id: string;
  item_code: string;
  item_name: string;
  description: string | null;
  unit: string;
  quantity: number;
  item_order: number;
}

export interface DeliveryOrderItemData {
  article_id: string;
  item_code: string;
  item_name: string;
  description: string;
  unit: string;
  quantity: number;
  available_stock: number;
}

export interface DeliveryOrderFormData {
  order_date: string;
  partner_id: string;
  delivery_address: string;
  delivery_method: string;
  warehouse_id: string;
  payment_method: string;
  contact_person: string;
  ordered_by: string;
  note: string;
  composed_by: string;
}

export function useDeliveryOrders(companyId?: string, yearId?: string) {
  return useQuery({
    queryKey: ["delivery_orders", companyId, yearId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_orders")
        .select(`*, partner:partners(id, code, name), warehouse:warehouses(id, code, name)`)
        .eq("company_id", companyId!)
        .eq("business_year_id", yearId!)
        .order("order_date", { ascending: false });
      if (error) throw error;
      return data as DeliveryOrder[];
    },
    enabled: !!companyId && !!yearId,
  });
}

export function useDeliveryOrder(id?: string) {
  return useQuery({
    queryKey: ["delivery_order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_orders")
        .select(`*, partner:partners(id, code, name), warehouse:warehouses(id, code, name)`)
        .eq("id", id!)
        .single();
      if (error) throw error;

      const { data: items, error: itemsErr } = await supabase
        .from("delivery_order_items")
        .select("*")
        .eq("delivery_order_id", id!)
        .order("item_order");
      if (itemsErr) throw itemsErr;

      return { ...data, items: items || [] } as DeliveryOrder & { items: DeliveryOrderItem[] };
    },
    enabled: !!id,
  });
}

export function useCreateDeliveryOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ order, items }: { order: any; items: any[] }) => {
      // Generate order number client-side (YYNNNN)
      const { data: existing } = await supabase
        .from("delivery_orders")
        .select("order_number")
        .eq("company_id", order.company_id)
        .eq("business_year_id", order.business_year_id)
        .order("order_number", { ascending: false })
        .limit(1);

      const yearStr = String(new Date().getFullYear()).slice(2);
      let nextNum = 1;
      if (existing && existing.length > 0) {
        const last = existing[0].order_number;
        const num = parseInt(last.slice(2), 10);
        if (!isNaN(num)) nextNum = num + 1;
      }
      const orderNumber = yearStr + String(nextNum).padStart(4, "0");

      const { data: newOrder, error } = await supabase
        .from("delivery_orders")
        .insert({ ...order, order_number: orderNumber })
        .select()
        .single();
      if (error) throw error;

      if (items.length > 0) {
        const itemsToInsert = items.map((item, i) => ({
          ...item,
          delivery_order_id: newOrder.id,
          company_id: order.company_id,
          item_order: i + 1,
        }));
        const { error: itemsErr } = await supabase.from("delivery_order_items").insert(itemsToInsert);
        if (itemsErr) throw itemsErr;
      }
      return newOrder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery_orders"] });
      toast.success("Nalog za isporuku uspešno kreiran");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });
}

export function useUpdateDeliveryOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, order, items }: { id: string; order: any; items: any[] }) => {
      const { error } = await supabase.from("delivery_orders").update(order).eq("id", id);
      if (error) throw error;

      await supabase.from("delivery_order_items").delete().eq("delivery_order_id", id);
      if (items.length > 0) {
        const itemsToInsert = items.map((item, i) => ({
          ...item,
          delivery_order_id: id,
          company_id: order.company_id,
          item_order: i + 1,
        }));
        const { error: itemsErr } = await supabase.from("delivery_order_items").insert(itemsToInsert);
        if (itemsErr) throw itemsErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery_orders"] });
      qc.invalidateQueries({ queryKey: ["delivery_order"] });
      toast.success("Nalog za isporuku ažuriran");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });
}

export function useDeleteDeliveryOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery_orders"] });
      toast.success("Nalog za isporuku obrisan");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });
}

export function useApproveDeliveryOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase
        .from("delivery_orders")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: userId,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery_orders"] });
      qc.invalidateQueries({ queryKey: ["delivery_order"] });
      toast.success("Nalog odobren");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });
}

export function useReserveDeliveryOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      // Fetch the order with items
      const { data: order, error: orderErr } = await supabase
        .from("delivery_orders")
        .select("*")
        .eq("id", id)
        .single();
      if (orderErr) throw orderErr;

      if (!order.warehouse_id) throw new Error("Magacin nije definisan na nalogu");

      const { data: items, error: itemsErr } = await supabase
        .from("delivery_order_items")
        .select("*")
        .eq("delivery_order_id", id);
      if (itemsErr) throw itemsErr;
      if (!items || items.length === 0) throw new Error("Nalog mora imati stavke");

      // Fetch warehouse code
      const { data: wh } = await supabase.from("warehouses").select("code").eq("id", order.warehouse_id).single();

      // Fetch partner info
      const { data: partner } = await supabase.from("partners").select("code, name").eq("id", order.partner_id).single();

      // Fetch user profile
      const { data: profile } = await supabase.from("profiles").select("first_name, last_name").eq("id", userId).single();
      const userName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "";

      // Create reservations for each item
      for (const item of items) {
        await supabase.from("warehouse_reservations").insert({
          company_id: order.company_id,
          business_year_id: order.business_year_id,
          warehouse_id: order.warehouse_id,
          article_id: item.article_id,
          article_code: item.item_code,
          article_name: item.item_name,
          unit: item.unit,
          quantity: item.quantity,
          reservation_date: order.order_date,
          document_type: "Nalog za isporuku",
          document_id: order.id,
          document_number: order.order_number,
          partner_id: order.partner_id,
          partner_code: partner?.code || null,
          partner_name: partner?.name || null,
          note: null,
          created_by: userId,
          created_by_name: userName,
        });
      }

      // Update order status
      const { error: updateErr } = await supabase
        .from("delivery_orders")
        .update({
          status: "reserved",
          approved_at: new Date().toISOString(),
          approved_by: userId,
        })
        .eq("id", id);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery_orders"] });
      qc.invalidateQueries({ queryKey: ["delivery_order"] });
      qc.invalidateQueries({ queryKey: ["warehouse-reservations"] });
      qc.invalidateQueries({ queryKey: ["stock-with-reservations"] });
      toast.success("Nalog rezervisan - artikli rezervisani u magacinu");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });
}
