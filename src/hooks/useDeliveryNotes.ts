import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DeliveryNoteItem {
  id: string;
  delivery_note_id: string;
  article_id: string;
  item_code: string;
  item_name: string;
  description: string | null;
  unit: string;
  quantity: number;
  item_order: number;
}

export interface DeliveryNoteItemData {
  article_id: string;
  item_code: string;
  item_name: string;
  description: string;
  unit: string;
  quantity: number;
  available_stock: number;
}

export interface DeliveryNote {
  id: string;
  company_id: string;
  business_year_id: string;
  delivery_number: string;
  delivery_date: string;
  partner_id: string;
  warehouse_id: string | null;
  org_unit_id: string | null;
  delivery_address: string | null;
  delivery_method: string | null;
  issued_by: string | null;
  received_by: string | null;
  note: string | null;
  internal_note: string | null;
  status: "draft" | "posted" | "cancelled";
  invoice_id: string | null;
  invoice?: { id: string; invoice_number: string } | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  posted_at: string | null;
  posted_by: string | null;
  partner?: { id: string; code: string; name: string };
  warehouse?: { id: string; code: string; name: string } | null;
}

export interface DeliveryNoteWithItems extends DeliveryNote {
  items: DeliveryNoteItem[];
}

async function fetchDeliveryNotes(companyId: string, yearId: string): Promise<DeliveryNote[]> {
  const { data, error } = await supabase
    .from("delivery_notes")
    .select(`*, partner:partners(id, code, name), warehouse:warehouses(id, code, name), invoice:invoices!delivery_notes_invoice_id_fkey(id, invoice_number)`)
    .eq("company_id", companyId)
    .eq("business_year_id", yearId)
    .order("delivery_date", { ascending: false });
  if (error) throw error;
  return data as DeliveryNote[];
}

async function fetchDeliveryNoteWithItems(id: string): Promise<DeliveryNoteWithItems> {
  const { data: dn, error: dnErr } = await supabase
    .from("delivery_notes")
    .select(`*, partner:partners(id, code, name), warehouse:warehouses(id, code, name)`)
    .eq("id", id)
    .single();
  if (dnErr) throw dnErr;
  const { data: items, error: itemsErr } = await supabase
    .from("delivery_note_items")
    .select("*")
    .eq("delivery_note_id", id)
    .order("item_order");
  if (itemsErr) throw itemsErr;
  return { ...dn, items: items || [] } as DeliveryNoteWithItems;
}

export function useDeliveryNotes(companyId: string | undefined, yearId: string | undefined) {
  return useQuery({
    queryKey: ["delivery_notes", companyId, yearId],
    queryFn: () => fetchDeliveryNotes(companyId!, yearId!),
    enabled: !!companyId && !!yearId,
  });
}

export function useDeliveryNoteWithItems(id: string | undefined) {
  return useQuery({
    queryKey: ["delivery_note", id],
    queryFn: () => fetchDeliveryNoteWithItems(id!),
    enabled: !!id,
  });
}

export function useCreateDeliveryNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deliveryNote, items }: { deliveryNote: any; items: any[] }) => {
      const { data: docNumber } = await supabase.rpc("get_next_document_number", {
        _company_id: deliveryNote.company_id,
        _year_id: deliveryNote.business_year_id,
        _doc_type: "delivery_note",
      });
      const { data: newDn, error: dnErr } = await supabase
        .from("delivery_notes")
        .insert({ ...deliveryNote, delivery_number: docNumber })
        .select()
        .single();
      if (dnErr) throw dnErr;
      if (items.length > 0) {
        const itemsToInsert = items.map((item, i) => ({
          ...item,
          delivery_note_id: newDn.id,
          company_id: deliveryNote.company_id,
          item_order: i + 1,
        }));
        const { error: itemsErr } = await supabase.from("delivery_note_items").insert(itemsToInsert);
        if (itemsErr) throw itemsErr;
      }
      return newDn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery_notes"] });
      toast.success("Otpremnica uspešno kreirana");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });
}

export function useUpdateDeliveryNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, deliveryNote, items }: { id: string; deliveryNote: any; items: any[] }) => {
      await supabase.from("delivery_notes").update(deliveryNote).eq("id", id);
      await supabase.from("delivery_note_items").delete().eq("delivery_note_id", id);
      if (items.length > 0) {
        const itemsToInsert = items.map((item, i) => ({
          ...item,
          delivery_note_id: id,
          company_id: deliveryNote.company_id,
          item_order: i + 1,
        }));
        await supabase.from("delivery_note_items").insert(itemsToInsert);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery_notes"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_note"] });
      toast.success("Otpremnica uspešno ažurirana");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });
}

export function useDeleteDeliveryNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery_notes"] });
      toast.success("Otpremnica obrisana");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });
}

export function usePostDeliveryNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deliveryNoteId, userId }: { deliveryNoteId: string; userId: string }) => {
      const { data, error } = await supabase.rpc("post_delivery_note", {
        _delivery_note_id: deliveryNoteId,
        _user_id: userId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery_notes"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_note"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_orders_for_dn"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["stock-with-reservations"] });
      toast.success("Otpremnica proknjižena - zalihe razdužene po magacinskim cenama");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });
}

export function useRevertDeliveryNoteToDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deliveryNoteId, userId }: { deliveryNoteId: string; userId: string }) => {
      const { data, error } = await supabase.rpc("unpost_delivery_note", {
        _delivery_note_id: deliveryNoteId,
        _user_id: userId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery_notes"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_note"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_orders_for_dn"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["stock-with-reservations"] });
      toast.success("Otpremnica vraćena u nacrt - zalihe vraćene");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });
}
export interface QuoteForDelivery {
  id: string;
  quote_number: string;
  quote_date: string;
  partner_id: string;
  partner_name: string;
  partner_code: string;
  material_item_count: number;
}

export function useQuotesForDelivery(companyId: string | undefined) {
  return useQuery({
    queryKey: ["quotes_for_delivery", companyId],
    queryFn: async () => {
      const { data: quotes } = await supabase
        .from("quotes")
        .select(`id, quote_number, quote_date, partner_id, partner:partners(name, code)`)
        .eq("company_id", companyId!)
        .eq("status", "posted");
      const result: QuoteForDelivery[] = [];
      for (const q of quotes || []) {
        const { data: items } = await supabase
          .from("quote_items")
          .select(`id, article:articles(svk)`)
          .eq("quote_id", q.id);
        const cnt = items?.filter((i) => i.article && ["1", "2", "9"].includes((i.article as any).svk)).length || 0;
        if (cnt > 0) {
          result.push({
            id: q.id,
            quote_number: q.quote_number,
            quote_date: q.quote_date,
            partner_id: q.partner_id,
            partner_name: (q.partner as any)?.name || "",
            partner_code: (q.partner as any)?.code || "",
            material_item_count: cnt,
          });
        }
      }
      return result;
    },
    enabled: !!companyId,
  });
}

export function useCreateDeliveryNoteFromQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId, companyId, yearId, warehouseId, userId }: any) => {
      const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
      const { data: quoteItems } = await supabase
        .from("quote_items")
        .select(`*, article:articles(id, svk)`)
        .eq("quote_id", quoteId);
      const materialItems = quoteItems?.filter((i) => i.article && ["1", "2", "9"].includes((i.article as any).svk)) || [];
      if (materialItems.length === 0) throw new Error("Nema materijalnih dobara");
      const { data: docNumber } = await supabase.rpc("get_next_document_number", {
        _company_id: companyId,
        _year_id: yearId,
        _doc_type: "delivery_note",
      });
      const { data: newDn, error } = await supabase
        .from("delivery_notes")
        .insert({
          company_id: companyId,
          business_year_id: yearId,
          delivery_number: docNumber,
          delivery_date: new Date().toISOString().split("T")[0],
          partner_id: quote.partner_id,
          warehouse_id: warehouseId,
          org_unit_id: quote.org_unit_id,
          note: `Iz ponude ${quote.quote_number}`,
          status: "draft",
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      const itemsToInsert = materialItems.map((item, i) => ({
        delivery_note_id: newDn.id,
        company_id: companyId,
        article_id: item.article_id,
        item_code: item.item_code,
        item_name: item.item_name,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        item_order: i + 1,
      }));
      await supabase.from("delivery_note_items").insert(itemsToInsert);
      return newDn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery_notes"] });
      toast.success("Otpremnica kreirana iz ponude");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });
}

export interface DeliveryOrderForDeliveryNote {
  id: string;
  order_number: string;
  order_date: string;
  partner_id: string;
  partner_name: string;
  partner_code: string;
  warehouse_id: string | null;
  warehouse_code: string | null;
  warehouse_name: string | null;
  delivery_address: string | null;
  note: string | null;
  status: string;
  item_count: number;
}

export function useDeliveryOrdersForDeliveryNote(companyId: string | undefined, yearId: string | undefined) {
  return useQuery({
    queryKey: ["delivery_orders_for_dn", companyId, yearId],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("delivery_orders")
        .select(`id, order_number, order_date, partner_id, status, warehouse_id, delivery_address, note, delivery_note_id, partner:partners(code, name), warehouse:warehouses(code, name)`)
        .eq("company_id", companyId!)
        .eq("business_year_id", yearId!)
        .in("status", ["approved", "reserved"])
        .is("delivery_note_id", null)
        .order("order_date", { ascending: false });

      const result: DeliveryOrderForDeliveryNote[] = [];
      for (const o of orders || []) {
        const { count } = await supabase
          .from("delivery_order_items")
          .select("id", { count: "exact", head: true })
          .eq("delivery_order_id", o.id);

        const partner = o.partner as any;
        const warehouse = o.warehouse as any;
        result.push({
          id: o.id,
          order_number: o.order_number,
          order_date: o.order_date,
          partner_id: o.partner_id,
          partner_name: partner?.name || "",
          partner_code: partner?.code || "",
          warehouse_id: o.warehouse_id,
          warehouse_code: warehouse?.code || null,
          warehouse_name: warehouse?.name || null,
          delivery_address: o.delivery_address,
          note: o.note,
          status: o.status,
          item_count: count || 0,
        });
      }
      return result;
    },
    enabled: !!companyId && !!yearId,
  });
}

export function useCreateDeliveryNoteFromOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, companyId, yearId, userId }: { orderId: string; companyId: string; yearId: string; userId: string }) => {
      // Fetch order
      const { data: order, error: orderErr } = await supabase
        .from("delivery_orders")
        .select("*")
        .eq("id", orderId)
        .single();
      if (orderErr) throw orderErr;

      // Fetch order items
      const { data: orderItems, error: itemsErr } = await supabase
        .from("delivery_order_items")
        .select("*")
        .eq("delivery_order_id", orderId)
        .order("item_order");
      if (itemsErr) throw itemsErr;
      if (!orderItems || orderItems.length === 0) throw new Error("Nalog nema stavke");

      // Generate delivery note number
      const { data: docNumber } = await supabase.rpc("get_next_document_number", {
        _company_id: companyId,
        _year_id: yearId,
        _doc_type: "delivery_note",
      });

      // Create delivery note
      const { data: newDn, error: dnErr } = await supabase
        .from("delivery_notes")
        .insert({
          company_id: companyId,
          business_year_id: yearId,
          delivery_number: docNumber,
          delivery_date: new Date().toISOString().split("T")[0],
          partner_id: order.partner_id,
          warehouse_id: order.warehouse_id,
          org_unit_id: null,
          delivery_address: order.delivery_address || null,
          delivery_method: order.delivery_method || null,
          issued_by: order.composed_by || null,
          internal_note: `Iz naloga za isporuku ${order.order_number}`,
          note: order.note || null,
          status: "draft",
          created_by: userId,
        })
        .select()
        .single();
      if (dnErr) throw dnErr;

      // Create delivery note items from order items
      const dnItems = orderItems.map((item, i) => ({
        delivery_note_id: newDn.id,
        company_id: companyId,
        article_id: item.article_id,
        item_code: item.item_code,
        item_name: item.item_name,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        item_order: i + 1,
      }));
      const { error: dnItemsErr } = await supabase.from("delivery_note_items").insert(dnItems);
      if (dnItemsErr) throw dnItemsErr;

      // Link delivery note back to the delivery order
      const { error: linkErr } = await supabase
        .from("delivery_orders")
        .update({ delivery_note_id: newDn.id })
        .eq("id", orderId);
      if (linkErr) throw linkErr;

      return newDn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery_notes"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_orders_for_dn"] });
      toast.success("Otpremnica kreirana iz naloga za isporuku");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });
}
