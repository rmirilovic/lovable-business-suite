import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAccountsWithEntries() {
  const { selectedCompany, selectedYear } = useAuth();

  return useQuery({
    queryKey: ["accounts-with-entries", selectedCompany?.id, selectedYear?.id],
    queryFn: async (): Promise<string[]> => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];

      const { data, error } = await supabase
        .from("journal_entry_items")
        .select("account_code, journal_entries!inner(status, business_year_id)")
        .eq("company_id", selectedCompany.id)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.business_year_id", selectedYear.id)
        .not("account_code", "is", null);

      if (error) throw error;

      const codes = new Set<string>();
      (data || []).forEach((item: any) => {
        if (item.account_code) codes.add(item.account_code);
      });

      return Array.from(codes).sort();
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });
}
