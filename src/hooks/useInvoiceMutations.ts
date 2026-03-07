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
      const updatePayload: Record<string, any> = {
        invoice_date: formData.invoice_date,
        due_date: formData.due_date,
        partner_id: formData.partner_id,
        org_unit_id: formData.org_unit_id,
        note: formData.note,
        internal_note: formData.internal_note,
      };
      // Include eFaktura fields if provided
      if (formData.invoice_type_code !== undefined) updatePayload.invoice_type_code = formData.invoice_type_code;
      if (formData.currency !== undefined) updatePayload.currency = formData.currency;
      if (formData.payment_means_code !== undefined) updatePayload.payment_means_code = formData.payment_means_code;
      if (formData.partner_country_code !== undefined) updatePayload.partner_country_code = formData.partner_country_code;
      if (formData.partner_jbkjs !== undefined) updatePayload.partner_jbkjs = formData.partner_jbkjs;
      if (formData.billing_reference_number !== undefined) updatePayload.billing_reference_number = formData.billing_reference_number;
      if (formData.billing_reference_date !== undefined) updatePayload.billing_reference_date = formData.billing_reference_date;
      if (formData.contract_reference !== undefined) updatePayload.contract_reference = formData.contract_reference;
      if (formData.tax_category_code !== undefined) updatePayload.tax_category_code = formData.tax_category_code;
      if (formData.tax_exemption_reason !== undefined) updatePayload.tax_exemption_reason = formData.tax_exemption_reason;
      if (formData.header_note !== undefined) updatePayload.header_note = formData.header_note;
      if (formData.composed_by !== undefined) updatePayload.composed_by = formData.composed_by;
      if (formData.partner_name !== undefined) updatePayload.partner_name = formData.partner_name;
      if (formData.partner_address !== undefined) updatePayload.partner_address = formData.partner_address;
      if (formData.partner_city !== undefined) updatePayload.partner_city = formData.partner_city;
      if (formData.partner_postal_code !== undefined) updatePayload.partner_postal_code = formData.partner_postal_code;
      if (formData.partner_pib !== undefined) updatePayload.partner_pib = formData.partner_pib;
      if (formData.partner_mb !== undefined) updatePayload.partner_mb = formData.partner_mb;
      if (formData.mesto_prometa !== undefined) updatePayload.mesto_prometa = formData.mesto_prometa;
      if (formData.datum_prometa !== undefined) updatePayload.datum_prometa = formData.datum_prometa;
      if (formData.bank_account_id !== undefined) updatePayload.bank_account_id = formData.bank_account_id;
      if (formData.advance_invoice_id !== undefined) updatePayload.advance_invoice_id = formData.advance_invoice_id;

      const { data, error } = await supabase
        .from("invoices")
        .update(updatePayload)
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

  const unpostInvoice = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Korisnik nije prijavljen");
      const { data, error } = await supabase.rpc("unpost_invoice", {
        _invoice_id: id,
        _user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Knjiženje fakture je uspešno poništeno");
    },
    onError: (error) => {
      toast.error(`Greška pri poništavanju knjiženja: ${error.message}`);
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
    unpostInvoice,
    updateInvoiceTotals,
  };
}
