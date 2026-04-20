import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProductionCostRow {
  orgUnitCode: string;
  orgUnitName: string;
  accountCode: string;
  accountName: string;
  materialAmount: number; // konta 51x
  laborAmount: number;    // konta 52x
  otherDirectAmount: number; // ostala 5xx koja korisnik uključi (opciono — trenutno 0)
  total: number;
}

export interface ProductionCostFilters {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  orgUnitCodes?: string[]; // opciono: filtriraj samo na izabrana proizvodna MT
  accountPrefixes?: string[]; // default ["51","52"]
}

interface RawItem {
  account_code: string;
  cost_center_code: string | null;
  debit_amount: number;
  credit_amount: number;
  journal_entries: {
    status: string;
    entry_date: string;
    business_year_id: string;
  } | null;
}

export function useProductionCostReport(filters: ProductionCostFilters | null) {
  const { selectedCompany, selectedYear } = useAuth();

  return useQuery({
    queryKey: [
      "production-cost-report",
      selectedCompany?.id,
      selectedYear?.id,
      filters?.dateFrom,
      filters?.dateTo,
      filters?.orgUnitCodes?.join(","),
      filters?.accountPrefixes?.join(","),
    ],
    queryFn: async (): Promise<RawItem[]> => {
      if (!selectedCompany?.id || !selectedYear?.id || !filters) return [];

      const prefixes = filters.accountPrefixes ?? ["51", "52"];
      // Postgres OR za više prefixa
      const orFilter = prefixes.map((p) => `account_code.like.${p}%`).join(",");

      let query = supabase
        .from("journal_entry_items")
        .select(`
          account_code,
          cost_center_code,
          debit_amount,
          credit_amount,
          journal_entries!inner(
            status,
            entry_date,
            business_year_id
          )
        `)
        .eq("company_id", selectedCompany.id)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.business_year_id", selectedYear.id)
        .gte("journal_entries.entry_date", filters.dateFrom)
        .lte("journal_entries.entry_date", filters.dateTo)
        .or(orFilter);

      if (filters.orgUnitCodes && filters.orgUnitCodes.length > 0) {
        query = query.in("cost_center_code", filters.orgUnitCodes);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as RawItem[]) || [];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id && !!filters,
  });
}
