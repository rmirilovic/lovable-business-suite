import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { FileSpreadsheet, FileText, Printer, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatPrice } from "@/lib/formatting";
import { bilansUspehaPositions, type AopPosition } from "@/config/bilansUspehaAOP";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import {
  exportBilansUspehaToExcel,
  exportBilansUspehaToPdf,
  printBilansUspeha,
} from "@/lib/bilansUspehaExportUtils";

export interface ComputedRow {
  aop: number;
  label: string;
  currentYear: number;
  prevYearOpening: number | null;
  prevYearClosing: number | null;
  bold?: boolean;
  indent?: number;
  separator?: boolean;
  sectionHeader?: boolean;
}

async function fetchClassItems(companyId: string, yearId: string, dateTo: string) {
  const results: any[] = [];
  for (const cls of ["5", "6", "7"]) {
    const { data, error } = await supabase
      .from("journal_entry_items")
      .select(`
        account_code,
        debit_amount,
        credit_amount,
        journal_entries!inner(status, business_year_id, entry_date)
      `)
      .eq("company_id", companyId)
      .eq("journal_entries.status", "posted")
      .eq("journal_entries.business_year_id", yearId)
      .lte("journal_entries.entry_date", dateTo)
      .gte("account_code", cls)
      .lt("account_code", String(Number(cls) + 1));
    if (error) throw error;
    if (data) results.push(...data);
  }
  return results;
}

function buildAccountTotals(items: any[]) {
  const map = new Map<string, { debit: number; credit: number }>();
  for (const item of items) {
    const code = item.account_code as string;
    const existing = map.get(code);
    if (existing) {
      existing.debit += Number(item.debit_amount);
      existing.credit += Number(item.credit_amount);
    } else {
      map.set(code, {
        debit: Number(item.debit_amount),
        credit: Number(item.credit_amount),
      });
    }
  }
  return map;
}

function sumForRange(accountTotals: Map<string, { debit: number; credit: number }>, from: string, to: string, sign: "credit" | "debit"): number {
  let total = 0;
  for (const [code, val] of accountTotals) {
    if (code >= from && code <= to + "\uffff") {
      if (sign === "credit") {
        total += val.credit - val.debit;
      } else {
        total += val.debit - val.credit;
      }
    }
  }
  return total;
}

function computeAopValues(accountTotals: Map<string, { debit: number; credit: number }>) {
  const aopValues = new Map<number, number>();

  for (const pos of bilansUspehaPositions) {
    if (pos.accountRanges) {
      let total = 0;
      for (const [from, to] of pos.accountRanges) {
        total += sumForRange(accountTotals, from, to, pos.sign || "credit");
      }
      aopValues.set(pos.aop, total);
    }
  }

  for (let pass = 0; pass < 3; pass++) {
    for (const pos of bilansUspehaPositions) {
      if (pos.formula) {
        let val = 0;
        for (const p of pos.formula.plus || []) {
          val += aopValues.get(p) || 0;
        }
        for (const m of pos.formula.minus || []) {
          val -= aopValues.get(m) || 0;
        }
        if (pos.label.includes("DOBITAK") || pos.label.includes("GUBITAK")) {
          val = Math.max(0, val);
        }
        aopValues.set(pos.aop, val);
      }
    }
  }

  return aopValues;
}

export default function BilansUspeha() {
  const { selectedCompany, selectedYear } = useAuth();
  const { minDate, maxDate } = useBusinessYearDateLimits();

  const { data: companyDetails } = useQuery({
    queryKey: ["company-details", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      const { data } = await supabase
        .from("companies")
        .select("name, address, city, pib, mb, activity_code")
        .eq("id", selectedCompany.id)
        .single();
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const defaultDate = maxDate || new Date().toISOString().slice(0, 10);
  const [reportDate, setReportDate] = useState(defaultDate);

  // Find previous business year
  const { data: prevYear } = useQuery({
    queryKey: ["prev-business-year", selectedCompany?.id, selectedYear?.year],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.year) return null;
      const { data } = await supabase
        .from("business_years")
        .select("id, year")
        .eq("company_id", selectedCompany.id)
        .eq("year", selectedYear.year - 1)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.year,
  });

  // Fetch current year items
  const { data: rawItems = [], isLoading } = useQuery({
    queryKey: ["bilans-uspeha", selectedCompany?.id, selectedYear?.id, reportDate],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      return fetchClassItems(selectedCompany.id, selectedYear.id, reportDate);
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  // Fetch previous year opening (01.01) items
  const { data: prevYearOpeningItems = [] } = useQuery({
    queryKey: ["bilans-uspeha-prev-opening", selectedCompany?.id, prevYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !prevYear?.id) return [];
      // Opening balance = items up to Jan 1 of previous year (opening entries only)
      return fetchClassItems(selectedCompany.id, prevYear.id, `${prevYear.year}-01-01`);
    },
    enabled: !!selectedCompany?.id && !!prevYear?.id,
  });

  // Fetch previous year closing (31.12) items
  const { data: prevYearClosingItems = [] } = useQuery({
    queryKey: ["bilans-uspeha-prev-closing", selectedCompany?.id, prevYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !prevYear?.id) return [];
      return fetchClassItems(selectedCompany.id, prevYear.id, `${prevYear.year}-12-31`);
    },
    enabled: !!selectedCompany?.id && !!prevYear?.id,
  });

  const accountTotals = useMemo(() => buildAccountTotals(rawItems), [rawItems]);
  const prevOpeningTotals = useMemo(() => buildAccountTotals(prevYearOpeningItems), [prevYearOpeningItems]);
  const prevClosingTotals = useMemo(() => buildAccountTotals(prevYearClosingItems), [prevYearClosingItems]);

  const hasPrevYear = !!prevYear;

  const rows = useMemo(() => {
    const currentValues = computeAopValues(accountTotals);
    const prevOpeningValues = hasPrevYear ? computeAopValues(prevOpeningTotals) : null;
    const prevClosingValues = hasPrevYear ? computeAopValues(prevClosingTotals) : null;

    return bilansUspehaPositions.map((pos): ComputedRow => ({
      aop: pos.aop,
      label: pos.label,
      currentYear: currentValues.get(pos.aop) || 0,
      prevYearOpening: prevOpeningValues ? (prevOpeningValues.get(pos.aop) || 0) : null,
      prevYearClosing: prevClosingValues ? (prevClosingValues.get(pos.aop) || 0) : null,
      bold: pos.bold,
      indent: pos.indent,
      separator: pos.separator,
      sectionHeader: pos.sectionHeader,
    }));
  }, [accountTotals, prevOpeningTotals, prevClosingTotals, hasPrevYear]);

  const exportMeta = {
    companyName: companyDetails?.name ?? selectedCompany?.name ?? "",
    companyAddress: companyDetails?.address ?? "",
    companyCity: companyDetails?.city ?? "",
    companyPib: companyDetails?.pib ?? "",
    companyMb: companyDetails?.mb ?? "",
    yearLabel: selectedYear?.year?.toString() ?? "",
    prevYearLabel: prevYear ? String(prevYear.year) : "",
    reportDate,
  };

  return (
    <MainLayout title="Bilans uspeha">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bilans uspeha</h1>
            <p className="text-muted-foreground">
              Izveštaj o dobitku i gubitku za period od 01.01.{selectedYear?.year} do {reportDate ? new Date(reportDate).toLocaleDateString("sr-RS") : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportBilansUspehaToExcel(rows, exportMeta)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportBilansUspehaToPdf(rows, exportMeta)}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printBilansUspeha(rows, exportMeta)}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-muted/30 text-sm grid grid-cols-1 md:grid-cols-2 gap-2">
          <div><span className="font-medium">Firma:</span> {companyDetails?.name ?? selectedCompany?.name}</div>
          <div><span className="font-medium">PIB:</span> {companyDetails?.pib ?? "-"}</div>
          <div><span className="font-medium">MB:</span> {companyDetails?.mb ?? "-"}</div>
          <div><span className="font-medium">Adresa:</span> {companyDetails?.address ?? "-"}, {companyDetails?.city ?? ""}</div>
          <div><span className="font-medium">Šifra delatnosti:</span> {companyDetails?.activity_code ?? "-"}</div>
          <div><span className="font-medium">Poslovna godina:</span> {selectedYear?.year}</div>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48">
            <Label>Datum izveštaja</Label>
            <LocaleDateInput
              value={reportDate}
              onChange={(v) => setReportDate(v)}
              minDate={minDate}
              maxDate={maxDate}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TableScrollContainer className="max-h-[calc(100vh-380px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">AOP</TableHead>
                  <TableHead>Pozicija</TableHead>
                  <TableHead className="text-right w-36">Tekuća godina</TableHead>
                  <TableHead className="text-right w-36">Preth. god. - poč. stanje</TableHead>
                  <TableHead className="text-right w-36">Preth. god. - kr. stanje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.aop}
                    className={`
                      ${row.separator ? "border-t-2 border-foreground/20" : ""}
                      ${row.sectionHeader ? "bg-muted/50" : ""}
                    `}
                  >
                    <TableCell className="font-mono text-muted-foreground">{row.aop}</TableCell>
                    <TableCell
                      className={`${row.bold ? "font-bold" : ""}`}
                      style={{ paddingLeft: `${(row.indent || 0) * 20 + 16}px` }}
                    >
                      {row.label}
                    </TableCell>
                    <TableCell className={`text-right ${row.bold ? "font-bold" : ""}`}>
                      {formatPrice(row.currentYear)}
                    </TableCell>
                    <TableCell className={`text-right ${row.bold ? "font-bold" : ""}`}>
                      {row.prevYearOpening !== null ? formatPrice(row.prevYearOpening) : ""}
                    </TableCell>
                    <TableCell className={`text-right ${row.bold ? "font-bold" : ""}`}>
                      {row.prevYearClosing !== null ? formatPrice(row.prevYearClosing) : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScrollContainer>
        )}
      </div>
    </MainLayout>
  );
}
