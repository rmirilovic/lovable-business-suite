import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { FileSpreadsheet, FileText, Printer, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { useZakljucniList, type ZakljucniListLevel } from "@/hooks/useZakljucniList";
import { formatPrice } from "@/lib/formatting";
import {
  exportZakljucniListToExcel,
  exportZakljucniListToPdf,
  printZakljucniList,
} from "@/lib/zakljucniListExportUtils";
import { cn } from "@/lib/utils";

const LEVEL_OPTIONS: { value: ZakljucniListLevel; label: string }[] = [
  { value: "class", label: "Po klasama (1 cifra)" },
  { value: "two", label: "Dvocifrena konta" },
  { value: "three", label: "Trocifrena konta + dvocifrena (sa prometom)" },
  { value: "full", label: "Sva konta (sa prometom) + parent grupe" },
  { value: "analytics", label: "Sva konta + analitika" },
];

export default function ZakljucniList() {
  const { selectedYear, selectedCompany } = useAuth();
  const { minDate, maxDate } = useBusinessYearDateLimits();

  const yearStart = selectedYear?.year ? `${selectedYear.year}-01-01` : "";
  const yearEnd = selectedYear?.year ? `${selectedYear.year}-12-31` : "";

  const [dateFrom, setDateFrom] = useState<string>(yearStart);
  const [dateTo, setDateTo] = useState<string>(yearEnd);
  const [accountFrom, setAccountFrom] = useState("0");
  const [accountTo, setAccountTo] = useState("99999");
  const [level, setLevel] = useState<ZakljucniListLevel>("two");

  const { data: rows = [], isLoading } = useZakljucniList({
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    accountFrom,
    accountTo,
    level,
  });

  // For totals row: same logic as in export utils — sum only leaf rows when present
  const totals = useMemo(() => {
    const leafRows = rows.filter((r) => !r.is_aggregate);
    const target = leafRows.length > 0 ? leafRows : rows;
    return target.reduce(
      (acc, r) => ({
        opening_debit: acc.opening_debit + r.opening_debit,
        opening_credit: acc.opening_credit + r.opening_credit,
        period_debit: acc.period_debit + r.period_debit,
        period_credit: acc.period_credit + r.period_credit,
        total_debit: acc.total_debit + r.total_debit,
        total_credit: acc.total_credit + r.total_credit,
        balance: acc.balance + r.balance,
      }),
      {
        opening_debit: 0, opening_credit: 0,
        period_debit: 0, period_credit: 0,
        total_debit: 0, total_credit: 0, balance: 0,
      },
    );
  }, [rows]);

  const exportMeta = {
    companyName: selectedCompany?.name ?? "",
    dateFrom,
    dateTo,
    accountFrom,
    accountTo,
    yearLabel: selectedYear?.year?.toString() ?? "",
    level,
  };

  return (
    <MainLayout title="Zaključni list">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Zaključni list</h1>
            <p className="text-muted-foreground">
              Pregled stanja konta sa početnim, prometom i ukupnim saldom — do izabranog datuma u tekućoj godini
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportZakljucniListToExcel(rows, exportMeta)} disabled={rows.length === 0}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportZakljucniListToPdf(rows, exportMeta)} disabled={rows.length === 0}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printZakljucniList(rows, exportMeta)} disabled={rows.length === 0}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label>Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} minDate={minDate} maxDate={maxDate} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <Label>Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} minDate={minDate} maxDate={maxDate} className="w-[160px]" />
          </div>
          <div className="w-32 space-y-1">
            <Label>Konto od</Label>
            <Input value={accountFrom} onChange={(e) => setAccountFrom(e.target.value)} placeholder="0" />
          </div>
          <div className="w-32 space-y-1">
            <Label>Konto do</Label>
            <Input value={accountTo} onChange={(e) => setAccountTo(e.target.value)} placeholder="99999" />
          </div>
          <div className="w-[320px] space-y-1">
            <Label>Vrsta pregleda</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as ZakljucniListLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TableScrollContainer className="max-h-[calc(100vh-320px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Šifra konta</TableHead>
                  <TableHead>Opis konta</TableHead>
                  <TableHead className="text-right">Poč. duguje</TableHead>
                  <TableHead className="text-right">Poč. potražuje</TableHead>
                  <TableHead className="text-right">Promet duguje</TableHead>
                  <TableHead className="text-right">Promet potražuje</TableHead>
                  <TableHead className="text-right">Ukup. duguje</TableHead>
                  <TableHead className="text-right">Ukup. potražuje</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nema podataka za izabrane parametre
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, idx) => (
                    <TableRow
                      key={`${r.code}-${idx}`}
                      className={cn(r.is_aggregate && "bg-muted/40 font-medium")}
                    >
                      <TableCell className="font-mono">
                        <span style={{ paddingLeft: `${r.indent * 12}px` }}>{r.code}</span>
                      </TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPrice(r.opening_debit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPrice(r.opening_credit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPrice(r.period_debit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPrice(r.period_credit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPrice(r.total_debit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPrice(r.total_credit)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{formatPrice(r.balance)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {rows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-bold">UKUPNO</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatPrice(totals.opening_debit)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatPrice(totals.opening_credit)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatPrice(totals.period_debit)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatPrice(totals.period_credit)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatPrice(totals.total_debit)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatPrice(totals.total_credit)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatPrice(totals.balance)}</TableCell>
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
