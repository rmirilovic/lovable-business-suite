import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { FileSpreadsheet, FileText, Printer, Loader2 } from "lucide-react";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatNumber, formatPrice } from "@/lib/formatting";
import {
  exportStanjePoTRToExcel,
  exportStanjePoTRToPdf,
  printStanjePoTR,
} from "@/lib/stanjePoTRExportUtils";

export interface StanjePoTRRow {
  account_code: string;
  account_name: string;
  analytics: string;
  analytics_description: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function StanjePoTR() {
  const { selectedCompany, selectedYear } = useAuth();
  const { data: accounts = [] } = useChartOfAccounts();

  const [accountFrom, setAccountFrom] = useState("241");
  const [accountTo, setAccountTo] = useState("2419");

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts-lookup", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("code, bank_name")
        .eq("company_id", selectedCompany.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["stanje-po-tr", selectedCompany?.id, selectedYear?.id, accountFrom, accountTo],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];

      const { data, error } = await supabase
        .from("journal_entry_items")
        .select(`
          account_code,
          cost_center_code,
          debit_amount,
          credit_amount,
          partner_id,
          partners(code, name),
          journal_entries!inner(
            status,
            business_year_id
          )
        `)
        .eq("company_id", selectedCompany.id)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.business_year_id", selectedYear.id)
        .gte("account_code", accountFrom)
        .lte("account_code", accountTo + "\uffff");

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id && !!accountFrom,
  });

  const rows = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number; analytics: string; partnerName: string }>();

    for (const item of rawData as any[]) {
      const code = item.account_code;
      const analytics = item.cost_center_code || item.partners?.code || "";
      const partnerName = item.partners?.name || "";
      const key = `${code}|${analytics}`;

      const existing = map.get(key);
      if (existing) {
        existing.debit += Number(item.debit_amount);
        existing.credit += Number(item.credit_amount);
        if (!existing.partnerName && partnerName) existing.partnerName = partnerName;
      } else {
        map.set(key, {
          debit: Number(item.debit_amount),
          credit: Number(item.credit_amount),
          analytics,
          partnerName,
        });
      }
    }

    const accountMap = new Map(accounts.map((a) => [a.code, a.name]));
    const bankMap = new Map(bankAccounts.map((b) => [b.code, b.bank_name]));

    const result: StanjePoTRRow[] = [];
    for (const [key, val] of map) {
      const [accountCode] = key.split("|");
      // Use bank name from bank_accounts if available, otherwise partner name
      const analyticsDesc = bankMap.get(val.analytics) || val.partnerName;
      result.push({
        account_code: accountCode,
        account_name: accountMap.get(accountCode) || "",
        analytics: val.analytics,
        analytics_description: analyticsDesc,
        debit: val.debit,
        credit: val.credit,
        balance: val.debit - val.credit,
      });
    }

    result.sort((a, b) => {
      const cmp = a.account_code.localeCompare(b.account_code);
      if (cmp !== 0) return cmp;
      return a.analytics.localeCompare(b.analytics);
    });

    return result;
  }, [rawData, accounts, bankAccounts]);

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const totalBalance = totalDebit - totalCredit;

  const exportMeta = {
    companyName: selectedCompany?.name ?? "",
    accountFrom,
    accountTo,
    yearLabel: selectedYear?.year?.toString() ?? "",
  };

  return (
    <MainLayout title="Stanje po TR">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Stanje po TR</h1>
            <p className="text-muted-foreground">Pregled stanja po tekućim računima</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportStanjePoTRToExcel(rows, exportMeta)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportStanjePoTRToPdf(rows, exportMeta)}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printStanjePoTR(rows, exportMeta)}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-32">
            <Label>Konto od</Label>
            <Input value={accountFrom} onChange={(e) => setAccountFrom(e.target.value)} placeholder="241" />
          </div>
          <div className="w-32">
            <Label>Konto do</Label>
            <Input value={accountTo} onChange={(e) => setAccountTo(e.target.value)} placeholder="2419" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TableScrollContainer className="max-h-[calc(100vh-280px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Konto</TableHead>
                  <TableHead>Opis konta</TableHead>
                  <TableHead>Analitika</TableHead>
                  <TableHead>Opis analitike</TableHead>
                  <TableHead className="text-right">Duguje</TableHead>
                  <TableHead className="text-right">Potražuje</TableHead>
                  <TableHead className="text-right">Stanje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nema podataka za izabrani opseg konta
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{row.account_code}</TableCell>
                      <TableCell>{row.account_name}</TableCell>
                      <TableCell className="font-mono">{row.analytics || "-"}</TableCell>
                      <TableCell>{row.analytics_description || "-"}</TableCell>
                      <TableCell className="text-right">{formatPrice(row.debit)}</TableCell>
                      <TableCell className="text-right">{formatPrice(row.credit)}</TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(row.balance)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {rows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-bold">Ukupno ({rows.length})</TableCell>
                    <TableCell className="text-right font-bold">{formatPrice(totalDebit)}</TableCell>
                    <TableCell className="text-right font-bold">{formatPrice(totalCredit)}</TableCell>
                    <TableCell className="text-right font-bold">{formatPrice(totalBalance)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </TableScrollContainer>
        )}
      </div>
    </MainLayout>
  );
}
