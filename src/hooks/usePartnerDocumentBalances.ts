import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PartnerDocumentRow {
  id: string;
  partner_id: string;
  partner_code: string;
  partner_name: string;
  document_number: string;
  document_date: string | null;
  debit: number;
  credit: number;
  saldo: number;
  days_overdue: number | null; // null means "-"
}

export const DOC_ACCOUNT_TYPES = [
  { code: "204", label: "Kupci" },
  { code: "435", label: "Dobavljači" },
  { code: "205", label: "Ino kupci" },
  { code: "436", label: "Ino dobavljači" },
] as const;

// For customer accounts, debits are charges; for supplier accounts, credits are charges
function isCustomerAccount(prefix: string) {
  return prefix === "204" || prefix === "205";
}

interface RawItem {
  id: string;
  partner_id: string;
  debit_amount: number;
  credit_amount: number;
  document_date: string | null;
  description: string | null;
  journal_entries: {
    entry_number: string;
    entry_date: string;
    status: string;
    business_year_id: string;
    company_id: string;
    description: string;
    document_number: string | null;
  };
}

function applyFifo(
  items: RawItem[],
  accountPrefix: string,
  today: Date
): Omit<PartnerDocumentRow, "partner_code" | "partner_name">[] {
  const isCustomer = isCustomerAccount(accountPrefix);

  // Sort by document_date ASC, then entry_date
  const sorted = [...items].sort((a, b) => {
    const da = a.document_date || a.journal_entries.entry_date;
    const db = b.document_date || b.journal_entries.entry_date;
    return da.localeCompare(db);
  });

  // Each item gets a remaining saldo
  const results: {
    id: string;
    partner_id: string;
    document_number: string;
    document_date: string | null;
    debit: number;
    credit: number;
    remaining: number; // positive = open charge
  }[] = sorted.map((item) => {
    const debit = Number(item.debit_amount);
    const credit = Number(item.credit_amount);
    const docNum =
      item.journal_entries.document_number ||
      item.journal_entries.entry_number;
    return {
      id: item.id,
      partner_id: item.partner_id!,
      document_number: docNum,
      document_date: item.document_date,
      debit,
      credit,
      remaining: debit - credit, // positive = owes money (customer), negative for payments
    };
  });

  // FIFO: apply payments against charges
  // For customers: charges have positive remaining (debit), payments have negative (credit)
  // For suppliers: charges have negative remaining (credit), payments have positive (debit)
  if (isCustomer) {
    // Charges: remaining > 0 (debit entries)
    // Payments: remaining < 0 (credit entries)
    const charges = results.filter((r) => r.remaining > 0);
    const payments = results.filter((r) => r.remaining < 0);

    let ci = 0;
    for (const payment of payments) {
      let paymentLeft = Math.abs(payment.remaining);
      while (paymentLeft > 0 && ci < charges.length) {
        const apply = Math.min(paymentLeft, charges[ci].remaining);
        charges[ci].remaining -= apply;
        paymentLeft -= apply;
        if (charges[ci].remaining <= 0.005) {
          charges[ci].remaining = 0;
          ci++;
        }
      }
      payment.remaining = paymentLeft > 0.005 ? -paymentLeft : 0;
    }
  } else {
    // Suppliers: charges have negative remaining (credit), payments positive (debit)
    const charges = results.filter((r) => r.remaining < 0);
    const payments = results.filter((r) => r.remaining > 0);

    let ci = 0;
    for (const payment of payments) {
      let paymentLeft = payment.remaining;
      while (paymentLeft > 0 && ci < charges.length) {
        const chargeAbs = Math.abs(charges[ci].remaining);
        const apply = Math.min(paymentLeft, chargeAbs);
        charges[ci].remaining += apply; // moves toward 0
        paymentLeft -= apply;
        if (Math.abs(charges[ci].remaining) <= 0.005) {
          charges[ci].remaining = 0;
          ci++;
        }
      }
      payment.remaining = paymentLeft > 0.005 ? paymentLeft : 0;
    }
  }

  return results.map((r) => {
    const saldo = Math.abs(r.remaining) < 0.005 ? 0 : r.remaining;
    let daysOverdue: number | null = null;
    if (saldo !== 0 && r.document_date) {
      const docDate = new Date(r.document_date);
      const diffMs = today.getTime() - docDate.getTime();
      daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (daysOverdue < 0) daysOverdue = 0;
    }
    return {
      id: r.id,
      partner_id: r.partner_id,
      document_number: r.document_number,
      document_date: r.document_date,
      debit: r.debit,
      credit: r.credit,
      saldo,
      days_overdue: daysOverdue,
    };
  });
}

export function usePartnerDocumentBalances(
  accountPrefix: string | null,
  dateFrom: string | null,
  dateTo: string | null
) {
  const { selectedCompany, selectedYear } = useAuth();

  return useQuery({
    queryKey: [
      "partner-document-balances",
      accountPrefix,
      dateFrom,
      dateTo,
      selectedCompany?.id,
      selectedYear?.id,
    ],
    queryFn: async (): Promise<PartnerDocumentRow[]> => {
      if (!accountPrefix || !selectedCompany?.id || !selectedYear?.id) return [];

      const fromYear = dateFrom ? new Date(dateFrom).getFullYear() : null;
      const toYear = dateTo ? new Date(dateTo).getFullYear() : null;
      const isCrossYear =
        fromYear !== null && toYear !== null && fromYear !== toYear;

      let query = supabase
        .from("journal_entry_items")
        .select(
          `
          id,
          partner_id,
          debit_amount,
          credit_amount,
          document_date,
          description,
          journal_entries!inner(
            entry_number,
            entry_date,
            status,
            business_year_id,
            company_id,
            description,
            document_number
          )
        `
        )
        .not("partner_id", "is", null)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.company_id", selectedCompany.id)
        .like("account_code", `${accountPrefix}%`);

      if (!isCrossYear) {
        query = query.eq(
          "journal_entries.business_year_id",
          selectedYear.id
        );
      }

      // Filter by document_date (valuta) — include nulls (e.g. invoice entries without valuta date)
      if (dateFrom) query = query.or(`document_date.gte.${dateFrom},document_date.is.null`);
      if (dateTo) query = query.or(`document_date.lte.${dateTo},document_date.is.null`);

      const { data, error } = await query;
      if (error) throw error;

      let items = (data || []) as unknown as RawItem[];

      // Exclude closing/opening entries for cross-year
      if (isCrossYear) {
        items = items.filter((item) => {
          const desc = (item.journal_entries?.description || "").toLowerCase();
          return (
            !desc.includes("zaključna") &&
            !desc.includes("zakljucna") &&
            !desc.includes("otvaranje") &&
            !desc.includes("početno stanje") &&
            !desc.includes("pocetno stanje")
          );
        });
      }

      if (items.length === 0) return [];

      // Group by partner
      const byPartner = new Map<string, RawItem[]>();
      for (const item of items) {
        const pid = item.partner_id!;
        if (!byPartner.has(pid)) byPartner.set(pid, []);
        byPartner.get(pid)!.push(item);
      }

      // Fetch partner details
      const partnerIds = [...byPartner.keys()];
      const allPartners: { id: string; code: string; name: string }[] = [];
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
      const partnerLookup = new Map(allPartners.map((p) => [p.id, p]));

      const today = new Date();
      const rows: PartnerDocumentRow[] = [];

      for (const [pid, partnerItems] of byPartner) {
        const partner = partnerLookup.get(pid);
        if (!partner) continue;

        const docRows = applyFifo(partnerItems, accountPrefix, today);
        for (const dr of docRows) {
          rows.push({
            ...dr,
            partner_code: partner.code,
            partner_name: partner.name,
          });
        }
      }

      // Default sort by partner_code, then document_date
      rows.sort((a, b) => {
        const pc = a.partner_code.localeCompare(b.partner_code);
        if (pc !== 0) return pc;
        const da = a.document_date || "";
        const db = b.document_date || "";
        return da.localeCompare(db);
      });

      return rows;
    },
    enabled: !!accountPrefix && !!selectedCompany?.id && !!selectedYear?.id,
  });
}
