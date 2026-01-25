import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export interface ChartOfAccountsRow {
  id: string;
  company_id: string;
  code: string;
  name: string;
  account_type: AccountType;
  parent_code: string | null;
  level: number;
  is_active: boolean;
  is_posting_allowed: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useChartOfAccounts() {
  const { selectedCompany } = useAuth();

  return useQuery({
    queryKey: ["chart-of-accounts", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("code");

      if (error) throw error;
      return data as ChartOfAccountsRow[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useChartOfAccountsMutations() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useAuth();

  const createAccount = useMutation({
    mutationFn: async (account: Omit<ChartOfAccountsRow, "id" | "created_at" | "updated_at" | "company_id">) => {
      if (!selectedCompany?.id) throw new Error("Nije izabrana firma");

      const { data, error } = await supabase
        .from("chart_of_accounts")
        .insert({ ...account, company_id: selectedCompany.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast.success("Konto je uspešno kreiran");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChartOfAccountsRow> & { id: string }) => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast.success("Konto je uspešno ažuriran");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("chart_of_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast.success("Konto je uspešno obrisan");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  return { createAccount, updateAccount, deleteAccount };
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "Aktiva",
  liability: "Pasiva",
  equity: "Kapital",
  revenue: "Prihodi",
  expense: "Rashodi",
};

export const ACCOUNT_CLASS_TYPES: Record<string, AccountType> = {
  "0": "asset",      // Neuplaćeni upisani kapital i stalna imovina
  "1": "asset",      // Zalihe
  "2": "asset",      // Kratkoročna potraživanja, plasmani i gotovina
  "3": "liability",  // Kapital
  "4": "liability",  // Dugoročna rezervisanja i obaveze
  "5": "expense",    // Rashodi
  "6": "revenue",    // Prihodi
  "7": "expense",    // Otvaranje i zaključak računa
  "8": "asset",      // Vanbilansna aktiva
  "9": "liability",  // Vanbilansna pasiva
};
