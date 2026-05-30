import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BankAccount {
  id: string;
  company_id: string;
  code: string;
  account_number: string;
  bank_name: string;
  currency: string;
  gl_account_code: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type BankAccountInsert = Omit<BankAccount, "id" | "created_at" | "updated_at">;
export type BankAccountUpdate = Partial<Omit<BankAccount, "id" | "company_id" | "created_at" | "updated_at">>;

export function useBankAccounts(companyId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["bank_accounts", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", companyId!)
        .order("code");
      if (error) throw error;
      return data as BankAccount[];
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (ba: BankAccountInsert) => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .insert(ba)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
      toast.success("Tekući račun uspešno kreiran");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate key")) {
        toast.error("Tekući račun sa ovom šifrom već postoji");
      } else {
        toast.error("Greška pri kreiranju tekućeg računa");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: BankAccountUpdate }) => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
      toast.success("Tekući račun uspešno ažuriran");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate key")) {
        toast.error("Tekući račun sa ovom šifrom već postoji");
      } else {
        toast.error("Greška pri ažuriranju tekućeg računa");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
      toast.success("Tekući račun uspešno obrisan");
    },
    onError: () => {
      toast.error("Greška pri brisanju tekućeg računa");
    },
  });

  return {
    bankAccounts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createBankAccount: createMutation.mutateAsync,
    updateBankAccount: updateMutation.mutateAsync,
    deleteBankAccount: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
