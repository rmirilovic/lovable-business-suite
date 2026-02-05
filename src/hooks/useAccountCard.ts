import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AccountCardItem {
  id: string;
  entry_date: string;
  document_date: string | null;
  entry_number: string;
  document_number: string | null;
  analytics: string | null;
  partner_name: string | null;
  description: string | null;
  debit_amount: number;
  credit_amount: number;
}

export interface AccountCardData {
  items: AccountCardItem[];
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  allAnalytics: string[];
}

export function useAccountCard(
  accountCode: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  analyticsFilter: string | null = null
) {
  const { selectedCompany, selectedYear } = useAuth();

  return useQuery({
    queryKey: ["account-card", accountCode, dateFrom, dateTo, analyticsFilter, selectedCompany?.id, selectedYear?.id],
    queryFn: async (): Promise<AccountCardData> => {
      if (!accountCode || !selectedCompany?.id || !selectedYear?.id) {
        return { items: [], openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0, allAnalytics: [] };
      }

      // Get opening balance (all posted entries before dateFrom)
      let openingBalance = 0;
      if (dateFrom) {
        const { data: openingData, error: openingError } = await supabase
          .from("journal_entry_items")
          .select(`
            debit_amount,
            credit_amount,
            analytics,
            journal_entries!inner(entry_date, status, business_year_id)
          `)
          .eq("account_code", accountCode)
          .eq("company_id", selectedCompany.id)
          .eq("journal_entries.status", "posted")
          .eq("journal_entries.business_year_id", selectedYear.id)
          .lt("journal_entries.entry_date", dateFrom);

        if (openingError) throw openingError;

        // Filter by analytics in JavaScript if needed
        const filteredOpening = analyticsFilter
          ? (openingData || []).filter((item: any) => item.analytics === analyticsFilter)
          : openingData || [];

        openingBalance = filteredOpening.reduce(
          (sum: number, item: any) => sum + Number(item.debit_amount) - Number(item.credit_amount),
          0
        );
      }

      // Get period items with partner info
      let query = supabase
        .from("journal_entry_items")
        .select(`
          id,
          account_code,
          analytics,
          description,
          debit_amount,
          credit_amount,
          document_date,
          partner_id,
          partners(name),
          journal_entries!inner(
            entry_date,
            entry_number,
            document_number,
            status,
            business_year_id
          )
        `)
        .eq("account_code", accountCode)
        .eq("company_id", selectedCompany.id)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.business_year_id", selectedYear.id);

      // Only apply date filters if provided
      if (dateFrom) {
        query = query.gte("journal_entries.entry_date", dateFrom);
      }
      if (dateTo) {
        query = query.lte("journal_entries.entry_date", dateTo);
      }

      const { data, error } = await query;

      console.log("Account card query result:", { accountCode, data, error });

      if (error) throw error;

      // Collect all unique analytics values before filtering
      const allAnalyticsSet = new Set<string>();
      (data || []).forEach((item: any) => {
        if (item.analytics) {
          allAnalyticsSet.add(item.analytics);
        }
      });
      const allAnalytics = Array.from(allAnalyticsSet).sort();

      // Filter by analytics in JavaScript if needed
      const filteredData = analyticsFilter
        ? (data || []).filter((item: any) => item.analytics === analyticsFilter)
        : data || [];

      // Sort by entry date
      filteredData.sort((a: any, b: any) => {
        const dateA = new Date(a.journal_entries.entry_date).getTime();
        const dateB = new Date(b.journal_entries.entry_date).getTime();
        return dateA - dateB;
      });

      const items: AccountCardItem[] = filteredData.map((item: any) => ({
        id: item.id,
        entry_date: item.journal_entries.entry_date,
        document_date: item.document_date,
        entry_number: item.journal_entries.entry_number,
        document_number: item.journal_entries.document_number,
        analytics: item.analytics || null,
        partner_name: item.partners?.name || null,
        description: item.description,
        debit_amount: Number(item.debit_amount),
        credit_amount: Number(item.credit_amount),
      }));

      const totalDebit = items.reduce((sum, item) => sum + item.debit_amount, 0);
      const totalCredit = items.reduce((sum, item) => sum + item.credit_amount, 0);
      const closingBalance = openingBalance + totalDebit - totalCredit;

      return {
        items,
        openingBalance,
        totalDebit,
        totalCredit,
        closingBalance,
        allAnalytics,
      };
    },
    enabled: !!accountCode && !!selectedCompany?.id && !!selectedYear?.id,
  });
}
