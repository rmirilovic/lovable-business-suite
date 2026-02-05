import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AccountCardItem {
  id: string;
  entry_date: string;
  document_date: string | null;
  entry_number: string;
  document_number: string | null;
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
}

export function useAccountCard(
  accountCode: string | null,
  dateFrom: string | null,
  dateTo: string | null
) {
  const { selectedCompany, selectedYear } = useAuth();

  return useQuery({
    queryKey: ["account-card", accountCode, dateFrom, dateTo, selectedCompany?.id, selectedYear?.id],
    queryFn: async (): Promise<AccountCardData> => {
      if (!accountCode || !selectedCompany?.id || !selectedYear?.id) {
        return { items: [], openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0 };
      }

      // Get opening balance (all posted entries before dateFrom)
      let openingBalance = 0;
      if (dateFrom) {
        const { data: openingData, error: openingError } = await supabase
          .from("journal_entry_items")
          .select(`
            debit_amount,
            credit_amount,
            journal_entries!inner(entry_date, status, business_year_id)
          `)
          .eq("account_code", accountCode)
          .eq("company_id", selectedCompany.id)
          .eq("journal_entries.status", "posted")
          .eq("journal_entries.business_year_id", selectedYear.id)
          .lt("journal_entries.entry_date", dateFrom);

        if (openingError) throw openingError;

        openingBalance = (openingData || []).reduce(
          (sum, item) => sum + Number(item.debit_amount) - Number(item.credit_amount),
          0
        );
      }

      // Get period items with partner info
      let query = supabase
        .from("journal_entry_items")
        .select(`
          id,
          account_code,
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
        .eq("journal_entries.business_year_id", selectedYear.id)
        .order("journal_entries(entry_date)", { ascending: true });

      if (dateFrom) {
        query = query.gte("journal_entries.entry_date", dateFrom);
      }
      if (dateTo) {
        query = query.lte("journal_entries.entry_date", dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;

      const items: AccountCardItem[] = (data || []).map((item: any) => ({
        id: item.id,
        entry_date: item.journal_entries.entry_date,
        document_date: item.document_date,
        entry_number: item.journal_entries.entry_number,
        document_number: item.journal_entries.document_number,
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
      };
    },
    enabled: !!accountCode && !!selectedCompany?.id && !!selectedYear?.id,
  });
}
