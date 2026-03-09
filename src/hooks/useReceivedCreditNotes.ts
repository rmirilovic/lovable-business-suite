import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ReceivedCreditNote {
  id: string;
  company_id: string;
  business_year_id: string;
  internal_number: string;
  supplier_document_number: string;
  document_date: string;
  receipt_date: string;
  due_date: string | null;
  partner_id: string;
  supplier_name: string | null;
  supplier_address: string | null;
  supplier_city: string | null;
  supplier_postal_code: string | null;
  supplier_pib: string | null;
  supplier_mb: string | null;
  supplier_is_in_pdv: boolean;
  supplier_bank_account: string | null;
  payment_reference: string | null;
  has_internal_vat_calculation: boolean;
  org_unit_id: string | null;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  note: string | null;
  internal_note: string | null;
  currency: string;
  exchange_rate: number;
  status: "draft" | "posted" | "cancelled";
  posted_at: string | null;
  posted_by: string | null;
  journal_entry_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  partner?: {
    id: string;
    name: string;
    code: string;
    pib: string | null;
    mb: string | null;
    is_in_pdv: boolean;
    address: string | null;
    city: string | null;
    postal_code: string | null;
  };
  org_unit?: { id: string; code: string; name: string } | null;
}

export interface ReceivedCreditNoteItem {
  id: string;
  received_credit_note_id: string;
  company_id: string;
  input_cost_id: string | null;
  item_code: string | null;
  item_name: string;
  description: string | null;
  org_unit_id: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  foreign_unit_price: number;
  discount_percent: number;
  vat_rate: number;
  is_vat_deductible: boolean;
  line_subtotal: number;
  line_vat: number;
  line_total: number;
  item_order: number;
  created_at: string;
  input_cost?: { id: string; code: string; name: string; account_code: string };
  org_unit?: { id: string; code: string; name: string };
}

export interface ReceivedCreditNoteFormData {
  supplier_document_number: string;
  document_date: string;
  receipt_date: string;
  due_date: string | null;
  partner_id: string;
  supplier_name: string | null;
  supplier_address: string | null;
  supplier_city: string | null;
  supplier_postal_code: string | null;
  supplier_pib: string | null;
  supplier_mb: string | null;
  supplier_is_in_pdv: boolean;
  supplier_bank_account: string | null;
  payment_reference: string | null;
  has_internal_vat_calculation: boolean;
  note: string | null;
  internal_note: string | null;
  currency: string;
  exchange_rate: number;
}

export interface ReceivedCreditNoteItemFormData {
  input_cost_id: string | null;
  item_code: string | null;
  item_name: string;
  description: string | null;
  org_unit_id: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  foreign_unit_price: number;
  discount_percent: number;
  vat_rate: number;
  is_vat_deductible: boolean;
}

const SELECT_QUERY = `
  *,
  partner:partners(id, name, code, pib, mb, is_in_pdv, address, city, postal_code),
  org_unit:organizational_units(id, code, name)
`;

export function useReceivedCreditNotes() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const docsQuery = useQuery({
    queryKey: ["received-credit-notes", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      const { data, error } = await supabase
        .from("received_credit_notes")
        .select(SELECT_QUERY)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("internal_number", { ascending: false });
      if (error) throw error;
      return data as ReceivedCreditNote[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const createDoc = useMutation({
    mutationFn: async (formData: ReceivedCreditNoteFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) throw new Error("Potrebno je izabrati firmu i godinu");
      const { data: numberData, error: numberError } = await supabase.rpc("get_next_purchase_invoice_number", {
        _company_id: selectedCompany.id, _year_id: selectedYear.id, _invoice_type: "received_credit_note",
      });
      if (numberError) throw numberError;
      const { data, error } = await supabase
        .from("received_credit_notes")
        .insert({ company_id: selectedCompany.id, business_year_id: selectedYear.id, internal_number: numberData, ...formData, created_by: user.id })
        .select(SELECT_QUERY)
        .single();
      if (error) throw error;
      return data as ReceivedCreditNote;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["received-credit-notes"] }); toast.success("Primljeno KO je kreirano"); },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const updateDoc = useMutation({
    mutationFn: async ({ id, ...formData }: ReceivedCreditNoteFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("received_credit_notes")
        .update(formData)
        .eq("id", id)
        .select(SELECT_QUERY)
        .single();
      if (error) throw error;
      return data as ReceivedCreditNote;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["received-credit-notes"] }); toast.success("Dokument je ažuriran"); },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("received_credit_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["received-credit-notes"] }); toast.success("Dokument je obrisan"); },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const postDoc = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");
      const { error } = await supabase.rpc("post_received_credit_note", { _doc_id: id, _user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["received-credit-notes"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Dokument je proknjižen");
    },
    onError: (e) => toast.error(`Greška pri knjiženju: ${e.message}`),
  });

  const unpostDoc = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");
      const { error } = await supabase.rpc("unpost_received_credit_note", { _doc_id: id, _user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["received-credit-notes"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Knjiženje je poništeno");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const updateTotals = useMutation({
    mutationFn: async ({ docId, subtotal, vat_amount, total_amount }: { docId: string; subtotal: number; vat_amount: number; total_amount: number }) => {
      const { data, error } = await supabase
        .from("received_credit_notes")
        .update({ subtotal, vat_amount, total_amount })
        .eq("id", docId)
        .select("updated_at")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["received-credit-notes"] }),
  });

  return {
    docs: docsQuery.data || [],
    isLoading: docsQuery.isLoading,
    createDoc,
    updateDoc,
    deleteDoc,
    postDoc,
    unpostDoc,
    updateTotals,
  };
}

export function useReceivedCreditNoteItems(docId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["received-credit-note-items", docId],
    queryFn: async () => {
      if (!docId) return [];
      const { data, error } = await supabase
        .from("received_credit_note_items")
        .select(`*, input_cost:input_costs(id, code, name, account_code), org_unit:organizational_units(id, code, name)`)
        .eq("received_credit_note_id", docId)
        .order("item_order");
      if (error) throw error;
      return data as ReceivedCreditNoteItem[];
    },
    enabled: !!docId,
  });

  const addItem = useMutation({
    mutationFn: async (item: ReceivedCreditNoteItemFormData & { received_credit_note_id: string }) => {
      if (!selectedCompany?.id) throw new Error("Potrebno je izabrati firmu");
      const { data: parentDoc } = await supabase.from("received_credit_notes").select("supplier_is_in_pdv").eq("id", item.received_credit_note_id).single();
      const supplierInPdv = parentDoc?.supplier_is_in_pdv ?? true;
      const grossAmount = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      let lineSubtotal: number, lineVat: number, lineTotal: number;
      if (supplierInPdv) {
        lineSubtotal = grossAmount / (1 + item.vat_rate / 100);
        lineVat = grossAmount - lineSubtotal;
        lineTotal = grossAmount;
      } else {
        lineSubtotal = grossAmount; lineVat = 0; lineTotal = grossAmount;
      }
      const { data: existing } = await supabase.from("received_credit_note_items").select("item_order").eq("received_credit_note_id", item.received_credit_note_id).order("item_order", { ascending: false }).limit(1);
      const nextOrder = (existing?.[0]?.item_order || 0) + 1;
      const { data, error } = await supabase
        .from("received_credit_note_items")
        .insert({ received_credit_note_id: item.received_credit_note_id, company_id: selectedCompany.id, item_order: nextOrder, input_cost_id: item.input_cost_id, item_code: item.item_code, item_name: item.item_name, description: item.description, org_unit_id: item.org_unit_id, unit: item.unit, quantity: item.quantity, unit_price: item.unit_price, foreign_unit_price: item.foreign_unit_price, discount_percent: item.discount_percent, vat_rate: item.vat_rate, is_vat_deductible: item.is_vat_deductible, line_subtotal: lineSubtotal, line_vat: lineVat, line_total: lineTotal })
        .select(`*, input_cost:input_costs(id, code, name, account_code), org_unit:organizational_units(id, code, name)`)
        .single();
      if (error) throw error;
      return data as ReceivedCreditNoteItem;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["received-credit-note-items", docId] }),
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...item }: ReceivedCreditNoteItemFormData & { id: string }) => {
      const { data: parentItem } = await supabase.from("received_credit_note_items").select("received_credit_note_id").eq("id", id).single();
      let supplierInPdv = true;
      if (parentItem) {
        const { data: doc } = await supabase.from("received_credit_notes").select("supplier_is_in_pdv").eq("id", parentItem.received_credit_note_id).single();
        supplierInPdv = doc?.supplier_is_in_pdv ?? true;
      }
      const grossAmount = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      let lineSubtotal: number, lineVat: number, lineTotal: number;
      if (supplierInPdv) {
        lineSubtotal = grossAmount / (1 + item.vat_rate / 100);
        lineVat = grossAmount - lineSubtotal;
        lineTotal = grossAmount;
      } else {
        lineSubtotal = grossAmount; lineVat = 0; lineTotal = grossAmount;
      }
      const { data, error } = await supabase
        .from("received_credit_note_items")
        .update({ input_cost_id: item.input_cost_id, item_code: item.item_code, item_name: item.item_name, description: item.description, org_unit_id: item.org_unit_id, unit: item.unit, quantity: item.quantity, unit_price: item.unit_price, foreign_unit_price: item.foreign_unit_price, discount_percent: item.discount_percent, vat_rate: item.vat_rate, is_vat_deductible: item.is_vat_deductible, line_subtotal: lineSubtotal, line_vat: lineVat, line_total: lineTotal })
        .eq("id", id)
        .select(`*, input_cost:input_costs(id, code, name, account_code), org_unit:organizational_units(id, code, name)`)
        .single();
      if (error) throw error;
      return data as ReceivedCreditNoteItem;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["received-credit-note-items", docId] }); toast.success("Stavka je ažurirana"); },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("received_credit_note_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["received-credit-note-items", docId] }),
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  return { items: itemsQuery.data || [], isLoading: itemsQuery.isLoading, addItem, updateItem, deleteItem };
}
