import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PurchaseInvoice {
  id: string;
  company_id: string;
  business_year_id: string;
  org_unit_id: string | null;
  warehouse_id: string | null;
  internal_number: string;
  supplier_invoice_number: string;
  invoice_date: string;
  receipt_date: string;
  due_date: string | null;
  partner_id: string;
  status: 'draft' | 'posted' | 'cancelled';
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  note: string | null;
  internal_note: string | null;
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
  };
}

export interface PurchaseInvoiceItem {
  id: string;
  purchase_invoice_id: string;
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
  line_subtotal: number;
  line_vat: number;
  line_total: number;
  description: string | null;
  created_at: string;
}

export interface PurchaseInvoiceFormData {
  supplier_invoice_number: string;
  invoice_date: string;
  receipt_date: string;
  due_date: string | null;
  partner_id: string;
  org_unit_id: string | null;
  warehouse_id: string | null;
  note: string | null;
  internal_note: string | null;
}

export interface PurchaseInvoiceItemFormData {
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

export function usePurchaseInvoices() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const purchaseInvoicesQuery = useQuery({
    queryKey: ["purchase-invoices", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      
      const { data, error } = await supabase
        .from("purchase_invoices")
        .select(`
          *,
          partner:partners(id, name, code)
        `)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("internal_number", { ascending: false });

      if (error) throw error;
      return data as PurchaseInvoice[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const getNextInternalNumber = async (): Promise<string> => {
    if (!selectedCompany?.id || !selectedYear?.id) return "";
    
    // Get the year suffix (last 2 digits)
    const yearSuffix = selectedYear.year.toString().slice(-2);
    const prefix = `UF-${yearSuffix}-`;
    
    const { data, error } = await supabase
      .from("purchase_invoices")
      .select("internal_number")
      .eq("company_id", selectedCompany.id)
      .eq("business_year_id", selectedYear.id)
      .ilike("internal_number", `${prefix}%`)
      .order("internal_number", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return `${prefix}0001`;
    }

    const lastNumber = data[0].internal_number;
    const match = lastNumber.match(/UF-\d{2}-(\d+)/);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `${prefix}${nextNum.toString().padStart(4, "0")}`;
    }
    
    return `${prefix}0001`;
  };

  const createPurchaseInvoice = useMutation({
    mutationFn: async (formData: PurchaseInvoiceFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) {
        throw new Error("Potrebno je izabrati firmu i godinu");
      }

      const internalNumber = await getNextInternalNumber();

      const { data, error } = await supabase
        .from("purchase_invoices")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          internal_number: internalNumber,
          supplier_invoice_number: formData.supplier_invoice_number,
          invoice_date: formData.invoice_date,
          receipt_date: formData.receipt_date,
          due_date: formData.due_date,
          partner_id: formData.partner_id,
          org_unit_id: formData.org_unit_id,
          warehouse_id: formData.warehouse_id,
          note: formData.note,
          internal_note: formData.internal_note,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      toast.success("Ulazna faktura je uspešno kreirana");
    },
    onError: (error) => {
      toast.error(`Greška pri kreiranju ulazne fakture: ${error.message}`);
    },
  });

  const updatePurchaseInvoice = useMutation({
    mutationFn: async ({ id, ...formData }: PurchaseInvoiceFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("purchase_invoices")
        .update({
          supplier_invoice_number: formData.supplier_invoice_number,
          invoice_date: formData.invoice_date,
          receipt_date: formData.receipt_date,
          due_date: formData.due_date,
          partner_id: formData.partner_id,
          org_unit_id: formData.org_unit_id,
          warehouse_id: formData.warehouse_id,
          note: formData.note,
          internal_note: formData.internal_note,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      toast.success("Ulazna faktura je uspešno ažurirana");
    },
    onError: (error) => {
      toast.error(`Greška pri ažuriranju ulazne fakture: ${error.message}`);
    },
  });

  const deletePurchaseInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_invoices")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      toast.success("Ulazna faktura je uspešno obrisana");
    },
    onError: (error) => {
      toast.error(`Greška pri brisanju ulazne fakture: ${error.message}`);
    },
  });

  const updatePurchaseInvoiceTotals = useMutation({
    mutationFn: async ({ invoiceId, subtotal, vat_amount, total_amount }: {
      invoiceId: string;
      subtotal: number;
      vat_amount: number;
      total_amount: number;
    }) => {
      const { error } = await supabase
        .from("purchase_invoices")
        .update({ subtotal, vat_amount, total_amount })
        .eq("id", invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
    },
  });

  return {
    purchaseInvoices: purchaseInvoicesQuery.data || [],
    isLoading: purchaseInvoicesQuery.isLoading,
    error: purchaseInvoicesQuery.error,
    createPurchaseInvoice,
    updatePurchaseInvoice,
    deletePurchaseInvoice,
    updatePurchaseInvoiceTotals,
    getNextInternalNumber,
  };
}

export function usePurchaseInvoiceItems(invoiceId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["purchase-invoice-items", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      
      const { data, error } = await supabase
        .from("purchase_invoice_items")
        .select("*")
        .eq("purchase_invoice_id", invoiceId)
        .order("item_order");

      if (error) throw error;
      return data as PurchaseInvoiceItem[];
    },
    enabled: !!invoiceId,
  });

  const addItem = useMutation({
    mutationFn: async (item: PurchaseInvoiceItemFormData & { purchase_invoice_id: string }) => {
      if (!selectedCompany?.id) throw new Error("Potrebno je izabrati firmu");

      const lineSubtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      const lineVat = lineSubtotal * (item.vat_rate / 100);
      const lineTotal = lineSubtotal + lineVat;

      const { data: existingItems } = await supabase
        .from("purchase_invoice_items")
        .select("item_order")
        .eq("purchase_invoice_id", item.purchase_invoice_id)
        .order("item_order", { ascending: false })
        .limit(1);

      const nextOrder = (existingItems?.[0]?.item_order || 0) + 1;

      const { data, error } = await supabase
        .from("purchase_invoice_items")
        .insert({
          purchase_invoice_id: item.purchase_invoice_id,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoice-items", invoiceId] });
    },
    onError: (error) => {
      toast.error(`Greška pri dodavanju stavke: ${error.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...item }: PurchaseInvoiceItemFormData & { id: string }) => {
      const lineSubtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      const lineVat = lineSubtotal * (item.vat_rate / 100);
      const lineTotal = lineSubtotal + lineVat;

      const { data, error } = await supabase
        .from("purchase_invoice_items")
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoice-items", invoiceId] });
      toast.success("Stavka je uspešno ažurirana");
    },
    onError: (error) => {
      toast.error(`Greška pri ažuriranju stavke: ${error.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_invoice_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoice-items", invoiceId] });
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
