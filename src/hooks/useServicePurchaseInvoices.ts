import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ServicePurchaseInvoice {
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
  vat_calculation_type: 'standard' | 'no_vat_8v2';
  has_internal_vat_calculation: boolean;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  note: string | null;
  internal_note: string | null;
  status: 'draft' | 'posted' | 'cancelled';
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
}

export interface ServicePurchaseInvoiceItem {
  id: string;
  service_purchase_invoice_id: string;
  company_id: string;
  input_cost_id: string | null;
  item_code: string | null;
  item_name: string;
  description: string | null;
  org_unit_id: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  vat_rate: number;
  is_vat_deductible: boolean;
  line_subtotal: number;
  line_vat: number;
  line_total: number;
  item_order: number;
  created_at: string;
  input_cost?: {
    id: string;
    code: string;
    name: string;
    account_code: string;
  };
  org_unit?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface ServicePurchaseInvoiceFormData {
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
  vat_calculation_type: 'standard' | 'no_vat_8v2';
  has_internal_vat_calculation: boolean;
  note: string | null;
  internal_note: string | null;
}

export interface ServicePurchaseInvoiceItemFormData {
  input_cost_id: string | null;
  item_code: string | null;
  item_name: string;
  description: string | null;
  org_unit_id: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  vat_rate: number;
  is_vat_deductible: boolean;
}

export function useServicePurchaseInvoices() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const invoicesQuery = useQuery({
    queryKey: ["service-purchase-invoices", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      
      const { data, error } = await supabase
        .from("service_purchase_invoices")
        .select(`
          *,
          partner:partners(id, name, code, pib, mb, is_in_pdv, address, city, postal_code)
        `)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("internal_number", { ascending: false });

      if (error) throw error;
      return data as ServicePurchaseInvoice[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const createInvoice = useMutation({
    mutationFn: async (formData: ServicePurchaseInvoiceFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) {
        throw new Error("Potrebno je izabrati firmu i godinu");
      }

      // Get next internal number using database function
      const { data: numberData, error: numberError } = await supabase
        .rpc("get_next_purchase_invoice_number", {
          _company_id: selectedCompany.id,
          _year_id: selectedYear.id,
          _invoice_type: "service"
        });

      if (numberError) throw numberError;

      const { data, error } = await supabase
        .from("service_purchase_invoices")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          internal_number: numberData,
          ...formData,
          created_by: user.id,
        })
        .select(`
          *,
          partner:partners(id, name, code, pib, mb, is_in_pdv, address, city, postal_code)
        `)
        .single();

      if (error) throw error;
      return data as ServicePurchaseInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-purchase-invoices"] });
      toast.success("Ulazna faktura za usluge je uspešno kreirana");
    },
    onError: (error) => {
      toast.error(`Greška pri kreiranju: ${error.message}`);
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, ...formData }: ServicePurchaseInvoiceFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("service_purchase_invoices")
        .update(formData)
        .eq("id", id)
        .select(`
          *,
          partner:partners(id, name, code, pib, mb, is_in_pdv, address, city, postal_code)
        `)
        .single();

      if (error) throw error;
      return data as ServicePurchaseInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-purchase-invoices"] });
      toast.success("Ulazna faktura je uspešno ažurirana");
    },
    onError: (error) => {
      toast.error(`Greška pri ažuriranju: ${error.message}`);
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("service_purchase_invoices")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-purchase-invoices"] });
      toast.success("Ulazna faktura je uspešno obrisana");
    },
    onError: (error) => {
      toast.error(`Greška pri brisanju: ${error.message}`);
    },
  });

  const postInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");

      const { data, error } = await supabase
        .rpc("post_service_purchase_invoice", {
          _invoice_id: invoiceId,
          _user_id: user.id
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Ulazna faktura je uspešno proknjižena");
    },
    onError: (error) => {
      toast.error(`Greška pri knjiženju: ${error.message}`);
    },
  });

  const unpostInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");

      const { data, error } = await supabase
        .rpc("unpost_service_purchase_invoice", {
          _invoice_id: invoiceId,
          _user_id: user.id
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Knjiženje je poništeno - dokument je vraćen u nacrt");
    },
    onError: (error) => {
      toast.error(`Greška pri poništavanju: ${error.message}`);
    },
  });

  const updateTotals = useMutation({
    mutationFn: async ({ invoiceId, subtotal, vat_amount, total_amount }: {
      invoiceId: string;
      subtotal: number;
      vat_amount: number;
      total_amount: number;
    }) => {
      const { error } = await supabase
        .from("service_purchase_invoices")
        .update({ subtotal, vat_amount, total_amount })
        .eq("id", invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-purchase-invoices"] });
    },
  });

  return {
    invoices: invoicesQuery.data || [],
    isLoading: invoicesQuery.isLoading,
    error: invoicesQuery.error,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    postInvoice,
    unpostInvoice,
    updateTotals,
  };
}

export function useServicePurchaseInvoiceItems(invoiceId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["service-purchase-invoice-items", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      
      const { data, error } = await supabase
        .from("service_purchase_invoice_items")
        .select(`
          *,
          input_cost:input_costs(id, code, name, account_code),
          org_unit:organizational_units(id, code, name)
        `)
        .eq("service_purchase_invoice_id", invoiceId)
        .order("item_order");

      if (error) throw error;
      return data as ServicePurchaseInvoiceItem[];
    },
    enabled: !!invoiceId,
  });

  const addItem = useMutation({
    mutationFn: async (item: ServicePurchaseInvoiceItemFormData & { service_purchase_invoice_id: string }) => {
      if (!selectedCompany?.id) throw new Error("Potrebno je izabrati firmu");

      // Fetch supplier PDV status from parent invoice
      const { data: invoiceData } = await supabase
        .from("service_purchase_invoices")
        .select("supplier_is_in_pdv")
        .eq("id", item.service_purchase_invoice_id)
        .single();
      const supplierInPdv = invoiceData?.supplier_is_in_pdv ?? true;

      // unit_price je cena SA PDV-om (bruto). Osnovica i PDV se računaju unazad.
      const grossAmount = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      let lineSubtotal: number;
      let lineVat: number;
      let lineTotal: number;
      if (supplierInPdv) {
        lineSubtotal = grossAmount / (1 + item.vat_rate / 100);
        lineVat = grossAmount - lineSubtotal;
        lineTotal = grossAmount;
      } else {
        // Dobavljač nije u PDV sistemu - cena je neto, PDV = 0
        lineSubtotal = grossAmount;
        lineVat = 0;
        lineTotal = grossAmount;
      }

      const { data: existingItems } = await supabase
        .from("service_purchase_invoice_items")
        .select("item_order")
        .eq("service_purchase_invoice_id", item.service_purchase_invoice_id)
        .order("item_order", { ascending: false })
        .limit(1);

      const nextOrder = (existingItems?.[0]?.item_order || 0) + 1;

      const { data, error } = await supabase
        .from("service_purchase_invoice_items")
        .insert({
          service_purchase_invoice_id: item.service_purchase_invoice_id,
          company_id: selectedCompany.id,
          item_order: nextOrder,
          input_cost_id: item.input_cost_id,
          item_code: item.item_code,
          item_name: item.item_name,
          description: item.description,
          org_unit_id: item.org_unit_id,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          vat_rate: item.vat_rate,
          is_vat_deductible: item.is_vat_deductible,
          line_subtotal: lineSubtotal,
          line_vat: lineVat,
          line_total: lineTotal,
        })
        .select(`
          *,
          input_cost:input_costs(id, code, name, account_code),
          org_unit:organizational_units(id, code, name)
        `)
        .single();

      if (error) throw error;
      return data as ServicePurchaseInvoiceItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-purchase-invoice-items", invoiceId] });
    },
    onError: (error) => {
      toast.error(`Greška pri dodavanju stavke: ${error.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...item }: ServicePurchaseInvoiceItemFormData & { id: string }) => {
      // Fetch supplier PDV status from parent invoice
      const { data: parentItem } = await supabase
        .from("service_purchase_invoice_items")
        .select("service_purchase_invoice_id")
        .eq("id", id)
        .single();
      let supplierInPdv = true;
      if (parentItem) {
        const { data: invoiceData } = await supabase
          .from("service_purchase_invoices")
          .select("supplier_is_in_pdv")
          .eq("id", parentItem.service_purchase_invoice_id)
          .single();
        supplierInPdv = invoiceData?.supplier_is_in_pdv ?? true;
      }

      // unit_price je cena SA PDV-om (bruto). Osnovica i PDV se računaju unazad.
      const grossAmount = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      let lineSubtotal: number;
      let lineVat: number;
      let lineTotal: number;
      if (supplierInPdv) {
        lineSubtotal = grossAmount / (1 + item.vat_rate / 100);
        lineVat = grossAmount - lineSubtotal;
        lineTotal = grossAmount;
      } else {
        lineSubtotal = grossAmount;
        lineVat = 0;
        lineTotal = grossAmount;
      }

      const { data, error } = await supabase
        .from("service_purchase_invoice_items")
        .update({
          input_cost_id: item.input_cost_id,
          item_code: item.item_code,
          item_name: item.item_name,
          description: item.description,
          org_unit_id: item.org_unit_id,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          vat_rate: item.vat_rate,
          is_vat_deductible: item.is_vat_deductible,
          line_subtotal: lineSubtotal,
          line_vat: lineVat,
          line_total: lineTotal,
        })
        .eq("id", id)
        .select(`
          *,
          input_cost:input_costs(id, code, name, account_code),
          org_unit:organizational_units(id, code, name)
        `)
        .single();

      if (error) throw error;
      return data as ServicePurchaseInvoiceItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-purchase-invoice-items", invoiceId] });
      toast.success("Stavka je uspešno ažurirana");
    },
    onError: (error) => {
      toast.error(`Greška pri ažuriranju stavke: ${error.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("service_purchase_invoice_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-purchase-invoice-items", invoiceId] });
    },
    onError: (error) => {
      toast.error(`Greška pri brisanju stavke: ${error.message}`);
    },
  });

  return {
    items: itemsQuery.data || [],
    isLoading: itemsQuery.isLoading,
    addItem,
    updateItem,
    deleteItem,
  };
}
