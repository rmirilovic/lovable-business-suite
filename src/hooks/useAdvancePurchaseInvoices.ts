import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface AdvancePurchaseInvoice {
  id: string;
  company_id: string;
  business_year_id: string;
  internal_number: string;
  supplier_invoice_number: string;
  invoice_date: string;
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
  org_unit_id: string | null;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  note: string | null;
  internal_note: string | null;
  currency: string;
  exchange_rate: number;
  status: string;
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
  org_unit?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface AdvancePurchaseInvoiceItem {
  id: string;
  advance_purchase_invoice_id: string;
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

export interface AdvancePurchaseInvoiceFormData {
  supplier_invoice_number: string;
  invoice_date: string;
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
  org_unit_id?: string | null;
  note: string | null;
  internal_note: string | null;
  currency: string;
  exchange_rate: number;
}

export interface AdvancePurchaseInvoiceItemFormData {
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  line_total?: number;
  tax_category_code?: string;
  tax_exemption_reason?: string | null;
}

export function useAdvancePurchaseInvoices() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["advance-purchase-invoices", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      const { data, error } = await supabase
        .from("advance_purchase_invoices")
        .select(`*, partner:partners(id, name, code, pib, mb, is_in_pdv, address, city, postal_code), org_unit:organizational_units(id, code, name)`)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("internal_number", { ascending: false });
      if (error) throw error;
      return data as AdvancePurchaseInvoice[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const createInvoice = useMutation({
    mutationFn: async (formData: AdvancePurchaseInvoiceFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) throw new Error("Potrebno je izabrati firmu i godinu");
      const { data: num } = await supabase.rpc("get_next_purchase_invoice_number", {
        _company_id: selectedCompany.id,
        _year_id: selectedYear.id,
        _invoice_type: "advance",
      });
      const { data, error } = await supabase
        .from("advance_purchase_invoices")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          internal_number: num as string,
          ...formData,
          created_by: user.id,
        })
        .select(`*, partner:partners(id, name, code, pib, mb, is_in_pdv, address, city, postal_code), org_unit:organizational_units(id, code, name)`)
        .single();
      if (error) throw error;
      return data as AdvancePurchaseInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advance-purchase-invoices"] });
      toast.success("UFA je uspešno kreirana");
    },
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, ...formData }: AdvancePurchaseInvoiceFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("advance_purchase_invoices")
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(`*, partner:partners(id, name, code, pib, mb, is_in_pdv, address, city, postal_code), org_unit:organizational_units(id, code, name)`)
        .single();
      if (error) throw error;
      return data as AdvancePurchaseInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advance-purchase-invoices"] });
      toast.success("UFA je ažurirana");
    },
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("advance_purchase_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advance-purchase-invoices"] });
      toast.success("UFA je obrisana");
    },
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const postInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");
      const { data, error } = await supabase.rpc("post_advance_purchase_invoice", {
        _invoice_id: invoiceId,
        _user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advance-purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("UFA je uspešno proknjižena");
    },
    onError: (error) => toast.error(`Greška pri knjiženju: ${error.message}`),
  });

  const unpostInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");
      const { data, error } = await supabase.rpc("unpost_advance_purchase_invoice", {
        _invoice_id: invoiceId,
        _user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advance-purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Knjiženje je poništeno");
    },
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const updateTotals = useMutation({
    mutationFn: async ({ invoiceId, subtotal, vat_amount, total_amount }: {
      invoiceId: string; subtotal: number; vat_amount: number; total_amount: number;
    }) => {
      const { data, error } = await supabase
        .from("advance_purchase_invoices")
        .update({ subtotal, vat_amount, total_amount, updated_at: new Date().toISOString() })
        .eq("id", invoiceId)
        .select("updated_at")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["advance-purchase-invoices"] }),
  });

  return {
    invoices: query.data || [],
    isLoading: query.isLoading,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    postInvoice,
    unpostInvoice,
    updateTotals,
  };
}

export function useAdvancePurchaseInvoiceItems(invoiceId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["advance-purchase-invoice-items", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const { data, error } = await supabase
        .from("advance_purchase_invoice_items")
        .select("*")
        .eq("advance_purchase_invoice_id", invoiceId)
        .order("item_order");
      if (error) throw error;
      return data as AdvancePurchaseInvoiceItem[];
    },
    enabled: !!invoiceId,
  });

  const addItem = useMutation({
    mutationFn: async (item: AdvancePurchaseInvoiceItemFormData & { advance_purchase_invoice_id: string }) => {
      if (!selectedCompany?.id) throw new Error("Potrebno je izabrati firmu");

      // Fetch supplier PDV status
      const { data: invoiceData } = await supabase
        .from("advance_purchase_invoices")
        .select("supplier_is_in_pdv")
        .eq("id", item.advance_purchase_invoice_id)
        .single();
      const supplierInPdv = invoiceData?.supplier_is_in_pdv ?? true;

      const lineTotal = item.line_total ?? (item.quantity * item.unit_price * (1 + item.vat_rate / 100));
      let lineSubtotal: number;
      let lineVat: number;
      if (supplierInPdv && item.vat_rate > 0) {
        lineSubtotal = lineTotal / (1 + item.vat_rate / 100);
        lineVat = lineTotal - lineSubtotal;
      } else {
        lineSubtotal = lineTotal;
        lineVat = 0;
      }

      const { data: existing } = await supabase
        .from("advance_purchase_invoice_items")
        .select("item_order")
        .eq("advance_purchase_invoice_id", item.advance_purchase_invoice_id)
        .order("item_order", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.item_order || 0) + 1;

      const { data, error } = await supabase
        .from("advance_purchase_invoice_items")
        .insert({
          advance_purchase_invoice_id: item.advance_purchase_invoice_id,
          company_id: selectedCompany.id,
          item_order: nextOrder,
          description: item.description,
          unit: item.unit,
          quantity: 1,
          unit_price: lineSubtotal,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["advance-purchase-invoice-items", invoiceId] }),
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...item }: AdvancePurchaseInvoiceItemFormData & { id: string }) => {
      // Fetch supplier PDV status
      const { data: parentItem } = await supabase
        .from("advance_purchase_invoice_items")
        .select("advance_purchase_invoice_id")
        .eq("id", id)
        .single();
      let supplierInPdv = true;
      if (parentItem) {
        const { data: invoiceData } = await supabase
          .from("advance_purchase_invoices")
          .select("supplier_is_in_pdv")
          .eq("id", parentItem.advance_purchase_invoice_id)
          .single();
        supplierInPdv = invoiceData?.supplier_is_in_pdv ?? true;
      }

      const lineTotal = item.line_total ?? (item.quantity * item.unit_price * (1 + item.vat_rate / 100));
      let lineSubtotal: number;
      let lineVat: number;
      if (supplierInPdv && item.vat_rate > 0) {
        lineSubtotal = lineTotal / (1 + item.vat_rate / 100);
        lineVat = lineTotal - lineSubtotal;
      } else {
        lineSubtotal = lineTotal;
        lineVat = 0;
      }

      const { data, error } = await supabase
        .from("advance_purchase_invoice_items")
        .update({
          description: item.description,
          unit: item.unit,
          quantity: 1,
          unit_price: lineSubtotal,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["advance-purchase-invoice-items", invoiceId] }),
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("advance_purchase_invoice_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["advance-purchase-invoice-items", invoiceId] }),
    onError: (error) => toast.error(`Greška: ${error.message}`),
  });

  return { items: itemsQuery.data || [], isLoading: itemsQuery.isLoading, addItem, updateItem, deleteItem };
}
