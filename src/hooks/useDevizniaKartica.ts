import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DeviznaStavka {
  date: string;
  doc_type: "invoice" | "payment" | "fx_gain" | "fx_loss";
  doc_number: string;
  description: string;
  debit_original: number;
  credit_original: number;
  debit_rsd: number;
  credit_rsd: number;
  exchange_rate: number;
}

export function useDevizniaKartica(
  partnerId: string | null,
  currency: string,
  dateFrom: string,
  dateTo: string,
) {
  const { selectedCompany, selectedYear } = useAuth();

  return useQuery({
    queryKey: ["devizna-kartica", selectedCompany?.id, selectedYear?.id, partnerId, currency, dateFrom, dateTo],
    enabled: !!selectedCompany?.id && !!selectedYear?.id && !!partnerId && !!currency && currency !== "RSD",
    queryFn: async (): Promise<DeviznaStavka[]> => {
      const rows: DeviznaStavka[] = [];

      // Devizne fakture (zaduženje)
      const { data: invs, error: invErr } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, currency, exchange_rate, total_amount, subtotal_rsd, total_amount_rsd")
        .eq("company_id", selectedCompany!.id)
        .eq("business_year_id", selectedYear!.id)
        .eq("partner_id", partnerId!)
        .eq("currency", currency)
        .eq("status", "posted")
        .gte("invoice_date", dateFrom)
        .lte("invoice_date", dateTo);
      if (invErr) throw invErr;

      (invs || []).forEach((inv: any) => {
        const fx = Number(inv.exchange_rate ?? 1);
        const totalOrig = Number(inv.total_amount ?? 0);
        rows.push({
          date: inv.invoice_date,
          doc_type: "invoice",
          doc_number: `FAK ${inv.invoice_number}`,
          description: `Faktura ${inv.invoice_number}`,
          debit_original: totalOrig,
          credit_original: 0,
          debit_rsd: Number(inv.total_amount_rsd ?? totalOrig * fx),
          credit_rsd: 0,
          exchange_rate: fx,
        });
      });

      // Uplate (stavke izvoda koje zatvaraju te fakture)
      const invIds = (invs || []).map((i: any) => i.id);
      if (invIds.length > 0) {
        const { data: pays, error: payErr } = await supabase
          .from("bank_statement_items")
          .select(`
            id, original_debit_amount, original_credit_amount,
            debit_amount, credit_amount, closed_document_id,
            bank_statements!inner(statement_number, statement_date, exchange_rate, bank_account_id, status,
              bank_accounts!inner(currency))
          `)
          .eq("company_id", selectedCompany!.id)
          .eq("closed_document_type", "invoice")
          .in("closed_document_id", invIds);
        if (payErr) throw payErr;

        (pays || []).forEach((p: any) => {
          if (p.bank_statements?.status !== "posted") return;
          if (p.bank_statements?.bank_accounts?.currency !== currency) return;
          const d = p.bank_statements.statement_date;
          if (d < dateFrom || d > dateTo) return;
          const fx = Number(p.bank_statements.exchange_rate ?? 1);
          const origCredit = Number(p.original_credit_amount ?? 0);
          rows.push({
            date: d,
            doc_type: "payment",
            doc_number: `IB ${p.bank_statements.statement_number}`,
            description: `Uplata po izvodu`,
            debit_original: 0,
            credit_original: origCredit,
            debit_rsd: 0,
            credit_rsd: Number(p.credit_amount ?? origCredit * fx),
            exchange_rate: fx,
          });
        });
      }

      rows.sort((a, b) => a.date.localeCompare(b.date) || (a.doc_type === "invoice" ? -1 : 1));
      return rows;
    },
  });
}
