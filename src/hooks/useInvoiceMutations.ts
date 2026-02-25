import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { InvoiceFormData } from "@/hooks/useInvoices";

/**
 * Lightweight hook that exposes invoice mutations WITHOUT fetching the invoice list.
 * Use this in components that only need to create/update/delete/post invoices
 * (e.g. InvoiceEdit, InvoiceHeaderDialog) to avoid loading all invoices.
 */
export function useInvoiceMutations() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

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
    mutationFn: async ({ invoiceId, subtotal, vat_amount, total_amount }: {
      invoiceId: string;
      subtotal: number;
      vat_amount: number;
      total_amount: number;
    }) => {
      const { error } = await supabase
        .from("invoices")
        .update({ subtotal, vat_amount, total_amount })
        .eq("id", invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  return {
    updateInvoice,
    postInvoice,
    updateInvoiceTotals,
  };
}
