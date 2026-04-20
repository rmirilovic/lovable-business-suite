import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProductionCostJournalLine {
  orgUnitCode: string;
  accountCode: string;
  accountName: string;
  amount: number; // pozitivan iznos (zaduženje na 950, razduženje na klasi 5)
}

export interface ProductionCostJournalParams {
  dateFrom: string;
  dateTo: string;
  description: string;
  lines: ProductionCostJournalLine[];
  workInProgressAccount: string; // npr. "950"
}

/**
 * Kreira DRAFT nalog za knjiženje koji prebacuje akumulirane direktne troškove
 * proizvodnje sa konta klase 5xx (kredit) na konto Proizvodnje u toku — npr. 950 (debit).
 *
 * Računovođa ručno proverava i finalizuje (status -> posted) iz editora naloga.
 */
export function useProductionCostJournal() {
  const { selectedCompany, selectedYear, user } = useAuth();

  return useMutation({
    mutationFn: async (params: ProductionCostJournalParams) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) {
        throw new Error("Nedostaju podaci o firmi, godini ili korisniku");
      }
      if (params.lines.length === 0) {
        throw new Error("Nema stavki za knjiženje");
      }

      // Generiši broj naloga: ON-YYNNNN
      const yearShort = String(selectedYear.year).slice(-2);
      const { data: lastEntry } = await supabase
        .from("journal_entries")
        .select("entry_number")
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .like("entry_number", `ON-${yearShort}%`)
        .order("entry_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextSeq = 1;
      if (lastEntry?.entry_number) {
        const m = lastEntry.entry_number.match(/ON-\d{2}(\d{4})/);
        if (m) nextSeq = parseInt(m[1], 10) + 1;
      }
      const entryNumber = `ON-${yearShort}${String(nextSeq).padStart(4, "0")}`;

      const totalAmount = params.lines.reduce((s, l) => s + l.amount, 0);

      // 1. Kreiraj nalog (draft)
      const { data: entry, error: entryErr } = await supabase
        .from("journal_entries")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          entry_number: entryNumber,
          entry_date: params.dateTo,
          description: params.description,
          status: "draft",
          total_debit: totalAmount,
          total_credit: totalAmount,
          created_by: user.id,
          source_type: "production_cost_report",
        })
        .select()
        .single();

      if (entryErr) throw entryErr;

      // 2. Kreiraj stavke: za svaku liniju — debit na 950, credit na klasi 5
      const items: any[] = [];
      let order = 1;

      for (const line of params.lines) {
        // Debit: konto proizvodnje u toku
        items.push({
          journal_entry_id: entry.id,
          company_id: selectedCompany.id,
          account_code: params.workInProgressAccount,
          description: `${params.description} - ${line.accountCode} - MT ${line.orgUnitCode}`,
          debit_amount: line.amount,
          credit_amount: 0,
          cost_center_code: line.orgUnitCode,
          item_order: order++,
        });
        // Credit: izvorni konto klase 5
        items.push({
          journal_entry_id: entry.id,
          company_id: selectedCompany.id,
          account_code: line.accountCode,
          description: `${params.description} - prenos na ${params.workInProgressAccount}`,
          debit_amount: 0,
          credit_amount: line.amount,
          cost_center_code: line.orgUnitCode,
          item_order: order++,
        });
      }

      const { error: itemsErr } = await supabase
        .from("journal_entry_items")
        .insert(items);

      if (itemsErr) {
        // Cleanup
        await supabase.from("journal_entries").delete().eq("id", entry.id);
        throw itemsErr;
      }

      return entry;
    },
    onSuccess: (entry) => {
      toast.success(`Predlog naloga ${entry.entry_number} je kreiran kao nacrt`);
    },
    onError: (err: Error) => {
      toast.error(`Greška: ${err.message}`);
    },
  });
}
