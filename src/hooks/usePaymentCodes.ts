import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PaymentCode {
  id: string;
  company_id: string;
  code: string;
  name: string;
  account_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function usePaymentCodes() {
  const { selectedCompany } = useAuth();

  const query = useQuery({
    queryKey: ["payment_codes", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_codes")
        .select("*")
        .eq("company_id", selectedCompany!.id)
        .order("code");
      if (error) throw error;
      return data as PaymentCode[];
    },
    enabled: !!selectedCompany?.id,
  });

  return query;
}

export function usePaymentCodeMutations() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useAuth();

  const create = useMutation({
    mutationFn: async (pc: { code: string; name: string; account_code: string }) => {
      const { data, error } = await supabase
        .from("payment_codes")
        .insert({ ...pc, company_id: selectedCompany!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_codes"] });
      toast.success("Šifra plaćanja kreirana");
    },
    onError: (e: Error) => {
      if (e.message.includes("duplicate")) toast.error("Šifra već postoji");
      else toast.error(`Greška: ${e.message}`);
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PaymentCode> & { id: string }) => {
      const { data, error } = await supabase
        .from("payment_codes")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_codes"] });
      toast.success("Šifra plaćanja ažurirana");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_codes"] });
      toast.success("Šifra plaćanja obrisana");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });

  return { create, update, remove };
}
