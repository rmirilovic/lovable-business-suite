import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { usePartners } from "@/hooks/usePartners";
import { useDevizniaKartica } from "@/hooks/useDevizniaKartica";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/lib/formatting";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { toast } from "sonner";
import { Globe, TrendingUp, TrendingDown, Scale, FileDown, FileSpreadsheet, Columns3 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DOC_TYPE_LABEL: Record<string, string> = {
  invoice: "Faktura",
  payment: "Uplata",
  fx_gain: "Pozitivna kursna razlika",
  fx_loss: "Negativna kursna razlika",
};

type ExportColKey = "date" | "doc" | "type" | "description" | "rate" | "debit_orig" | "credit_orig" | "debit_rsd" | "credit_rsd";
const EXPORT_COLS: { key: ExportColKey; label: (cur: string) => string }[] = [
  { key: "date", label: () => "Datum" },
  { key: "doc", label: () => "Dokument" },
  { key: "type", label: () => "Tip" },
  { key: "description", label: () => "Opis" },
  { key: "rate", label: () => "Kurs" },
  { key: "debit_orig", label: (c) => `Duguje (${c})` },
  { key: "credit_orig", label: (c) => `Potražuje (${c})` },
  { key: "debit_rsd", label: () => "Duguje (RSD)" },
  { key: "credit_rsd", label: () => "Potražuje (RSD)" },
];
const DEFAULT_EXPORT_COLS: ExportColKey[] = EXPORT_COLS.map((c) => c.key);

const CURRENCIES = ["EUR", "USD", "CHF", "GBP"];

export default function DeviznaKartica() {
  const { selectedYear } = useAuth();
  const { partners = [] } = usePartners();

  const yearStart = selectedYear
    ? `${selectedYear.year}-01-01`
    : `${new Date().getFullYear()}-01-01`;
  const today = format(new Date(), "yyyy-MM-dd");

  const [partnerId, setPartnerId] = useState<string>("");
  const [currency, setCurrency] = useState<string>("EUR");
  const [dateFrom, setDateFrom] = useState<string>(yearStart);
  const [dateTo, setDateTo] = useState<string>(today);
  const [rateMin, setRateMin] = useState<string>("");
  const [rateMax, setRateMax] = useState<string>("");
  const [onlyFx, setOnlyFx] = useState<boolean>(false);
  const [exportCols, setExportCols] = useState<ExportColKey[]>(() => {
    try {
      const saved = localStorage.getItem("devizna-kartica-export-cols");
      if (saved) {
        const arr = JSON.parse(saved) as ExportColKey[];
        if (Array.isArray(arr) && arr.length > 0) return arr;
      }
    } catch {}
    return DEFAULT_EXPORT_COLS;
  });

  const toggleExportCol = (key: ExportColKey, checked: boolean) => {
    setExportCols((prev) => {
      const next = checked ? [...new Set([...prev, key])] : prev.filter((k) => k !== key);
      // Sačuvaj redosled po EXPORT_COLS
      const ordered = EXPORT_COLS.map((c) => c.key).filter((k) => next.includes(k));
      try { localStorage.setItem("devizna-kartica-export-cols", JSON.stringify(ordered)); } catch {}
      return ordered;
    });
  };

  const { data: allRows = [], isLoading } = useDevizniaKartica(partnerId || null, currency, dateFrom, dateTo);

  const rows = useMemo(() => {
    const min = rateMin ? Number(rateMin.replace(",", ".")) : null;
    const max = rateMax ? Number(rateMax.replace(",", ".")) : null;
    return allRows.filter((r) => {
      if (onlyFx && r.doc_type !== "fx_gain" && r.doc_type !== "fx_loss") return false;
      // Kurs filter primeniti samo na redove sa kursom (faktura/uplata)
      if ((min !== null || max !== null) && r.exchange_rate > 0) {
        if (min !== null && r.exchange_rate < min) return false;
        if (max !== null && r.exchange_rate > max) return false;
      }
      return true;
    });
  }, [allRows, onlyFx, rateMin, rateMax]);

  const totals = useMemo(() => {
    let dOrig = 0, cOrig = 0, dRsd = 0, cRsd = 0;
    let fxGain = 0, fxLoss = 0;
    rows.forEach((r) => {
      dOrig += r.debit_original; cOrig += r.credit_original;
      dRsd += r.debit_rsd; cRsd += r.credit_rsd;
      if (r.doc_type === "fx_gain") fxGain += r.debit_rsd;
      if (r.doc_type === "fx_loss") fxLoss += r.credit_rsd;
    });
    return { dOrig, cOrig, dRsd, cRsd, saldoOrig: dOrig - cOrig, saldoRsd: dRsd - cRsd, fxGain, fxLoss, fxNet: fxGain - fxLoss };
  }, [rows]);

  const partner = partners.find((p) => p.id === partnerId);

  const buildExportRows = () => {
    const activeCols = EXPORT_COLS.filter((c) => exportCols.includes(c.key));
    return rows.map((r) => {
      const obj: Record<string, any> = {};
      for (const c of activeCols) {
        const label = c.label(currency);
        switch (c.key) {
          case "date": obj[label] = format(new Date(r.date), "dd.MM.yyyy"); break;
          case "doc": obj[label] = r.doc_number; break;
          case "type": obj[label] = DOC_TYPE_LABEL[r.doc_type] ?? r.doc_type; break;
          case "description": obj[label] = r.description; break;
          case "rate": obj[label] = r.exchange_rate > 0 ? r.exchange_rate : null; break;
          case "debit_orig": obj[label] = r.debit_original || null; break;
          case "credit_orig": obj[label] = r.credit_original || null; break;
          case "debit_rsd": obj[label] = r.debit_rsd || null; break;
          case "credit_rsd": obj[label] = r.credit_rsd || null; break;
        }
      }
      return obj;
    });
  };

  const fileBase = () => {
    const p = partner ? `${partner.code}_${partner.name}`.replace(/[^\w\-]+/g, "_") : "kartica";
    return `devizna_kartica_${p}_${currency}_${dateFrom}_${dateTo}${onlyFx ? "_KR" : ""}`;
  };

  const handleExportCsv = () => {
    if (rows.length === 0) { toast.error("Nema stavki za izvoz"); return; }
    if (exportCols.length === 0) { toast.error("Izaberite bar jednu kolonu za izvoz"); return; }
    const data = buildExportRows();
    const headers = Object.keys(data[0] ?? {});
    const esc = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",;\n]/.test(s) ? `"${s}"` : s;
    };
    const csv = [headers.join(";"), ...data.map((row) => headers.map((h) => esc((row as any)[h])).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${fileBase()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Izvezeno ${rows.length} stavki u CSV`);
  };

  const handleExportXlsx = () => {
    if (rows.length === 0) { toast.error("Nema stavki za izvoz"); return; }
    if (exportCols.length === 0) { toast.error("Izaberite bar jednu kolonu za izvoz"); return; }
    const data = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(data);
    // Sažetak na dnu
    const lastRow = data.length + 2;
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      [`Ukupno duguje (${currency})`, totals.dOrig, `Ukupno duguje (RSD)`, totals.dRsd],
      [`Ukupno potražuje (${currency})`, totals.cOrig, `Ukupno potražuje (RSD)`, totals.cRsd],
      [`Saldo (${currency})`, totals.saldoOrig, `Saldo (RSD)`, totals.saldoRsd],
      ["Pozitivne kursne razlike (662)", totals.fxGain],
      ["Negativne kursne razlike (552)", totals.fxLoss],
      ["Neto efekat kursa", totals.fxNet],
    ], { origin: `A${lastRow}` });
    ws["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 24 }, { wch: 40 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Devizna kartica");
    XLSX.writeFile(wb, `${fileBase()}.xlsx`);
    toast.success(`Izvezeno ${rows.length} stavki u Excel`);
  };

  return (
    <MainLayout title="Devizna kartica">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-8 w-8" />
            Devizna kartica partnera
          </h1>
          <p className="text-muted-foreground">Pregled deviznih faktura i uplata po partneru i valuti</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Filteri</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Partner</Label>
                <SearchablePartnerSelect
                  partners={partners as any}
                  value={partnerId}
                  onValueChange={setPartnerId}
                  placeholder="Izaberi partnera..."
                />
              </div>
              <div>
                <Label>Valuta</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Datum od</Label>
                <LocaleDateInput value={dateFrom} onChange={setDateFrom} />
              </div>
              <div>
                <Label>Datum do</Label>
                <LocaleDateInput value={dateTo} onChange={setDateTo} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Kurs od</Label>
                <Input
                  inputMode="decimal"
                  placeholder="npr. 117,00"
                  value={rateMin}
                  onChange={(e) => setRateMin(e.target.value)}
                />
              </div>
              <div>
                <Label>Kurs do</Label>
                <Input
                  inputMode="decimal"
                  placeholder="npr. 118,50"
                  value={rateMax}
                  onChange={(e) => setRateMax(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={onlyFx} onCheckedChange={(v) => setOnlyFx(!!v)} />
                  <span className="text-sm">Prikaži samo kursne razlike</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {partnerId && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pozitivne kursne razlike (662)</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatNumber(totals.fxGain, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-500" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Negativne kursne razlike (552)</p>
                  <p className="text-2xl font-bold text-rose-600">{formatNumber(totals.fxLoss, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD</p>
                </div>
                <TrendingDown className="h-8 w-8 text-rose-500" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Neto efekat kursa za period</p>
                  <p className={`text-2xl font-bold ${totals.fxNet >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatNumber(totals.fxNet, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD
                  </p>
                </div>
                <Scale className="h-8 w-8 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        )}

        {partnerId && (
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <CardTitle className="text-base">
                {partner?.name} — {currency}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Columns3 className="h-4 w-4 mr-2" />
                      Kolone ({exportCols.length}/{EXPORT_COLS.length})
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="end">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Kolone za izvoz</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => { setExportCols(DEFAULT_EXPORT_COLS); try { localStorage.setItem("devizna-kartica-export-cols", JSON.stringify(DEFAULT_EXPORT_COLS)); } catch {} }}
                        >Sve</button>
                        <span className="text-xs text-muted-foreground">/</span>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => { setExportCols([]); try { localStorage.setItem("devizna-kartica-export-cols", JSON.stringify([])); } catch {} }}
                        >Nijedna</button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-auto">
                      {EXPORT_COLS.map((c) => (
                        <label key={c.key} className="flex items-center gap-2 cursor-pointer text-sm">
                          <Checkbox
                            checked={exportCols.includes(c.key)}
                            onCheckedChange={(v) => toggleExportCol(c.key, !!v)}
                          />
                          <span>{c.label(currency)}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={rows.length === 0 || exportCols.length === 0}>
                  <FileDown className="h-4 w-4 mr-2" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={rows.length === 0 || exportCols.length === 0}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Datum</TableHead>
                    <TableHead className="w-[140px]">Dokument</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead className="w-[80px] text-right">Kurs</TableHead>
                    <TableHead className="w-[120px] text-right">Duguje ({currency})</TableHead>
                    <TableHead className="w-[120px] text-right">Potraž. ({currency})</TableHead>
                    <TableHead className="w-[120px] text-right">Duguje (RSD)</TableHead>
                    <TableHead className="w-[120px] text-right">Potraž. (RSD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Učitavanje...</TableCell></TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Nema stavki za izabrane parametre</TableCell></TableRow>
                  ) : rows.map((r, i) => {
                    const isFx = r.doc_type === "fx_gain" || r.doc_type === "fx_loss";
                    return (
                    <TableRow key={i} className={isFx ? "bg-muted/40" : undefined}>
                      <TableCell>{format(new Date(r.date), "dd.MM.yyyy.", { locale: sr })}</TableCell>
                      <TableCell className="font-mono text-xs">{r.doc_number}</TableCell>
                      <TableCell className={isFx ? "italic text-muted-foreground" : undefined}>{r.description}</TableCell>
                      <TableCell className="text-right font-mono">{isFx ? "" : formatNumber(r.exchange_rate, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}</TableCell>
                      <TableCell className="text-right font-mono">{r.debit_original > 0 ? formatNumber(r.debit_original, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</TableCell>
                      <TableCell className="text-right font-mono">{r.credit_original > 0 ? formatNumber(r.credit_original, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{r.debit_rsd > 0 ? formatNumber(r.debit_rsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{r.credit_rsd > 0 ? formatNumber(r.credit_rsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
                {rows.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-medium">Ukupno:</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatNumber(totals.dOrig, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatNumber(totals.cOrig, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatNumber(totals.dRsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatNumber(totals.cRsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-medium">Saldo:</TableCell>
                      <TableCell colSpan={2} className="text-right font-mono font-bold">{formatNumber(totals.saldoOrig, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</TableCell>
                      <TableCell colSpan={2} className="text-right font-mono font-bold">{formatNumber(totals.saldoRsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
