import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AccountWithEntryCount {
  code: string;
  count: number;
}

export function useAccountsWithEntries() {
  const { selectedCompany, selectedYear } = useAuth();

  return useQuery({
    queryKey: ["accounts-with-entries", selectedCompany?.id, selectedYear?.id],
    queryFn: async (): Promise<AccountWithEntryCount[]> => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];

      const { data, error } = await supabase
        .from("journal_entry_items")
        .select("account_code, journal_entries!inner(status, business_year_id)")
        .eq("company_id", selectedCompany.id)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.business_year_id", selectedYear.id)
        .not("account_code", "is", null);

      if (error) throw error;

      const counts = new Map<string, number>();
      (data || []).forEach((item: any) => {
        if (item.account_code) {
          counts.set(item.account_code, (counts.get(item.account_code) || 0) + 1);
        }
      });

      return Array.from(counts.entries())
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => a.code.localeCompare(b.code));
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });
}
