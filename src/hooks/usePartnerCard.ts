import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PartnerCardItem {
  id: string;
  entry_date: string;
  document_date: string | null;
  entry_number: string;
  document_number: string | null;
  account_code: string;
  description: string | null;
  debit_amount: number;
  credit_amount: number;
}

export interface PartnerCardData {
  items: PartnerCardItem[];
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export function usePartnerCard(
  partnerId: string | null,
  dateFrom: string | null,
  dateTo: string | null
) {
  const { selectedCompany, selectedYear } = useAuth();

  return useQuery({
    queryKey: ["partner-card", partnerId, dateFrom, dateTo, selectedCompany?.id, selectedYear?.id],
    queryFn: async (): Promise<PartnerCardData> => {
      if (!partnerId || !selectedCompany?.id || !selectedYear?.id) {
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
            journal_entries!inner(entry_date, status, year_id)
          `)
          .eq("partner_id", partnerId)
          .eq("journal_entries.status", "posted")
          .eq("journal_entries.year_id", selectedYear.id)
          .lt("journal_entries.entry_date", dateFrom);

        if (openingError) throw openingError;

        openingBalance = (openingData || []).reduce(
          (sum, item) => sum + Number(item.debit_amount) - Number(item.credit_amount),
          0
        );
      }

      // Get period items
      let query = supabase
        .from("journal_entry_items")
        .select(`
          id,
          account_code,
          description,
          debit_amount,
          credit_amount,
          document_date,
          journal_entries!inner(
            entry_date,
            entry_number,
            document_number,
            status,
            year_id
          )
        `)
        .eq("partner_id", partnerId)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.year_id", selectedYear.id)
        .order("journal_entries(entry_date)", { ascending: true });

      if (dateFrom) {
        query = query.gte("journal_entries.entry_date", dateFrom);
      }
      if (dateTo) {
        query = query.lte("journal_entries.entry_date", dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;

      const items: PartnerCardItem[] = (data || []).map((item: any) => ({
        id: item.id,
        entry_date: item.journal_entries.entry_date,
        document_date: item.document_date,
        entry_number: item.journal_entries.entry_number,
        document_number: item.journal_entries.document_number,
        account_code: item.account_code,
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
    enabled: !!partnerId && !!selectedCompany?.id && !!selectedYear?.id,
  });
}
