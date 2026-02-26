import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CreditNote {
  id: string;
  company_id: string;
  business_year_id: string;
  org_unit_id: string | null;
  credit_note_number: string;
  credit_note_date: string;
  due_date: string | null;
  partner_id: string;
  source_invoice_id: string | null;
  billing_reference_number: string | null;
  billing_reference_date: string | null;
  status: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  note: string | null;
  internal_note: string | null;
  header_note: string | null;
  currency: string;
  payment_means_code: string;
  partner_country_code: string;
  partner_jbkjs: string | null;
  partner_name: string | null;
  partner_address: string | null;
  partner_city: string | null;
  partner_postal_code: string | null;
  partner_pib: string | null;
  partner_mb: string | null;
  composed_by: string | null;
  journal_entry_id: string | null;
  posted_at: string | null;
  posted_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  partner?: {
    id: string;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    pib: string | null;
    mb: string | null;
  };
}

export interface CreditNoteItem {
  id: string;
  credit_note_id: string;
  company_id: string;
  item_order: number;
  article_id: string | null;
  item_code: string | null;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  vat_rate: number;
  tax_category_code: string;
  tax_exemption_reason: string | null;
  line_subtotal: number;
  line_vat: number;
  line_total: number;
  description: string | null;
  created_at: string;
}

export interface CreditNoteFormData {
  credit_note_date: string;
  due_date: string | null;
  partner_id: string;
  org_unit_id: string | null;
  note: string | null;
  internal_note: string | null;
  source_invoice_id?: string | null;
  billing_reference_number?: string | null;
  billing_reference_date?: string | null;
  currency?: string;
  payment_means_code?: string;
  partner_country_code?: string;
  partner_jbkjs?: string | null;
}

export interface CreditNoteItemFormData {
  article_id: string | null;
  item_code: string | null;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  vat_rate: number;
  description: string | null;
}

export function useCreditNotes() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["credit-notes", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      const { data, error } = await supabase
        .from("credit_notes")
        .select(`*, partner:partners(id, name, code, address, city, postal_code, pib, mb)`)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("credit_note_number", { ascending: false });
      if (error) throw error;
      return data as CreditNote[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const createCreditNote = useMutation({
    mutationFn: async (formData: CreditNoteFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) throw new Error("Potrebno je izabrati firmu i godinu");
      const { data: num } = await supabase.rpc("get_next_document_number", {
        _company_id: selectedCompany.id,
        _year_id: selectedYear.id,
        _doc_type: "credit_note",
      });
      const { data, error } = await supabase
        .from("credit_notes")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          credit_note_number: num as string,
          credit_note_date: formData.credit_note_date,
          due_date: formData.due_date,
          partner_id: formData.partner_id,
          org_unit_id: formData.org_unit_id,
          note: formData.note,
          internal_note: formData.internal_note,
          source_invoice_id: formData.source_invoice_id || null,
          billing_reference_number: formData.billing_reference_number || null,
          billing_reference_date: formData.billing_reference_date || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
      toast.success("Knjižno odobrenje je uspešno kreirano");
    },
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const deleteCreditNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
      toast.success("Knjižno odobrenje je obrisano");
    },
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const updateCreditNote = useMutation({
    mutationFn: async ({ id, ...formData }: CreditNoteFormData & { id: string }) => {
      const payload: Record<string, any> = {
        credit_note_date: formData.credit_note_date,
        due_date: formData.due_date,
        partner_id: formData.partner_id,
        org_unit_id: formData.org_unit_id,
        note: formData.note,
        internal_note: formData.internal_note,
      };
      if (formData.source_invoice_id !== undefined) payload.source_invoice_id = formData.source_invoice_id;
      if (formData.billing_reference_number !== undefined) payload.billing_reference_number = formData.billing_reference_number;
      if (formData.billing_reference_date !== undefined) payload.billing_reference_date = formData.billing_reference_date;
      if (formData.currency !== undefined) payload.currency = formData.currency;
      if (formData.payment_means_code !== undefined) payload.payment_means_code = formData.payment_means_code;
      if (formData.partner_country_code !== undefined) payload.partner_country_code = formData.partner_country_code;
      if (formData.partner_jbkjs !== undefined) payload.partner_jbkjs = formData.partner_jbkjs;
      const { data, error } = await supabase.from("credit_notes").update(payload).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
      toast.success("Knjižno odobrenje je ažurirano");
    },
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const updateTotals = useMutation({
    mutationFn: async ({ id, subtotal, vat_amount, total_amount }: { id: string; subtotal: number; vat_amount: number; total_amount: number }) => {
      const { error } = await supabase.from("credit_notes").update({ subtotal, vat_amount, total_amount }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["credit-notes"] }),
  });

  return {
    creditNotes: query.data || [],
    isLoading: query.isLoading,
    createCreditNote,
    deleteCreditNote,
    updateCreditNote,
    updateTotals,
  };
}

export function useCreditNoteItems(creditNoteId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["credit-note-items", creditNoteId],
    queryFn: async () => {
      if (!creditNoteId) return [];
      const { data, error } = await supabase
        .from("credit_note_items")
        .select("*")
        .eq("credit_note_id", creditNoteId)
        .order("item_order");
      if (error) throw error;
      return data as CreditNoteItem[];
    },
    enabled: !!creditNoteId,
  });

  const addItem = useMutation({
    mutationFn: async (item: CreditNoteItemFormData & { credit_note_id: string }) => {
      if (!selectedCompany?.id) throw new Error("Potrebno je izabrati firmu");
      const lineSubtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      const lineVat = lineSubtotal * (item.vat_rate / 100);
      const lineTotal = lineSubtotal + lineVat;
      const { data: existing } = await supabase
        .from("credit_note_items")
        .select("item_order")
        .eq("credit_note_id", item.credit_note_id)
        .order("item_order", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.item_order || 0) + 1;
      const { data, error } = await supabase
        .from("credit_note_items")
        .insert({
          credit_note_id: item.credit_note_id,
          company_id: selectedCompany.id,
          item_order: nextOrder,
          article_id: item.article_id,
          item_code: item.item_code,
          item_name: item.item_name,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          vat_rate: item.vat_rate,
          line_subtotal: lineSubtotal,
          line_vat: lineVat,
          line_total: lineTotal,
          description: item.description,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["credit-note-items", creditNoteId] }),
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...item }: CreditNoteItemFormData & { id: string }) => {
      const lineSubtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      const lineVat = lineSubtotal * (item.vat_rate / 100);
      const lineTotal = lineSubtotal + lineVat;
      const { data, error } = await supabase
        .from("credit_note_items")
        .update({
          article_id: item.article_id,
          item_code: item.item_code,
          item_name: item.item_name,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          vat_rate: item.vat_rate,
          line_subtotal: lineSubtotal,
          line_vat: lineVat,
          line_total: lineTotal,
          description: item.description,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["credit-note-items", creditNoteId] }),
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_note_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["credit-note-items", creditNoteId] }),
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  return { items: itemsQuery.data || [], isLoading: itemsQuery.isLoading, addItem, updateItem, deleteItem };
}

/**
 * Create a credit note from an existing invoice, copying items
 */
export function useCreateCreditNoteFromInvoice() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) throw new Error("Potrebno je izabrati firmu i godinu");

      // Get invoice with partner
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .select("*, partner:partners(id, name, code, address, city, postal_code, pib, mb)")
        .eq("id", invoiceId)
        .single();
      if (invErr) throw invErr;

      // Get invoice items
      const { data: items, error: itemsErr } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("item_order");
      if (itemsErr) throw itemsErr;

      // Get next number
      const { data: num } = await supabase.rpc("get_next_document_number", {
        _company_id: selectedCompany.id,
        _year_id: selectedYear.id,
        _doc_type: "credit_note",
      });

      // Create credit note
      const { data: cn, error: cnErr } = await supabase
        .from("credit_notes")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          credit_note_number: num as string,
          credit_note_date: new Date().toISOString().substring(0, 10),
          due_date: invoice.due_date,
          partner_id: invoice.partner_id,
          org_unit_id: invoice.org_unit_id,
          source_invoice_id: invoiceId,
          billing_reference_number: invoice.invoice_number,
          billing_reference_date: invoice.invoice_date,
          partner_name: invoice.partner_name,
          partner_address: invoice.partner_address,
          partner_city: invoice.partner_city,
          partner_postal_code: invoice.partner_postal_code,
          partner_pib: invoice.partner_pib,
          partner_mb: invoice.partner_mb,
          subtotal: invoice.subtotal,
          vat_amount: invoice.vat_amount,
          total_amount: invoice.total_amount,
          created_by: user.id,
        })
        .select()
        .single();
      if (cnErr) throw cnErr;

      // Copy items
      if (items && items.length > 0) {
        const cnItems = items.map((item: any) => ({
          credit_note_id: cn.id,
          company_id: selectedCompany.id,
          item_order: item.item_order,
          article_id: item.article_id,
          item_code: item.item_code,
          item_name: item.item_name,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          vat_rate: item.vat_rate,
          line_subtotal: item.line_subtotal,
          line_vat: item.line_vat,
          line_total: item.line_total,
          description: item.description,
        }));
        const { error: ciErr } = await supabase.from("credit_note_items").insert(cnItems);
        if (ciErr) throw ciErr;
      }

      return cn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
      toast.success("Knjižno odobrenje je kreirano iz fakture");
    },
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });
}
