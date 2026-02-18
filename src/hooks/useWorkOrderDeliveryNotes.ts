import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DeliveryNoteItem {
  id: string;
  article_code: string;
  qty_shift_1: number;
  qty_shift_2: number;
  qty_shift_3: number;
  qty_total: number;
  delivered_kg: number;
  unit_price: number;
  item_value: number;
}

interface WorkOrderDeliveryNote {
  id: string;
  delivery_number: string;
  delivery_date: string;
  production_line: number;
  items: DeliveryNoteItem[];
}

export function useWorkOrderDeliveryNotes(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ["work-order-delivery-notes", workOrderId],
    queryFn: async () => {
      if (!workOrderId) return [];

      const { data: notes, error } = await (supabase as any)
        .from("production_delivery_notes")
        .select("id, delivery_number, delivery_date, production_line")
        .eq("work_order_id", workOrderId)
        .order("delivery_number");

      if (error) throw error;
      if (!notes || notes.length === 0) return [];

      // Fetch items for all notes
      const noteIds = notes.map((n: any) => n.id);
      const { data: items, error: itemsError } = await (supabase as any)
        .from("production_delivery_note_items")
        .select("id, delivery_note_id, article_code, qty_shift_1, qty_shift_2, qty_shift_3, qty_total, delivered_kg, unit_price, item_value")
        .in("delivery_note_id", noteIds)
        .order("item_order");

      if (itemsError) throw itemsError;

      return notes.map((n: any) => ({
        ...n,
        items: (items || []).filter((i: any) => i.delivery_note_id === n.id),
      })) as WorkOrderDeliveryNote[];
    },
    enabled: !!workOrderId,
  });
}
