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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatPrice } from "@/lib/formatting";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import {
  exportTroskoviPoMTToExcel,
  exportTroskoviPoMTPdf,
  printTroskoviPoMT,
} from "@/lib/troskoviPoMTExportUtils";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
  "Jul", "Avg", "Sep", "Okt", "Nov", "Dec",
];

const MONTH_FULL = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];

export interface TroskoviPoMTRow {
  orgUnitCode: string;
  orgUnitName: string;
  accountCode: string;
  accountName: string;
  months: number[]; // 12 elements
  total: number;
}

export default function TroskoviPoMT() {
  const { selectedCompany, selectedYear } = useAuth();
  const { units } = useOrganizationalUnits(selectedCompany?.id);
  const { data: accounts = [] } = useChartOfAccounts();
  const [filterMTCode, setFilterMTCode] = useState("");
  const [filterMTName, setFilterMTName] = useState("");
  const [filterAccount, setFilterAccount] = useState("");

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["troskovi-po-mt", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];

      const { data, error } = await supabase
        .from("journal_entry_items")
        .select(`
          account_code,
          cost_center_code,
          debit_amount,
          credit_amount,
          journal_entries!inner(
            status,
            business_year_id,
            entry_date
          )
        `)
        .eq("company_id", selectedCompany.id)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.business_year_id", selectedYear.id)
        .like("account_code", "5%");

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const rows = useMemo(() => {
    const orgMap = new Map(units.map((u) => [u.code, u.name]));
    const accMap = new Map(accounts.map((a) => [a.code, a.name]));

    // key: orgCode|accountCode -> months[12]
    const map = new Map<string, number[]>();

    for (const item of rawData as any[]) {
      const cc = item.cost_center_code;
      if (!cc) continue;
      const accCode = item.account_code;
      const entryDate = item.journal_entries?.entry_date;
      if (!entryDate) continue;

      const month = new Date(entryDate).getMonth(); // 0-11
      const amount = Number(item.debit_amount) - Number(item.credit_amount);

      const key = `${cc}|${accCode}`;
      let arr = map.get(key);
      if (!arr) {
        arr = new Array(12).fill(0);
        map.set(key, arr);
      }
      arr[month] += amount;
    }

    const result: TroskoviPoMTRow[] = [];
    for (const [key, months] of map) {
      const total = months.reduce((s, v) => s + v, 0);
      // Only include if at least one month has a non-zero value
      if (months.every((v) => v === 0)) continue;

      const [orgCode, accCode] = key.split("|");
      result.push({
        orgUnitCode: orgCode,
        orgUnitName: orgMap.get(orgCode) || orgCode,
        accountCode: accCode,
        accountName: accMap.get(accCode) || "",
        months,
        total,
      });
    }

    result.sort((a, b) => {
      const cmp = a.orgUnitCode.localeCompare(b.orgUnitCode);
      if (cmp !== 0) return cmp;
      return a.accountCode.localeCompare(b.accountCode);
    });

    return result;
  }, [rawData, units, accounts]);

  const filteredRows = useMemo(() => {
    let filtered = rows;
    if (filterMTCode) {
      const f = filterMTCode.toLowerCase();
      filtered = filtered.filter((r) => r.orgUnitCode.toLowerCase().includes(f));
    }
    if (filterMTName) {
      const f = filterMTName.toLowerCase();
      filtered = filtered.filter((r) => r.orgUnitName.toLowerCase().includes(f));
    }
    if (filterAccount) {
      const f = filterAccount.toLowerCase();
      filtered = filtered.filter((r) => r.accountCode.toLowerCase().startsWith(f));
    }
    return filtered;
  }, [rows, filterMTCode, filterMTName, filterAccount]);

  const monthTotals = useMemo(() => {
    const totals = new Array(12).fill(0);
    for (const r of filteredRows) {
      for (let i = 0; i < 12; i++) totals[i] += r.months[i];
    }
    return totals;
  }, [filteredRows]);

  const grandTotal = monthTotals.reduce((s, v) => s + v, 0);

  const exportMeta = {
    companyName: selectedCompany?.name ?? "",
    yearLabel: selectedYear?.year?.toString() ?? "",
  };

  return (
    <MainLayout title="Troškovi po mestima troškova">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Troškovi po mestima troškova</h1>
            <p className="text-muted-foreground">
              Pregled troškova klase 5 po organizacionim jedinicama i mesecima
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportTroskoviPoMTToExcel(rows, exportMeta)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportTroskoviPoMTPdf(rows, exportMeta)}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printTroskoviPoMT(rows, exportMeta)}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TableScrollContainer className="max-h-[calc(100vh-220px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[80px]">Šifra MT</TableHead>
                  <TableHead className="min-w-[160px]">Naziv MT</TableHead>
                  <TableHead className="min-w-[80px]">Konto</TableHead>
                  <TableHead className="min-w-[160px]">Opis konta</TableHead>
                  {MONTH_LABELS.map((m) => (
                    <TableHead key={m} className="text-right min-w-[90px]">{m}</TableHead>
                  ))}
                  <TableHead className="text-right min-w-[100px] font-bold">UKUPNO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={17} className="text-center text-muted-foreground py-8">
                      Nema podataka o troškovima po mestima troškova
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{row.orgUnitCode}</TableCell>
                      <TableCell>{row.orgUnitName}</TableCell>
                      <TableCell className="font-mono">{row.accountCode}</TableCell>
                      <TableCell>{row.accountName}</TableCell>
                      {row.months.map((v, i) => (
                        <TableCell key={i} className="text-right">
                          {v !== 0 ? formatPrice(v) : "-"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium">{formatPrice(row.total)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {rows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-bold">Ukupno ({rows.length})</TableCell>
                    {monthTotals.map((v, i) => (
                      <TableCell key={i} className="text-right font-bold">
                        {v !== 0 ? formatPrice(v) : "-"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold">{formatPrice(grandTotal)}</TableCell>
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
