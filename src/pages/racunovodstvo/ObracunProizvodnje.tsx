import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet, FileText, Printer, Loader2, Filter, BookOpen, Search,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useProductionCostReport } from "@/hooks/useProductionCostReport";
import { useProductionCostJournal } from "@/hooks/useProductionCostJournal";
import { formatPrice } from "@/lib/formatting";
import {
  exportProductionCostToExcel,
  exportProductionCostPdf,
  printProductionCost,
  ProductionCostExportRow,
} from "@/lib/productionCostExportUtils";

interface AggRow extends ProductionCostExportRow {}

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

export default function ObracunProizvodnje() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const { units } = useOrganizationalUnits(selectedCompany?.id);
  const { data: accounts = [] } = useChartOfAccounts();

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(lastOfMonth);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<{
    dateFrom: string; dateTo: string; orgUnitCodes?: string[];
  } | null>(null);

  const [showJournalDialog, setShowJournalDialog] = useState(false);
  const [wipAccount, setWipAccount] = useState("950");
  const [journalDescription, setJournalDescription] = useState("");

  const { data: rawItems = [], isLoading } = useProductionCostReport(appliedFilters);
  const journalMutation = useProductionCostJournal();

  const activeUnits = useMemo(() => units.filter((u) => u.is_active), [units]);

  // Agregacija po MT + konto sa razdvajanjem materijal/rad
  const rows: AggRow[] = useMemo(() => {
    const orgMap = new Map(units.map((u) => [u.code, u.name]));
    const accMap = new Map(accounts.map((a) => [a.code, a.name]));

    const map = new Map<string, AggRow>();

    for (const item of rawItems) {
      const cc = item.cost_center_code;
      if (!cc) continue;
      const accCode = item.account_code;
      const amount = Number(item.debit_amount) - Number(item.credit_amount);
      if (amount === 0) continue;

      const key = `${cc}|${accCode}`;
      let row = map.get(key);
      if (!row) {
        row = {
          orgUnitCode: cc,
          orgUnitName: orgMap.get(cc) || cc,
          accountCode: accCode,
          accountName: accMap.get(accCode) || "",
          materialAmount: 0,
          laborAmount: 0,
          otherDirectAmount: 0,
          total: 0,
        };
        map.set(key, row);
      }

      if (accCode.startsWith("51")) row.materialAmount += amount;
      else if (accCode.startsWith("52")) row.laborAmount += amount;
      else row.otherDirectAmount += amount;

      row.total += amount;
    }

    const out = Array.from(map.values()).filter((r) => r.total !== 0);
    out.sort((a, b) => {
      const cmp = a.orgUnitCode.localeCompare(b.orgUnitCode);
      if (cmp !== 0) return cmp;
      return a.accountCode.localeCompare(b.accountCode);
    });
    return out;
  }, [rawItems, units, accounts]);

  // Sumarni prikaz po MT
  const summaryByMT = useMemo(() => {
    const map = new Map<string, { code: string; name: string; mat: number; lab: number; oth: number; tot: number }>();
    for (const r of rows) {
      let s = map.get(r.orgUnitCode);
      if (!s) {
        s = { code: r.orgUnitCode, name: r.orgUnitName, mat: 0, lab: 0, oth: 0, tot: 0 };
        map.set(r.orgUnitCode, s);
      }
      s.mat += r.materialAmount;
      s.lab += r.laborAmount;
      s.oth += r.otherDirectAmount;
      s.tot += r.total;
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [rows]);

  const totals = useMemo(() => ({
    mat: rows.reduce((s, r) => s + r.materialAmount, 0),
    lab: rows.reduce((s, r) => s + r.laborAmount, 0),
    oth: rows.reduce((s, r) => s + r.otherDirectAmount, 0),
    tot: rows.reduce((s, r) => s + r.total, 0),
  }), [rows]);

  const handleApply = () => {
    if (!dateFrom || !dateTo) return;
    setAppliedFilters({
      dateFrom,
      dateTo,
      orgUnitCodes: selectedUnits.length > 0 ? selectedUnits : undefined,
    });
  };

  const toggleUnit = (code: string) => {
    setSelectedUnits((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const exportMeta = {
    companyName: selectedCompany?.name ?? "",
    dateFrom,
    dateTo,
  };

  const wipAccounts = useMemo(
    () => accounts.filter((a) => a.is_posting_allowed && (a.code.startsWith("95") || a.code.startsWith("96"))),
    [accounts]
  );

  const handleCreateJournal = async () => {
    if (!wipAccount || rows.length === 0) return;
    const lines = rows
      .filter((r) => r.total !== 0)
      .map((r) => ({
        orgUnitCode: r.orgUnitCode,
        accountCode: r.accountCode,
        accountName: r.accountName,
        amount: r.total,
      }));

    try {
      const entry = await journalMutation.mutateAsync({
        dateFrom,
        dateTo,
        description: journalDescription || `Obračun troškova proizvodnje ${dateFrom} - ${dateTo}`,
        lines,
        workInProgressAccount: wipAccount,
      });
      setShowJournalDialog(false);
      navigate(`/racunovodstvo/nalozi/${entry.id}`);
    } catch {
      // toast već prikazan
    }
  };

  return (
    <MainLayout title="Obračun troškova proizvodnje">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Obračun troškova proizvodnje</h1>
            <p className="text-muted-foreground">
              Periodični obračun direktnih troškova (materijal i rad) po mestima troškova
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={() => exportProductionCostToExcel(rows, exportMeta)}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={() => exportProductionCostPdf(rows, exportMeta)}
            >
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={() => printProductionCost(rows, exportMeta)}
            >
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
            <Button
              size="sm"
              disabled={rows.length === 0}
              onClick={() => {
                setJournalDescription(`Obračun troškova proizvodnje ${dateFrom} - ${dateTo}`);
                setShowJournalDialog(true);
              }}
            >
              <BookOpen className="w-4 h-4 mr-2" /> Predlog naloga GK
            </Button>
          </div>
        </div>

        {/* Filteri */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filteri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="w-44">
                <Label>Datum od</Label>
                <LocaleDateInput value={dateFrom} onChange={(v) => setDateFrom(v)} />
              </div>
              <div className="w-44">
                <Label>Datum do</Label>
                <LocaleDateInput value={dateTo} onChange={(v) => setDateTo(v)} />
              </div>
              <div className="w-72">
                <Label>Mesta troškova</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                      {selectedUnits.length === 0
                        ? "Sva proizvodna MT"
                        : `Izabrano: ${selectedUnits.length}`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 max-h-80 overflow-y-auto" align="start">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Izaberite MT</span>
                      {selectedUnits.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setSelectedUnits([])}>
                          Poništi
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {activeUnits.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nema aktivnih MT</p>
                      ) : (
                        activeUnits.map((u) => (
                          <label
                            key={u.id}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedUnits.includes(u.code)}
                              onCheckedChange={() => toggleUnit(u.code)}
                            />
                            <span className="text-sm font-mono">{u.code}</span>
                            <span className="text-sm text-muted-foreground truncate">{u.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleApply}>
                <Search className="w-4 h-4 mr-2" /> Prikaži
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Obračun obuhvata samo proknjižene naloge sa kontima klase 51 (materijal) i 52 (zarade).
              Bez raspodele režije.
            </p>
          </CardContent>
        </Card>

        {/* Sažetak */}
        {appliedFilters && rows.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Materijal (51x)</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatPrice(totals.mat)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Rad (52x)</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatPrice(totals.lab)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ostali direktni</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatPrice(totals.oth)}</div></CardContent>
            </Card>
            <Card className="border-primary">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">UKUPNO</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{formatPrice(totals.tot)}</div></CardContent>
            </Card>
          </div>
        )}

        {/* Sažetak po MT */}
        {appliedFilters && summaryByMT.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sumarno po mestu troška</CardTitle>
            </CardHeader>
            <CardContent>
              <TableScrollContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[80px]">Šifra MT</TableHead>
                      <TableHead className="min-w-[200px]">Naziv MT</TableHead>
                      <TableHead className="text-right min-w-[140px]">Materijal</TableHead>
                      <TableHead className="text-right min-w-[140px]">Rad</TableHead>
                      <TableHead className="text-right min-w-[140px]">Ostali direktni</TableHead>
                      <TableHead className="text-right min-w-[140px] font-bold">UKUPNO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryByMT.map((s) => (
                      <TableRow key={s.code}>
                        <TableCell className="font-mono">{s.code}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell className="text-right">{s.mat !== 0 ? formatPrice(s.mat) : "-"}</TableCell>
                        <TableCell className="text-right">{s.lab !== 0 ? formatPrice(s.lab) : "-"}</TableCell>
                        <TableCell className="text-right">{s.oth !== 0 ? formatPrice(s.oth) : "-"}</TableCell>
                        <TableCell className="text-right font-bold">{formatPrice(s.tot)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="font-bold">Ukupno</TableCell>
                      <TableCell className="text-right font-bold">{formatPrice(totals.mat)}</TableCell>
                      <TableCell className="text-right font-bold">{formatPrice(totals.lab)}</TableCell>
                      <TableCell className="text-right font-bold">{formatPrice(totals.oth)}</TableCell>
                      <TableCell className="text-right font-bold">{formatPrice(totals.tot)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableScrollContainer>
            </CardContent>
          </Card>
        )}

        {/* Detaljni prikaz */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detaljno po MT i kontu</CardTitle>
          </CardHeader>
          <CardContent>
            {!appliedFilters ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Izaberite period i kliknite "Prikaži" za obračun.
              </p>
            ) : isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nema proknjiženih troškova proizvodnje za izabrani period.
              </p>
            ) : (
              <TableScrollContainer className="max-h-[calc(100vh-400px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[80px]">Šifra MT</TableHead>
                      <TableHead className="min-w-[160px]">Naziv MT</TableHead>
                      <TableHead className="min-w-[80px]">Konto</TableHead>
                      <TableHead className="min-w-[180px]">Opis konta</TableHead>
                      <TableHead className="text-right min-w-[130px]">Materijal</TableHead>
                      <TableHead className="text-right min-w-[130px]">Rad</TableHead>
                      <TableHead className="text-right min-w-[130px]">Ostali direktni</TableHead>
                      <TableHead className="text-right min-w-[130px] font-bold">UKUPNO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono">{r.orgUnitCode}</TableCell>
                        <TableCell>{r.orgUnitName}</TableCell>
                        <TableCell className="font-mono">{r.accountCode}</TableCell>
                        <TableCell>{r.accountName}</TableCell>
                        <TableCell className="text-right">{r.materialAmount !== 0 ? formatPrice(r.materialAmount) : "-"}</TableCell>
                        <TableCell className="text-right">{r.laborAmount !== 0 ? formatPrice(r.laborAmount) : "-"}</TableCell>
                        <TableCell className="text-right">{r.otherDirectAmount !== 0 ? formatPrice(r.otherDirectAmount) : "-"}</TableCell>
                        <TableCell className="text-right font-medium">{formatPrice(r.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-bold">Ukupno ({rows.length})</TableCell>
                      <TableCell className="text-right font-bold">{formatPrice(totals.mat)}</TableCell>
                      <TableCell className="text-right font-bold">{formatPrice(totals.lab)}</TableCell>
                      <TableCell className="text-right font-bold">{formatPrice(totals.oth)}</TableCell>
                      <TableCell className="text-right font-bold">{formatPrice(totals.tot)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableScrollContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dijalog za predlog naloga */}
      <AlertDialog open={showJournalDialog} onOpenChange={setShowJournalDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Predlog naloga za knjiženje</AlertDialogTitle>
            <AlertDialogDescription>
              Kreira se DRAFT nalog koji prebacuje akumulirane direktne troškove sa konta klase 5
              na konto Proizvodnje u toku. Nalog ostaje u statusu nacrta — finalizujte ga ručno
              iz editora kada proverite stavke.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Konto Proizvodnje u toku (klasa 9)</Label>
              <Select value={wipAccount} onValueChange={setWipAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite konto" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {wipAccounts.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      Nema dostupnih konta klase 9 u kontnom planu
                    </div>
                  ) : (
                    wipAccounts.map((a) => (
                      <SelectItem key={a.code} value={a.code}>
                        {a.code} - {a.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Opis naloga</Label>
              <Input
                value={journalDescription}
                onChange={(e) => setJournalDescription(e.target.value)}
                placeholder="Opis"
              />
            </div>

            <div className="rounded-md border p-3 bg-muted/40 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period:</span>
                <span className="font-medium">{dateFrom} → {dateTo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Broj stavki:</span>
                <span className="font-medium">{rows.length} ({rows.length * 2} reda u nalogu)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ukupan iznos:</span>
                <span className="font-bold">{formatPrice(totals.tot)}</span>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={journalMutation.isPending}>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleCreateJournal(); }}
              disabled={!wipAccount || journalMutation.isPending}
            >
              {journalMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Kreiranje...</>
              ) : "Kreiraj predlog"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
