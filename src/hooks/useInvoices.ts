import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Invoice {
  id: string;
  company_id: string;
  business_year_id: string;
  org_unit_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  partner_id: string;
  status: 'draft' | 'posted' | 'cancelled';
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  note: string | null;
  internal_note: string | null;
  header_note: string | null;
  source_quote_id: string | null;
  source_delivery_note_id: string | null;
  journal_entry_id: string | null;
  posted_at: string | null;
  posted_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Partner snapshot
  partner_name: string | null;
  partner_address: string | null;
  partner_city: string | null;
  partner_postal_code: string | null;
  partner_pib: string | null;
  partner_mb: string | null;
  composed_by: string | null;
  // eFaktura fields
  invoice_type_code: string;
  currency: string;
  payment_means_code: string;
  partner_country_code: string;
  partner_jbkjs: string | null;
  billing_reference_number: string | null;
  billing_reference_date: string | null;
  contract_reference: string | null;
  tax_category_code: string;
  tax_exemption_reason: string | null;
  mesto_prometa: string | null;
  datum_prometa: string | null;
  bank_account_id: string | null;
  advance_invoice_id: string | null;
  // Foreign currency / export
  exchange_rate: number;
  subtotal_rsd: number;
  vat_amount_rsd: number;
  total_amount_rsd: number;
  jci_number: string | null;
  jci_date: string | null;
  delivery_terms: string | null;
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

export interface InvoiceItem {
  id: string;
  invoice_id: string;
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
  // eFaktura fields
  tax_category_code: string;
  tax_exemption_reason: string | null;
}

export interface InvoiceFormData {
  invoice_date: string;
  due_date: string | null;
  partner_id: string;
  org_unit_id: string | null;
  note: string | null;
  internal_note: string | null;
  header_note?: string | null;
  composed_by?: string | null;
  partner_name?: string | null;
  partner_address?: string | null;
  partner_city?: string | null;
  partner_postal_code?: string | null;
  partner_pib?: string | null;
  partner_mb?: string | null;
  source_quote_id?: string | null;
  source_delivery_note_id?: string | null;
  // eFaktura fields
  invoice_type_code?: string;
  currency?: string;
  payment_means_code?: string;
  partner_country_code?: string;
  partner_jbkjs?: string | null;
  billing_reference_number?: string | null;
  billing_reference_date?: string | null;
  contract_reference?: string | null;
  tax_category_code?: string;
  tax_exemption_reason?: string | null;
  mesto_prometa?: string | null;
  datum_prometa?: string | null;
  bank_account_id?: string | null;
  advance_invoice_id?: string | null;
  exchange_rate?: number;
  subtotal_rsd?: number;
  vat_amount_rsd?: number;
  total_amount_rsd?: number;
  jci_number?: string | null;
  jci_date?: string | null;
  delivery_terms?: string | null;
}

export interface InvoiceItemFormData {
  article_id: string | null;
  item_code: string | null;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  vat_rate: number;
  description: string | null;
  tax_category_code?: string;
  tax_exemption_reason?: string | null;
}

export interface DeliveryNoteForInvoicing {
  id: string;
  delivery_number: string;
  delivery_date: string;
  partner_id: string;
  partner_name: string;
  partner_code: string;
  item_count: number;
}

export function useInvoices() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const invoicesQuery = useQuery({
    queryKey: ["invoices", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          partner:partners(id, name, code, address, city, postal_code, pib, mb)
        `)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("invoice_number", { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const getNextInvoiceNumber = async (): Promise<string> => {
    if (!selectedCompany?.id || !selectedYear?.id) return "";
    
    const { data, error } = await supabase
      .rpc("get_next_document_number", {
        _company_id: selectedCompany.id,
        _year_id: selectedYear.id,
        _doc_type: "invoice"
      });

    if (error) throw error;
    return data as string;
  };

  const createInvoice = useMutation({
    mutationFn: async (formData: InvoiceFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) {
        throw new Error("Potrebno je izabrati firmu i godinu");
      }

      const invoiceNumber = await getNextInvoiceNumber();

      const { data, error } = await supabase
        .from("invoices")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          invoice_number: invoiceNumber,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          partner_id: formData.partner_id,
          org_unit_id: formData.org_unit_id,
          note: formData.note,
          internal_note: formData.internal_note,
          source_quote_id: formData.source_quote_id || null,
          source_delivery_note_id: formData.source_delivery_note_id || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Faktura je uspešno kreirana");
    },
    onError: (error) => {
      toast.error(`Greška pri kreiranju fakture: ${error.message}`);
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, ...formData }: InvoiceFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("invoices")
        .update({
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          partner_id: formData.partner_id,
          org_unit_id: formData.org_unit_id,
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
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Faktura je uspešno ažurirana");
    },
    onError: (error) => {
      toast.error(`Greška pri ažuriranju fakture: ${error.message}`);
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Faktura je uspešno obrisana");
    },
    onError: (error) => {
      toast.error(`Greška pri brisanju fakture: ${error.message}`);
    },
  });

  const postInvoice = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Korisnik nije prijavljen");

      const { data, error } = await supabase.rpc("post_invoice", {
        _invoice_id: id,
        _user_id: user.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Faktura je uspešno proknjižena i kreiran je nalog za knjiženje");
    },
    onError: (error) => {
      toast.error(`Greška pri knjiženju fakture: ${error.message}`);
    },
  });

  const updateInvoiceTotals = useMutation({
    mutationFn: async ({ invoiceId, subtotal, vat_amount, total_amount, exchange_rate }: {
      invoiceId: string;
      subtotal: number;
      vat_amount: number;
      total_amount: number;
      exchange_rate?: number;
    }) => {
      const rate = exchange_rate && exchange_rate > 0 ? exchange_rate : 1;
      const { error } = await supabase
        .from("invoices")
        .update({
          subtotal,
          vat_amount,
          total_amount,
          subtotal_rsd: +(subtotal * rate).toFixed(2),
          vat_amount_rsd: +(vat_amount * rate).toFixed(2),
          total_amount_rsd: +(total_amount * rate).toFixed(2),
        })
        .eq("id", invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
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
    updateInvoiceTotals,
    getNextInvoiceNumber,
  };
}

export function useInvoiceItems(invoiceId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["invoice-items", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("item_order");

      if (error) throw error;
      return data as InvoiceItem[];
    },
    enabled: !!invoiceId,
  });

  const addItem = useMutation({
    mutationFn: async (item: InvoiceItemFormData & { invoice_id: string }) => {
      if (!selectedCompany?.id) throw new Error("Potrebno je izabrati firmu");

      const lineSubtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      const lineVat = lineSubtotal * (item.vat_rate / 100);
      const lineTotal = lineSubtotal + lineVat;

      const { data: existingItems } = await supabase
        .from("invoice_items")
        .select("item_order")
        .eq("invoice_id", item.invoice_id)
        .order("item_order", { ascending: false })
        .limit(1);

      const nextOrder = (existingItems?.[0]?.item_order || 0) + 1;

      const { data, error } = await supabase
        .from("invoice_items")
        .insert({
          invoice_id: item.invoice_id,
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
          tax_category_code: item.tax_category_code || "S",
          tax_exemption_reason: item.tax_exemption_reason || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-items", invoiceId] });
    },
    onError: (error) => {
      toast.error(`Greška pri dodavanju stavke: ${error.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...item }: InvoiceItemFormData & { id: string }) => {
      const lineSubtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      const lineVat = lineSubtotal * (item.vat_rate / 100);
      const lineTotal = lineSubtotal + lineVat;

      const { data, error } = await supabase
        .from("invoice_items")
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
          tax_category_code: item.tax_category_code || "S",
          tax_exemption_reason: item.tax_exemption_reason || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-items", invoiceId] });
    },
    onError: (error) => {
      toast.error(`Greška pri ažuriranju stavke: ${error.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invoice_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-items", invoiceId] });
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

// Hook for getting quotes and delivery notes available for conversion
export function useConversionSources() {
  const { selectedCompany, selectedYear } = useAuth();

  const acceptedQuotesQuery = useQuery({
    queryKey: ["accepted-quotes", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          partner:partners(id, name, code)
        `)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .eq("status", "posted")
        .is("converted_to_invoice_id", null)
        .order("quote_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const uninvoicedDeliveryNotesQuery = useQuery({
    queryKey: ["uninvoiced-delivery-notes", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      
      const { data, error } = await supabase.rpc("get_uninvoiced_delivery_notes", {
        _company_id: selectedCompany.id,
        _partner_id: null,
      });

      if (error) throw error;
      return data as DeliveryNoteForInvoicing[];
    },
    enabled: !!selectedCompany?.id,
  });

  return {
    acceptedQuotes: acceptedQuotesQuery.data || [],
    uninvoicedDeliveryNotes: uninvoicedDeliveryNotesQuery.data || [],
    isLoading: acceptedQuotesQuery.isLoading || uninvoicedDeliveryNotesQuery.isLoading,
  };
}

// Hook for creating invoice from quote
export function useCreateInvoiceFromQuote() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quoteId: string) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) {
        throw new Error("Potrebno je izabrati firmu i godinu");
      }

      // Get quote with items
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .single();

      if (quoteError) throw quoteError;

      const { data: quoteItems, error: itemsError } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quoteId);

      if (itemsError) throw itemsError;

      // Get next invoice number
      const { data: invoiceNumber, error: numError } = await supabase
        .rpc("get_next_document_number", {
          _company_id: selectedCompany.id,
          _year_id: selectedYear.id,
          _doc_type: "invoice"
        });

      if (numError) throw numError;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split('T')[0],
          partner_id: quote.partner_id,
          org_unit_id: quote.org_unit_id,
          note: quote.note,
          internal_note: quote.internal_note,
          source_quote_id: quoteId,
          subtotal: quote.subtotal,
          vat_amount: quote.vat_amount,
          total_amount: quote.total_amount,
          created_by: user.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Copy items
      if (quoteItems && quoteItems.length > 0) {
        const invoiceItems = quoteItems.map((item, index) => ({
          invoice_id: invoice.id,
          company_id: selectedCompany.id,
          item_order: index + 1,
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

        const { error: itemsInsertError } = await supabase
          .from("invoice_items")
          .insert(invoiceItems);

        if (itemsInsertError) throw itemsInsertError;
      }

      // Mark quote as converted
      await supabase
        .from("quotes")
        .update({
          converted_to_invoice_id: invoice.id,
          converted_at: new Date().toISOString(),
        })
        .eq("id", quoteId);

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["accepted-quotes"] });
      toast.success("Faktura je kreirana iz ponude");
    },
    onError: (error) => {
      toast.error(`Greška pri konverziji ponude: ${error.message}`);
    },
  });
}

// Hook for creating invoice from delivery note
export function useCreateInvoiceFromDeliveryNote() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deliveryNoteId: string) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) {
        throw new Error("Potrebno je izabrati firmu i godinu");
      }

      // Get delivery note with items
      const { data: deliveryNote, error: dnError } = await supabase
        .from("delivery_notes")
        .select("*")
        .eq("id", deliveryNoteId)
        .single();

      if (dnError) throw dnError;

      const { data: dnItems, error: itemsError } = await supabase
        .from("delivery_note_items")
        .select(`
          *,
          article:articles(selling_price, vat_rate)
        `)
        .eq("delivery_note_id", deliveryNoteId);

      if (itemsError) throw itemsError;

      // Get next invoice number
      const { data: invoiceNumber, error: numError } = await supabase
        .rpc("get_next_document_number", {
          _company_id: selectedCompany.id,
          _year_id: selectedYear.id,
          _doc_type: "invoice"
        });

      if (numError) throw numError;

      // Calculate totals from items
      let subtotal = 0;
      let vatAmount = 0;
      const invoiceItems = dnItems?.map((item, index) => {
        const unitPrice = item.article?.selling_price || 0;
        const vatRate = item.article?.vat_rate || 20;
        const lineSubtotal = item.quantity * unitPrice;
        const lineVat = lineSubtotal * (vatRate / 100);
        const lineTotal = lineSubtotal + lineVat;
        
        subtotal += lineSubtotal;
        vatAmount += lineVat;

        return {
          company_id: selectedCompany.id,
          item_order: index + 1,
          article_id: item.article_id,
          item_code: item.item_code,
          item_name: item.item_name,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: unitPrice,
          discount_percent: 0,
          vat_rate: vatRate,
          line_subtotal: lineSubtotal,
          line_vat: lineVat,
          line_total: lineTotal,
          description: item.description,
        };
      }) || [];

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split('T')[0],
          partner_id: deliveryNote.partner_id,
          org_unit_id: deliveryNote.org_unit_id,
          note: deliveryNote.note,
          internal_note: deliveryNote.internal_note,
          source_delivery_note_id: deliveryNoteId,
          subtotal: subtotal,
          vat_amount: vatAmount,
          total_amount: subtotal + vatAmount,
          created_by: user.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert items with invoice_id
      if (invoiceItems.length > 0) {
        const itemsWithInvoiceId = invoiceItems.map(item => ({
          ...item,
          invoice_id: invoice.id,
        }));

        const { error: itemsInsertError } = await supabase
          .from("invoice_items")
          .insert(itemsWithInvoiceId);

        if (itemsInsertError) throw itemsInsertError;
      }

      // Link delivery note to invoice
      await supabase
        .from("delivery_notes")
        .update({ invoice_id: invoice.id })
        .eq("id", deliveryNoteId);

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["uninvoiced-delivery-notes"] });
      toast.success("Faktura je kreirana iz otpremnice");
    },
    onError: (error) => {
      toast.error(`Greška pri konverziji otpremnice: ${error.message}`);
    },
  });
}
