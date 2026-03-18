import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type DateMode = "valuta" | "dpo";

export interface PartnerBalanceRow {
  partner_id: string;
  partner_code: string;
  partner_name: string;
  debit: number;
  credit: number;
  balance: number;
}

export const ACCOUNT_TYPES = [
  { code: "204", label: "Kupci" },
  { code: "435", label: "Dobavljači" },
  { code: "430", label: "Avansi kupaca" },
  { code: "150", label: "Avansi dobavljačima" },
  { code: "205", label: "Ino kupci" },
  { code: "436", label: "Ino dobavljači" },
] as const;

export function usePartnerBalances(
  accountPrefix: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  dateMode: DateMode
) {
  const { selectedCompany, selectedYear } = useAuth();

  return useQuery({
    queryKey: ["partner-balances", accountPrefix, dateFrom, dateTo, dateMode, selectedCompany?.id, selectedYear?.id],
    queryFn: async (): Promise<PartnerBalanceRow[]> => {
      if (!accountPrefix || !selectedCompany?.id || !selectedYear?.id) return [];

      // Determine if cross-year period
      const fromYear = dateFrom ? new Date(dateFrom).getFullYear() : null;
      const toYear = dateTo ? new Date(dateTo).getFullYear() : null;
      const isCrossYear = fromYear !== null && toYear !== null && fromYear !== toYear;

      // Build query - we need items with partner and matching account prefix
      let query = supabase
        .from("journal_entry_items")
        .select(`
          partner_id,
          debit_amount,
          credit_amount,
          document_date,
          journal_entries!inner(
            entry_date,
            status,
            business_year_id,
            company_id,
            description
          )
        `)
        .not("partner_id", "is", null)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.company_id", selectedCompany.id)
        .like("account_code", `${accountPrefix}%`);

      // If cross-year, don't filter by business year; otherwise filter by selected year
      if (!isCrossYear) {
        query = query.eq("journal_entries.business_year_id", selectedYear.id);
      }

      // Date filtering based on mode
      if (dateMode === "valuta") {
        // Filter by document_date (valuta date) — include nulls
        if (dateFrom) query = query.or(`document_date.gte.${dateFrom},document_date.is.null`);
        if (dateTo) query = query.or(`document_date.lte.${dateTo},document_date.is.null`);
      } else {
        // Filter by entry_date (DPO) on journal_entries
        if (dateFrom) query = query.gte("journal_entries.entry_date", dateFrom);
        if (dateTo) query = query.lte("journal_entries.entry_date", dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter out closing/opening entries if cross-year
      let items = data || [];
      if (isCrossYear) {
        items = items.filter((item: any) => {
          const desc = (item.journal_entries?.description || "").toLowerCase();
          return !desc.includes("zaključna") && !desc.includes("zakljucna") &&
                 !desc.includes("otvaranje") && !desc.includes("početno stanje") &&
                 !desc.includes("pocetno stanje");
        });
      }

      // Group by partner_id
      const partnerMap = new Map<string, { debit: number; credit: number }>();
      for (const item of items as any[]) {
        const pid = item.partner_id;
        if (!pid) continue;
        const existing = partnerMap.get(pid) || { debit: 0, credit: 0 };
        existing.debit += Number(item.debit_amount);
        existing.credit += Number(item.credit_amount);
        partnerMap.set(pid, existing);
      }

      if (partnerMap.size === 0) return [];

      // Fetch partner details
      const partnerIds = [...partnerMap.keys()];
      const allPartners: any[] = [];
      const batchSize = 100;
      for (let i = 0; i < partnerIds.length; i += batchSize) {
        const batch = partnerIds.slice(i, i + batchSize);
        const { data: pData, error: pErr } = await supabase
          .from("partners")
          .select("id, code, name")
          .eq("company_id", selectedCompany.id)
          .in("id", batch);
        if (pErr) throw pErr;
        if (pData) allPartners.push(...pData);
      }

      const partnerLookup = new Map(allPartners.map(p => [p.id, p]));

      const rows: PartnerBalanceRow[] = [];
      for (const [pid, totals] of partnerMap) {
        const partner = partnerLookup.get(pid);
        if (!partner) continue;
        rows.push({
          partner_id: pid,
          partner_code: partner.code,
          partner_name: partner.name,
          debit: totals.debit,
          credit: totals.credit,
          balance: totals.debit - totals.credit,
        });
      }

      rows.sort((a, b) => a.partner_code.localeCompare(b.partner_code));
      return rows;
    },
    enabled: !!accountPrefix && !!selectedCompany?.id && !!selectedYear?.id,
  });
}
