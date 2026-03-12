import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PaymentOrder {
  id: string;
  company_id: string;
  source_document_type: string | null;
  source_document_id: string | null;
  source_document_number: string | null;
  partner_id: string | null;
  partner_name: string | null;
  partner_code: string | null;
  booking_date: string;
  supplier_document_number: string | null;
  supplier_document_date: string | null;
  due_date: string | null;
  document_amount: number;
  previously_paid: number;
  approved_amount: number;
  bank_account_id: string | null;
  partner_bank_account: string | null;
  payment_reference: string | null;
  nbs_payment_code: string | null;
  status: string;
  approved_date: string | null;
  sent_date: string | null;
  paid_date: string | null;
  paid_amount: number | null;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function usePaymentOrders() {
  const { selectedCompany } = useAuth();

  return useQuery({
    queryKey: ["payment_orders", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany) return [];
      const { data, error } = await supabase
        .from("payment_orders" as any)
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as PaymentOrder[];
    },
    enabled: !!selectedCompany,
  });
}

export function usePaymentOrderMutations() {
  const { selectedCompany, user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["payment_orders", selectedCompany?.id];

  const createMutation = useMutation({
    mutationFn: async (order: Partial<PaymentOrder>) => {
      if (!selectedCompany || !user) throw new Error("No company/user");
      const { data, error } = await supabase
        .from("payment_orders" as any)
        .insert({
          ...order,
          company_id: selectedCompany.id,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Nalog za plaćanje kreiran");
    },
    onError: (e: any) => toast.error("Greška: " + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PaymentOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from("payment_orders" as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Nalog ažuriran");
    },
    onError: (e: any) => toast.error("Greška: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("payment_orders" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Nalog obrisan");
    },
    onError: (e: any) => toast.error("Greška: " + e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, extra }: { id: string; status: string; extra?: Record<string, any> }) => {
      const updates: Record<string, any> = { status, updated_at: new Date().toISOString() };
      if (status === "approved") {
        updates.approved_date = new Date().toISOString().split("T")[0];
      } else if (status === "sent") {
        updates.sent_date = new Date().toISOString().split("T")[0];
      } else if (status === "paid") {
        updates.paid_date = extra?.paid_date || updates.approved_date || new Date().toISOString().split("T")[0];
        if (extra?.paid_amount !== undefined) updates.paid_amount = extra.paid_amount;
      }
      if (extra) Object.assign(updates, extra);
      
      const { data, error } = await supabase
        .from("payment_orders" as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey });
      const labels: Record<string, string> = {
        approved: "Nalog odobren za plaćanje",
        sent: "Nalog označen kao poslat",
        paid: "Nalog označen kao plaćen",
      };
      toast.success(labels[vars.status] || "Status ažuriran");
    },
    onError: (e: any) => toast.error("Greška: " + e.message),
  });

  return { createMutation, updateMutation, deleteMutation, updateStatusMutation };
}
