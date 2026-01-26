import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Quote {
  id: string;
  company_id: string;
  business_year_id: string;
  org_unit_id: string | null;
  quote_number: string;
  quote_date: string;
  valid_until: string | null;
  partner_id: string;
  status: 'draft' | 'approved' | 'posted' | 'cancelled';
  approved_by: string | null;
  approved_at: string | null;
  converted_to_invoice_id: string | null;
  converted_at: string | null;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  note: string | null;
  internal_note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  partner?: {
    id: string;
    name: string;
    code: string;
  };
  approver?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
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

export interface QuoteFormData {
  quote_date: string;
  valid_until: string | null;
  partner_id: string;
  org_unit_id: string | null;
  note: string | null;
  internal_note: string | null;
}

export interface QuoteItemFormData {
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

export function useQuotes() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const quotesQuery = useQuery({
    queryKey: ["quotes", selectedCompany?.id, selectedYear?.id],
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
        .order("quote_number", { ascending: false });

      if (error) throw error;
      
      // Fetch approver names separately for quotes that have approved_by
      const quotesWithApprover = await Promise.all(
        (data || []).map(async (quote) => {
          if (quote.approved_by) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", quote.approved_by)
              .single();
            return { ...quote, approver: profile };
          }
          return { ...quote, approver: null };
        })
      );
      
      return quotesWithApprover as Quote[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const getNextQuoteNumber = async (): Promise<string> => {
    if (!selectedCompany?.id || !selectedYear?.id) return "";
    
    const { data, error } = await supabase
      .rpc("get_next_document_number", {
        _company_id: selectedCompany.id,
        _year_id: selectedYear.id,
        _doc_type: "quote"
      });

    if (error) throw error;
    return data as string;
  };

  const createQuote = useMutation({
    mutationFn: async (formData: QuoteFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) {
        throw new Error("Potrebno je izabrati firmu i godinu");
      }

      const quoteNumber = await getNextQuoteNumber();

      const { data, error } = await supabase
        .from("quotes")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          quote_number: quoteNumber,
          quote_date: formData.quote_date,
          valid_until: formData.valid_until,
          partner_id: formData.partner_id,
          org_unit_id: formData.org_unit_id,
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
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Ponuda je uspešno kreirana");
    },
    onError: (error) => {
      toast.error(`Greška pri kreiranju ponude: ${error.message}`);
    },
  });

  const updateQuote = useMutation({
    mutationFn: async ({ id, ...formData }: QuoteFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("quotes")
        .update({
          quote_date: formData.quote_date,
          valid_until: formData.valid_until,
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
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Ponuda je uspešno ažurirana");
    },
    onError: (error) => {
      toast.error(`Greška pri ažuriranju ponude: ${error.message}`);
    },
  });

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quotes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Ponuda je uspešno obrisana");
    },
    onError: (error) => {
      toast.error(`Greška pri brisanju ponude: ${error.message}`);
    },
  });

  const updateQuoteTotals = useMutation({
    mutationFn: async ({ quoteId, subtotal, vat_amount, total_amount }: {
      quoteId: string;
      subtotal: number;
      vat_amount: number;
      total_amount: number;
    }) => {
      const { error } = await supabase
        .from("quotes")
        .update({ subtotal, vat_amount, total_amount })
        .eq("id", quoteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });

  const approveQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      if (!user?.id) throw new Error("Korisnik nije prijavljen");
      
      const { data, error } = await supabase
        .from("quotes")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", quoteId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Ponuda je odobrena");
    },
    onError: (error) => {
      toast.error(`Greška pri odobravanju ponude: ${error.message}`);
    },
  });

  const copyQuote = useMutation({
    mutationFn: async (sourceQuote: Quote) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) {
        throw new Error("Potrebno je izabrati firmu i godinu");
      }

      // Find existing versions of this quote to determine suffix
      // Original quote format: PON-YY-NNNN (2-digit year, 4-digit sequence)
      // Copy format: PON-YY-NNNN-1, PON-YY-NNNN-2, etc.
      // If copying a copy (PON-YY-NNNN-1), use original base (PON-YY-NNNN)
      const versionMatch = sourceQuote.quote_number.match(/^(.+-\d{2}-\d{4})(?:-(\d{1,3}))?$/);
      const baseNumber = versionMatch ? versionMatch[1] : sourceQuote.quote_number;

      const { data: existingQuotes } = await supabase
        .from("quotes")
        .select("quote_number")
        .eq("company_id", selectedCompany.id)
        .like("quote_number", `${baseNumber}-%`);

      // Find the highest version suffix (only count copies, not the original)
      let maxVersion = 0;
      (existingQuotes || []).forEach((q) => {
        // Match only version suffixes after the base number (e.g., PON-2026-0001-1)
        const copyMatch = q.quote_number.match(new RegExp(`^${baseNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`));
        if (copyMatch) {
          const version = parseInt(copyMatch[1], 10);
          if (version > maxVersion) maxVersion = version;
        }
      });

      const newQuoteNumber = `${baseNumber}-${maxVersion + 1}`;

      // Create new quote
      const { data: newQuote, error: quoteError } = await supabase
        .from("quotes")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          quote_number: newQuoteNumber,
          quote_date: new Date().toISOString().split("T")[0],
          valid_until: sourceQuote.valid_until,
          partner_id: sourceQuote.partner_id,
          org_unit_id: sourceQuote.org_unit_id,
          note: sourceQuote.note,
          internal_note: sourceQuote.internal_note,
          created_by: user.id,
          status: "draft",
          subtotal: sourceQuote.subtotal,
          vat_amount: sourceQuote.vat_amount,
          total_amount: sourceQuote.total_amount,
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Copy items from source quote
      const { data: sourceItems } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", sourceQuote.id)
        .order("item_order");

      if (sourceItems && sourceItems.length > 0) {
        const newItems = sourceItems.map((item) => ({
          quote_id: newQuote.id,
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

        const { error: itemsError } = await supabase
          .from("quote_items")
          .insert(newItems);

        if (itemsError) throw itemsError;
      }

      return newQuote;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success(`Ponuda kopirana kao ${data.quote_number}`);
    },
    onError: (error) => {
      toast.error(`Greška pri kopiranju ponude: ${error.message}`);
    },
  });

  return {
    quotes: quotesQuery.data || [],
    isLoading: quotesQuery.isLoading,
    error: quotesQuery.error,
    createQuote,
    updateQuote,
    deleteQuote,
    updateQuoteTotals,
    approveQuote,
    copyQuote,
    getNextQuoteNumber,
  };
}

export function useQuoteItems(quoteId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["quote-items", quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      
      const { data, error } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quoteId)
        .order("item_order");

      if (error) throw error;
      return data as QuoteItem[];
    },
    enabled: !!quoteId,
  });

  const addItem = useMutation({
    mutationFn: async (item: QuoteItemFormData & { quote_id: string }) => {
      if (!selectedCompany?.id) throw new Error("Potrebno je izabrati firmu");

      // Calculate line totals
      const lineSubtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      const lineVat = lineSubtotal * (item.vat_rate / 100);
      const lineTotal = lineSubtotal + lineVat;

      // Get next order
      const { data: existingItems } = await supabase
        .from("quote_items")
        .select("item_order")
        .eq("quote_id", item.quote_id)
        .order("item_order", { ascending: false })
        .limit(1);

      const nextOrder = (existingItems?.[0]?.item_order || 0) + 1;

      const { data, error } = await supabase
        .from("quote_items")
        .insert({
          quote_id: item.quote_id,
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
      queryClient.invalidateQueries({ queryKey: ["quote-items", quoteId] });
    },
    onError: (error) => {
      toast.error(`Greška pri dodavanju stavke: ${error.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...item }: QuoteItemFormData & { id: string }) => {
      const lineSubtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      const lineVat = lineSubtotal * (item.vat_rate / 100);
      const lineTotal = lineSubtotal + lineVat;

      const { data, error } = await supabase
        .from("quote_items")
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
      queryClient.invalidateQueries({ queryKey: ["quote-items", quoteId] });
    },
    onError: (error) => {
      toast.error(`Greška pri ažuriranju stavke: ${error.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quote_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-items", quoteId] });
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
