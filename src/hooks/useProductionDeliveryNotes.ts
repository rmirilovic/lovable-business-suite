import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProductionDeliveryNote {
  id: string;
  company_id: string;
  business_year_id: string;
  delivery_number: string;
  work_order_id: string | null;
  delivery_date: string;
  warehouse_id: string;
  production_line: number;
  shift_manager_1_id: string | null;
  shift_manager_2_id: string | null;
  shift_manager_3_id: string | null;
  note: string | null;
  responsible_person: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  posted_at: string | null;
  posted_by: string | null;
  status: string;
  total_kg: number;
  total_value: number;
  warehouse?: { id: string; code: string; name: string };
  work_order?: { id: string; order_number: string } | null;
}

export interface ProductionDeliveryNoteItem {
  id: string;
  delivery_note_id: string;
  company_id: string;
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  kg_per_unit: number;
  launched_qty: number;
  qty_shift_1: number;
  qty_shift_2: number;
  qty_shift_3: number;
  qty_total: number;
  delivered_kg: number;
  delivered_m: number;
  delivered_pcs: number;
  scrap_qty: number;
  unit_price: number;
  item_value: number;
  item_order: number;
  created_at: string;
}

export const PDN_STATUS_LABELS: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjižena",
};

export const PDN_STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  posted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

export function useProductionDeliveryNotes() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;
  const yearId = selectedYear?.id;

  const notesQuery = useQuery({
    queryKey: ["production-delivery-notes", companyId, yearId],
    queryFn: async () => {
      if (!companyId || !yearId) return [];
      const { data, error } = await (supabase as any)
        .from("production_delivery_notes")
        .select(`*, warehouse:warehouses(id, code, name), work_order:work_orders(id, order_number)`)
        .eq("company_id", companyId)
        .eq("business_year_id", yearId)
        .order("delivery_number", { ascending: false });
      if (error) throw error;
      return data as ProductionDeliveryNote[];
    },
    enabled: !!companyId && !!yearId,
  });

  const createNote = useMutation({
    mutationFn: async (formData: {
      delivery_date: string;
      warehouse_id: string;
      work_order_id?: string;
      production_line: number;
      responsible_person: string;
    }) => {
      if (!companyId || !yearId || !user?.id) throw new Error("Nedostaju podaci");

      // Generate next number client-side
      const yearStr = String(selectedYear?.year ?? new Date().getFullYear()).slice(-2);
      const { data: existing } = await (supabase as any)
        .from("production_delivery_notes")
        .select("delivery_number")
        .eq("company_id", companyId)
        .eq("business_year_id", yearId)
        .order("delivery_number", { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (existing && existing.length > 0) {
        const lastNum = parseInt(existing[0].delivery_number.slice(2), 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      const deliveryNumber = `${yearStr}${String(nextNum).padStart(4, "0")}`;

      const { data, error } = await (supabase as any)
        .from("production_delivery_notes")
        .insert({
          company_id: companyId,
          business_year_id: yearId,
          delivery_number: deliveryNumber,
          delivery_date: formData.delivery_date,
          warehouse_id: formData.warehouse_id,
          work_order_id: formData.work_order_id || null,
          production_line: formData.production_line,
          responsible_person: formData.responsible_person,
          created_by: user.id,
        })
        .select(`*, warehouse:warehouses(id, code, name), work_order:work_orders(id, order_number)`)
        .single();
      if (error) throw error;

      // Auto-insert items from work order
      if (formData.work_order_id) {
        const { data: woItems } = await supabase
          .from("work_order_items")
          .select("*")
          .eq("work_order_id", formData.work_order_id)
          .order("item_order");

        if (woItems && woItems.length > 0) {
          const itemsToInsert = woItems.map((wi: any, idx: number) => ({
            delivery_note_id: data.id,
            company_id: companyId,
            article_id: wi.article_id,
            article_code: wi.article_code,
            article_name: wi.article_name,
            unit: wi.unit,
            kg_per_unit: wi.kg_per_unit ?? 0,
            launched_qty: Number(wi.launched_qty ?? 0),
            unit_price: Number(wi.unit_price ?? 0),
            item_order: idx + 1,
          }));
          await (supabase as any)
            .from("production_delivery_note_items")
            .insert(itemsToInsert);
        }
      }

      return data as ProductionDeliveryNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-delivery-notes"] });
      toast.success("Predajnica kreirana");
    },
    onError: (e: any) => toast.error(`Greška: ${e.message}`),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("production_delivery_notes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-delivery-notes"] });
      toast.success("Predajnica obrisana");
    },
    onError: (e: any) => toast.error(`Greška: ${e.message}`),
  });

  const postNote = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("post_production_delivery_note", {
        _note_id: id,
        _user_id: user?.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["production-delivery-note"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Predajnica proknjižena");
    },
    onError: (e: any) => toast.error(`Greška: ${e.message}`),
  });

  const unpostNote = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("unpost_production_delivery_note", {
        _note_id: id,
        _user_id: user?.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["production-delivery-note"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Knjiženje predajnice poništeno");
    },
    onError: (e: any) => toast.error(`Greška: ${e.message}`),
  });

  return {
    notes: notesQuery.data ?? [],
    isLoading: notesQuery.isLoading,
    createNote,
    deleteNote,
    postNote,
    unpostNote,
  };
}

export function useProductionDeliveryNote(id: string | undefined) {
  return useQuery({
    queryKey: ["production-delivery-note", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("production_delivery_notes")
        .select(`*, warehouse:warehouses(id, code, name), work_order:work_orders(id, order_number)`)
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as ProductionDeliveryNote;
    },
    enabled: !!id,
  });
}

export function useProductionDeliveryNoteItems(noteId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["production-delivery-note-items", noteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("production_delivery_note_items")
        .select("*")
        .eq("delivery_note_id", noteId!)
        .order("item_order");
      if (error) throw error;
      return data as ProductionDeliveryNoteItem[];
    },
    enabled: !!noteId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["production-delivery-note-items", noteId] });

  return { items: query.data ?? [], isLoading: query.isLoading, invalidate };
}
