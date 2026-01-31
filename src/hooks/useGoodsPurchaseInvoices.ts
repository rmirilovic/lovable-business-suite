import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface GoodsPurchaseInvoice {
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
  warehouse_id: string;
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
  goods_receipt_id: string | null;
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
  warehouse?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface GoodsPurchaseInvoiceItem {
  id: string;
  goods_purchase_invoice_id: string;
  company_id: string;
  article_id: string | null;
  item_code: string | null;
  item_name: string;
  description: string | null;
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
  article?: {
    id: string;
    code: string;
    name: string;
    unit: string;
  };
}

export interface GoodsPurchaseInvoiceFormData {
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
  warehouse_id: string;
  vat_calculation_type: 'standard' | 'no_vat_8v2';
  has_internal_vat_calculation: boolean;
  note: string | null;
  internal_note: string | null;
}

export interface GoodsPurchaseInvoiceItemFormData {
  article_id: string | null;
  item_code: string | null;
  item_name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  vat_rate: number;
  is_vat_deductible: boolean;
}

export function useGoodsPurchaseInvoices() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const invoicesQuery = useQuery({
    queryKey: ["goods-purchase-invoices", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      
      const { data, error } = await supabase
        .from("goods_purchase_invoices")
        .select(`
          *,
          partner:partners(id, name, code, pib, mb, is_in_pdv, address, city, postal_code),
          warehouse:warehouses(id, code, name)
        `)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("internal_number", { ascending: false });

      if (error) throw error;
      return data as GoodsPurchaseInvoice[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const createInvoice = useMutation({
    mutationFn: async (formData: GoodsPurchaseInvoiceFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) {
        throw new Error("Potrebno je izabrati firmu i godinu");
      }

      // Get next internal number using database function
      const { data: numberData, error: numberError } = await supabase
        .rpc("get_next_purchase_invoice_number", {
          _company_id: selectedCompany.id,
          _year_id: selectedYear.id,
          _invoice_type: "goods"
        });

      if (numberError) throw numberError;

      const { data, error } = await supabase
        .from("goods_purchase_invoices")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          internal_number: numberData,
          ...formData,
          created_by: user.id,
        })
        .select(`
          *,
          partner:partners(id, name, code, pib, mb, is_in_pdv, address, city, postal_code),
          warehouse:warehouses(id, code, name)
        `)
        .single();

      if (error) throw error;
      return data as GoodsPurchaseInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-purchase-invoices"] });
      toast.success("Ulazna faktura za robu je uspešno kreirana");
    },
    onError: (error) => {
      toast.error(`Greška pri kreiranju: ${error.message}`);
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, ...formData }: GoodsPurchaseInvoiceFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("goods_purchase_invoices")
        .update(formData)
        .eq("id", id)
        .select(`
          *,
          partner:partners(id, name, code, pib, mb, is_in_pdv, address, city, postal_code),
          warehouse:warehouses(id, code, name)
        `)
        .single();

      if (error) throw error;
      return data as GoodsPurchaseInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-purchase-invoices"] });
      toast.success("Ulazna faktura je uspešno ažurirana");
    },
    onError: (error) => {
      toast.error(`Greška pri ažuriranju: ${error.message}`);
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("goods_purchase_invoices")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-purchase-invoices"] });
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
        .rpc("post_goods_purchase_invoice", {
          _invoice_id: invoiceId,
          _user_id: user.id
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-purchase-invoices"] });
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
        .rpc("unpost_goods_purchase_invoice", {
          _invoice_id: invoiceId,
          _user_id: user.id
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-purchase-invoices"] });
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
        .from("goods_purchase_invoices")
        .update({ subtotal, vat_amount, total_amount })
        .eq("id", invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-purchase-invoices"] });
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

export function useGoodsPurchaseInvoiceItems(invoiceId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["goods-purchase-invoice-items", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      
      const { data, error } = await supabase
        .from("goods_purchase_invoice_items")
        .select(`
          *,
          article:articles(id, code, name, unit)
        `)
        .eq("goods_purchase_invoice_id", invoiceId)
        .order("item_order");

      if (error) throw error;
      return data as GoodsPurchaseInvoiceItem[];
    },
    enabled: !!invoiceId,
  });

  const addItem = useMutation({
    mutationFn: async (item: GoodsPurchaseInvoiceItemFormData & { goods_purchase_invoice_id: string }) => {
      if (!selectedCompany?.id) throw new Error("Potrebno je izabrati firmu");

      const lineSubtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      const lineVat = lineSubtotal * (item.vat_rate / 100);
      const lineTotal = lineSubtotal + lineVat;

      const { data: existingItems } = await supabase
        .from("goods_purchase_invoice_items")
        .select("item_order")
        .eq("goods_purchase_invoice_id", item.goods_purchase_invoice_id)
        .order("item_order", { ascending: false })
        .limit(1);

      const nextOrder = (existingItems?.[0]?.item_order || 0) + 1;

      const { data, error } = await supabase
        .from("goods_purchase_invoice_items")
        .insert({
          goods_purchase_invoice_id: item.goods_purchase_invoice_id,
          company_id: selectedCompany.id,
          item_order: nextOrder,
          article_id: item.article_id,
          item_code: item.item_code,
          item_name: item.item_name,
          description: item.description,
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
          article:articles(id, code, name, unit)
        `)
        .single();

      if (error) throw error;
      return data as GoodsPurchaseInvoiceItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-purchase-invoice-items", invoiceId] });
    },
    onError: (error) => {
      toast.error(`Greška pri dodavanju stavke: ${error.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...item }: GoodsPurchaseInvoiceItemFormData & { id: string }) => {
      const lineSubtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      const lineVat = lineSubtotal * (item.vat_rate / 100);
      const lineTotal = lineSubtotal + lineVat;

      const { data, error } = await supabase
        .from("goods_purchase_invoice_items")
        .update({
          article_id: item.article_id,
          item_code: item.item_code,
          item_name: item.item_name,
          description: item.description,
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
          article:articles(id, code, name, unit)
        `)
        .single();

      if (error) throw error;
      return data as GoodsPurchaseInvoiceItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-purchase-invoice-items", invoiceId] });
      toast.success("Stavka je uspešno ažurirana");
    },
    onError: (error) => {
      toast.error(`Greška pri ažuriranju stavke: ${error.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("goods_purchase_invoice_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-purchase-invoice-items", invoiceId] });
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
