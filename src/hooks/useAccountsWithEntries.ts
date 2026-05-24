import { useQuery, keepPreviousData } from "@tanstack/react-query";
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

      const { data, error } = await supabase.rpc("get_accounts_with_entry_counts", {
        _company_id: selectedCompany.id,
        _business_year_id: selectedYear.id,
      });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        code: row.account_code as string,
        count: Number(row.entry_count) || 0,
      }));
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
    // Keširanje: rezultat ostaje svež 5 min, u cache-u 30 min — brzo prebacivanje
    // između prethodno otvorenih firmi/godina bez ponovnog upita.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // Pri promeni firme/godine zadrži prethodne podatke dok stignu novi (bez treperenja).
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}
