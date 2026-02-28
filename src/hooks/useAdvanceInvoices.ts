import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface AdvanceInvoice {
  id: string;
  company_id: string;
  business_year_id: string;
  org_unit_id: string | null;
  advance_number: string;
  advance_date: string;
  due_date: string | null;
  partner_id: string;
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
  contract_reference: string | null;
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
  payment_date: string | null;
  payment_amount: number;
  payment_reference: string | null;
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

export interface AdvanceInvoiceItem {
  id: string;
  advance_invoice_id: string;
  company_id: string;
  item_order: number;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  tax_category_code: string;
  tax_exemption_reason: string | null;
  line_subtotal: number;
  line_vat: number;
  line_total: number;
  created_at: string;
}

export interface AdvanceInvoiceFormData {
  advance_date: string;
  due_date: string | null;
  partner_id: string;
  org_unit_id: string | null;
  note: string | null;
  internal_note: string | null;
  currency?: string;
  payment_means_code?: string;
  partner_country_code?: string;
  partner_jbkjs?: string | null;
  contract_reference?: string | null;
  payment_date?: string | null;
  payment_amount?: number;
  payment_reference?: string | null;
}

export interface AdvanceInvoiceItemFormData {
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  tax_category_code?: string;
  tax_exemption_reason?: string | null;
}

export function useAdvanceInvoices() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["advance-invoices", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      const { data, error } = await supabase
        .from("advance_invoices")
        .select(`*, partner:partners(id, name, code, address, city, postal_code, pib, mb)`)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("advance_number", { ascending: false });
      if (error) throw error;
      return data as AdvanceInvoice[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const createAdvanceInvoice = useMutation({
    mutationFn: async (formData: AdvanceInvoiceFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) throw new Error("Potrebno je izabrati firmu i godinu");
      const { data: num } = await supabase.rpc("get_next_document_number", {
        _company_id: selectedCompany.id,
        _year_id: selectedYear.id,
        _doc_type: "advance_invoice",
      });
       const { data, error } = await supabase
         .from("advance_invoices")
         .insert({
           company_id: selectedCompany.id,
           business_year_id: selectedYear.id,
           advance_number: num as string,
           advance_date: formData.advance_date,
           due_date: formData.due_date,
           partner_id: formData.partner_id,
           org_unit_id: formData.org_unit_id,
           note: formData.note,
           internal_note: formData.internal_note,
           created_by: user.id,
           payment_date: formData.payment_date || null,
           payment_amount: formData.payment_amount || 0,
           payment_reference: formData.payment_reference || null,
         })
         .select()
         .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advance-invoices"] });
      toast.success("Faktura za avans je uspešno kreirana");
    },
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const deleteAdvanceInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("advance_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advance-invoices"] });
      toast.success("Faktura za avans je obrisana");
    },
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const updateAdvanceInvoice = useMutation({
    mutationFn: async ({ id, ...formData }: AdvanceInvoiceFormData & { id: string }) => {
      const payload: Record<string, any> = {
        advance_date: formData.advance_date,
        due_date: formData.due_date,
        partner_id: formData.partner_id,
        org_unit_id: formData.org_unit_id,
        note: formData.note,
        internal_note: formData.internal_note,
      };
       if (formData.currency !== undefined) payload.currency = formData.currency;
       if (formData.payment_means_code !== undefined) payload.payment_means_code = formData.payment_means_code;
       if (formData.partner_country_code !== undefined) payload.partner_country_code = formData.partner_country_code;
       if (formData.partner_jbkjs !== undefined) payload.partner_jbkjs = formData.partner_jbkjs;
       if (formData.contract_reference !== undefined) payload.contract_reference = formData.contract_reference;
       if (formData.payment_date !== undefined) payload.payment_date = formData.payment_date;
       if (formData.payment_amount !== undefined) payload.payment_amount = formData.payment_amount;
       if (formData.payment_reference !== undefined) payload.payment_reference = formData.payment_reference;
      const { data, error } = await supabase
        .from("advance_invoices")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advance-invoices"] });
      toast.success("Faktura za avans je ažurirana");
    },
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const updateTotals = useMutation({
    mutationFn: async ({ id, subtotal, vat_amount, total_amount }: { id: string; subtotal: number; vat_amount: number; total_amount: number }) => {
      const { error } = await supabase.from("advance_invoices").update({ subtotal, vat_amount, total_amount }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["advance-invoices"] }),
  });

  return {
    advanceInvoices: query.data || [],
    isLoading: query.isLoading,
    createAdvanceInvoice,
    deleteAdvanceInvoice,
    updateAdvanceInvoice,
    updateTotals,
  };
}

export function useAdvanceInvoiceItems(advanceInvoiceId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["advance-invoice-items", advanceInvoiceId],
    queryFn: async () => {
      if (!advanceInvoiceId) return [];
      const { data, error } = await supabase
        .from("advance_invoice_items")
        .select("*")
        .eq("advance_invoice_id", advanceInvoiceId)
        .order("item_order");
      if (error) throw error;
      return data as AdvanceInvoiceItem[];
    },
    enabled: !!advanceInvoiceId,
  });

  const addItem = useMutation({
    mutationFn: async (item: AdvanceInvoiceItemFormData & { advance_invoice_id: string }) => {
      if (!selectedCompany?.id) throw new Error("Potrebno je izabrati firmu");
      const lineSubtotal = item.quantity * item.unit_price;
      const lineVat = lineSubtotal * (item.vat_rate / 100);
      const lineTotal = lineSubtotal + lineVat;
      const { data: existing } = await supabase
        .from("advance_invoice_items")
        .select("item_order")
        .eq("advance_invoice_id", item.advance_invoice_id)
        .order("item_order", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.item_order || 0) + 1;
      const { data, error } = await supabase
        .from("advance_invoice_items")
        .insert({
          advance_invoice_id: item.advance_invoice_id,
          company_id: selectedCompany.id,
          item_order: nextOrder,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
          tax_category_code: item.tax_category_code || "S",
          tax_exemption_reason: item.tax_exemption_reason || null,
          line_subtotal: lineSubtotal,
          line_vat: lineVat,
          line_total: lineTotal,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["advance-invoice-items", advanceInvoiceId] }),
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...item }: AdvanceInvoiceItemFormData & { id: string }) => {
      const lineSubtotal = item.quantity * item.unit_price;
      const lineVat = lineSubtotal * (item.vat_rate / 100);
      const lineTotal = lineSubtotal + lineVat;
      const { data, error } = await supabase
        .from("advance_invoice_items")
        .update({
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
          tax_category_code: item.tax_category_code || "S",
          tax_exemption_reason: item.tax_exemption_reason || null,
          line_subtotal: lineSubtotal,
          line_vat: lineVat,
          line_total: lineTotal,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["advance-invoice-items", advanceInvoiceId] }),
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("advance_invoice_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["advance-invoice-items", advanceInvoiceId] }),
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  return { items: itemsQuery.data || [], isLoading: itemsQuery.isLoading, addItem, updateItem, deleteItem };
}
