import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { Globe } from "lucide-react";

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

  const { data: rows = [], isLoading } = useDevizniaKartica(partnerId || null, currency, dateFrom, dateTo);

  const totals = useMemo(() => {
    let dOrig = 0, cOrig = 0, dRsd = 0, cRsd = 0;
    rows.forEach((r) => { dOrig += r.debit_original; cOrig += r.credit_original; dRsd += r.debit_rsd; cRsd += r.credit_rsd; });
    return { dOrig, cOrig, dRsd, cRsd, saldoOrig: dOrig - cOrig, saldoRsd: dRsd - cRsd };
  }, [rows]);

  const partner = partners.find((p) => p.id === partnerId);

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
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          </CardContent>
        </Card>

        {partnerId && (
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">
                {partner?.name} — {currency}
              </CardTitle>
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
