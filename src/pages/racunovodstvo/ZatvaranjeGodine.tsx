import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2, XCircle, AlertTriangle, FileText, Calculator,
  ArrowRightCircle, Lock, Loader2, ListChecks, X,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type StepKey = "prerequisites" | "closing" | "opening" | "lock";

interface CheckItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

interface PrereqResult {
  year: number;
  date_from: string;
  date_to: string;
  checks: CheckItem[];
}

interface StockRow {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  qty: number;
  value: number;
}

const STEP_TITLES: Record<StepKey, string> = {
  prerequisites: "1. Pripremne provere",
  closing: "2. Zaključni listovi (31.12.)",
  opening: "3. Početno stanje (01.01. nove godine)",
  lock: "4. Zaključavanje godine",
};

export default function ZatvaranjeGodine() {
  const { selectedCompany, selectedYear } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<StepKey>("prerequisites");
  const [newYearId, setNewYearId] = useState<string>("");

  // Sve godine firme — za izbor naredne godine
  const { data: years = [] } = useQuery({
    queryKey: ["business-years-all", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_years")
        .select("id, year, is_closed, is_active")
        .eq("company_id", selectedCompany!.id)
        .order("year");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const candidateNewYears = useMemo(
    () => years.filter((y) => selectedYear?.year && y.year === selectedYear.year + 1),
    [years, selectedYear?.year]
  );

  // Provere preduslova
  const { data: prereq, isLoading: prereqLoading, refetch: refetchPrereq } = useQuery({
    queryKey: ["year-closing-prereq", selectedYear?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("validate_year_closing_prerequisites", {
        _year_id: selectedYear!.id,
      });
      if (error) throw error;
      return data as unknown as PrereqResult;
    },
    enabled: !!selectedYear?.id && step === "prerequisites",
  });

  // Audit log
  const { data: log = [] } = useQuery({
    queryKey: ["year-closing-log", selectedYear?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("year_closing_log")
        .select("*")
        .eq("business_year_id", selectedYear!.id)
        .order("executed_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedYear?.id,
  });

  const stepIsDone = (s: StepKey) => log.some((l: any) => {
    if (s === "closing") return ["closing_expenses", "closing_revenues", "closing_result"].includes(l.step);
    if (s === "opening") return l.step === "opening_balance";
    if (s === "lock") return l.step === "lock_year";
    return false;
  });

  // Mutacije
  const callRpc = (name: string, args: any, label: string) => async () => {
    const { data, error } = await supabase.rpc(name as any, args);
    if (error) throw new Error(`${label}: ${error.message}`);
    return data;
  };

  const expensesMut = useMutation({
    mutationFn: callRpc("generate_closing_entry_expenses", { _year_id: selectedYear?.id }, "ZL-1"),
    onSuccess: (id) => {
      toast.success("ZL-1 (Zatvaranje rashoda) generisan kao nacrt");
      queryClient.invalidateQueries({ queryKey: ["year-closing-log"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revenuesMut = useMutation({
    mutationFn: callRpc("generate_closing_entry_revenues", { _year_id: selectedYear?.id }, "ZL-2"),
    onSuccess: () => {
      toast.success("ZL-2 (Zatvaranje prihoda) generisan kao nacrt");
      queryClient.invalidateQueries({ queryKey: ["year-closing-log"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resultMut = useMutation({
    mutationFn: callRpc("generate_closing_entry_result", { _year_id: selectedYear?.id }, "ZL-3"),
    onSuccess: () => {
      toast.success("ZL-3 (Utvrđivanje rezultata) generisan kao nacrt");
      queryClient.invalidateQueries({ queryKey: ["year-closing-log"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openingMut = useMutation({
    mutationFn: async () => {
      if (!newYearId) throw new Error("Izaberite novu poslovnu godinu");
      const { data, error } = await supabase.rpc("generate_opening_balance", {
        _old_year_id: selectedYear!.id,
        _new_year_id: newYearId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("Početno stanje generisano u novoj godini (nacrt)");
      queryClient.invalidateQueries({ queryKey: ["year-closing-log"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lockMut = useMutation({
    mutationFn: callRpc("lock_business_year", { _year_id: selectedYear?.id }, "Zaključavanje"),
    onSuccess: () => {
      toast.success("Godina je zaključana");
      queryClient.invalidateQueries({ queryKey: ["year-closing-log"] });
      queryClient.invalidateQueries({ queryKey: ["business-years-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Pregled stanja magacina
  const { data: openingStock = [], isLoading: stockLoading } = useQuery({
    queryKey: ["opening-stock-preview", selectedYear?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_warehouse_opening_stock_preview", {
        _old_year_id: selectedYear!.id,
      });
      if (error) throw error;
      return (data || []) as StockRow[];
    },
    enabled: !!selectedYear?.id && step === "opening",
  });

  const stockByWarehouse = useMemo(() => {
    const m = new Map<string, { code: string; name: string; rows: StockRow[]; totalValue: number }>();
    for (const r of openingStock) {
      const k = r.warehouse_id;
      let g = m.get(k);
      if (!g) { g = { code: r.warehouse_code, name: r.warehouse_name, rows: [], totalValue: 0 }; m.set(k, g); }
      g.rows.push(r);
      g.totalValue += Number(r.value || 0);
    }
    return Array.from(m.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [openingStock]);

  if (!selectedCompany || !selectedYear) {
    return (
      <MainLayout title="Zatvaranje poslovne godine">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Izaberite firmu i poslovnu godinu.
        </div>
      </MainLayout>
    );
  }

  const currentYearMeta = years.find((y) => y.id === selectedYear.id);
  if (currentYearMeta?.is_closed) {
    return (
      <MainLayout title="Zatvaranje poslovne godine">
        <div className="p-6 max-w-2xl mx-auto">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>Godina {selectedYear.year} je već zaključana</AlertTitle>
            <AlertDescription>
              Otvaranje godine se vrši iz Administracije → Poslovne godine.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  const allChecksOk = prereq?.checks.every((c) => c.ok) ?? false;

  return (
    <MainLayout title="Zatvaranje poslovne godine">
      <div className="flex-1 min-h-0 overflow-auto space-y-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Zatvaranje poslovne godine {selectedYear.year}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Wizard u 4 koraka: provere → zaključni listovi → početno stanje → zaključavanje.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <X className="h-4 w-4 mr-1" /> Zatvori
          </Button>
        </div>

      {/* Stepper */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STEP_TITLES) as StepKey[]).map((s) => {
          const done = stepIsDone(s);
          const active = step === s;
          return (
            <Button
              key={s}
              variant={active ? "default" : done ? "secondary" : "outline"}
              size="sm"
              onClick={() => setStep(s)}
              className="gap-2"
            >
              {done && <CheckCircle2 className="h-4 w-4" />}
              {STEP_TITLES[s]}
            </Button>
          );
        })}
      </div>

      {/* KORAK 1 */}
      {step === "prerequisites" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5" />Pripremne provere</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {prereqLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Učitavanje provera…</div>}
            {prereq && (
              <div className="space-y-2">
                {prereq.checks.map((c) => (
                  <div key={c.key} className="flex items-start gap-3 p-3 rounded-md border">
                    {c.ok ? <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" /> : <XCircle className="h-5 w-5 text-destructive mt-0.5" />}
                    <div className="flex-1">
                      <div className="font-medium">{c.label}</div>
                      <div className="text-xs text-muted-foreground">{c.detail}</div>
                    </div>
                    <Badge variant={c.ok ? "default" : "destructive"}>{c.ok ? "OK" : "Nije OK"}</Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetchPrereq()}>Ponovo proveri</Button>
              <Button onClick={() => setStep("closing")} disabled={!allChecksOk}>
                Nastavi <ArrowRightCircle className="h-4 w-4 ml-1" />
              </Button>
              {!allChecksOk && (
                <Button variant="ghost" onClick={() => setStep("closing")}>
                  Preskoči (na sopstvenu odgovornost)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KORAK 2 */}
      {step === "closing" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Zaključni listovi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Generišu se TRI naloga sa datumom 31.12.{selectedYear.year} kao <strong>nacrti</strong>.
                Potom ih u Glavnoj knjizi pregledate i proknjižite. Redosled: ZL-1 → ZL-2 → ZL-3.
              </AlertDescription>
            </Alert>

            <div className="grid gap-3 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">ZL-1: Rashodi (5xx → 710)</CardTitle></CardHeader>
                <CardContent>
                  <Button onClick={() => expensesMut.mutate()} disabled={expensesMut.isPending} className="w-full">
                    {expensesMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Generiši ZL-1
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">ZL-2: Prihodi (6xx → 720)</CardTitle></CardHeader>
                <CardContent>
                  <Button onClick={() => revenuesMut.mutate()} disabled={revenuesMut.isPending} className="w-full">
                    {revenuesMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Generiši ZL-2
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">ZL-3: Rezultat (341/351)</CardTitle></CardHeader>
                <CardContent>
                  <Button onClick={() => resultMut.mutate()} disabled={resultMut.isPending} className="w-full">
                    {resultMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Generiši ZL-3
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => navigate("/racunovodstvo/glavna-knjiga")}>
                <FileText className="h-4 w-4 mr-1" /> Otvori Glavnu knjigu
              </Button>
              <Button onClick={() => setStep("opening")}>
                Nastavi <ArrowRightCircle className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KORAK 3 */}
      {step === "opening" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Početno stanje Glavne knjige</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  Generiše se nalog <strong>POČETNO STANJE</strong> sa datumom 01.01.{selectedYear.year + 1} u izabranoj novoj godini.
                  Konta klasa 20, 43, 15, 29 prenose se sa partner analitikom (otvorene stavke), ostala bilansna konta zbirno.
                  Klase 5, 6, 7 se ne prenose.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2 items-end flex-wrap">
                <div>
                  <label className="text-sm font-medium block mb-1">Nova poslovna godina</label>
                  <Select value={newYearId} onValueChange={setNewYearId}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder={`Godina ${selectedYear.year + 1}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {candidateNewYears.length === 0 && (
                        <div className="p-2 text-sm text-muted-foreground">
                          Kreirajte godinu {selectedYear.year + 1} u Administraciji.
                        </div>
                      )}
                      {candidateNewYears.map((y) => (
                        <SelectItem key={y.id} value={y.id}>{y.year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => openingMut.mutate()} disabled={openingMut.isPending || !newYearId}>
                  {openingMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Generiši Početno stanje GK
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pregled početnog stanja magacina (na 31.12.{selectedYear.year})</CardTitle>
            </CardHeader>
            <CardContent>
              {stockLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Učitavanje…</div>
              ) : stockByWarehouse.length === 0 ? (
                <div className="text-muted-foreground">Nema artikala sa stanjem.</div>
              ) : (
                <div className="space-y-6">
                  {stockByWarehouse.map((w) => (
                    <div key={w.code}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">Magacin {w.code} — {w.name}</h3>
                        <Badge variant="secondary">Vrednost: {w.totalValue.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</Badge>
                      </div>
                      <TableScrollContainer>
                        <Table className="min-w-[600px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Šifra</TableHead>
                              <TableHead>Naziv</TableHead>
                              <TableHead>JM</TableHead>
                              <TableHead className="text-right">Količina</TableHead>
                              <TableHead className="text-right">Vrednost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {w.rows.map((r) => (
                              <TableRow key={r.article_id}>
                                <TableCell className="font-mono text-xs">{r.article_code}</TableCell>
                                <TableCell>{r.article_name}</TableCell>
                                <TableCell>{r.unit}</TableCell>
                                <TableCell className="text-right font-mono">{Number(r.qty).toLocaleString("sr-RS", { minimumFractionDigits: 3 })}</TableCell>
                                <TableCell className="text-right font-mono">{Number(r.value).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableScrollContainer>
                    </div>
                  ))}
                </div>
              )}
              <Alert className="mt-4">
                <AlertDescription>
                  Stanje magacina se računovodstveno prenosi kroz <strong>Početno stanje GK</strong> (klasa 1).
                  Količinsko stanje po artiklima je dostupno u izveštaju „Stanje magacina" za novu godinu (računa se dinamički iz dokumenata).
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={() => setStep("lock")}>
              Nastavi na zaključavanje <ArrowRightCircle className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* KORAK 4 */}
      {step === "lock" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Zaključavanje godine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Pažnja</AlertTitle>
              <AlertDescription>
                Zaključavanjem godine {selectedYear.year} onemogućavate izmene postojećih i unos novih dokumenata.
                Otključavanje je moguće (lokalni admin / super admin) iz Administracije → Poslovne godine.
                Posle bilo kakvih izmena potrebno je <strong>regenerisati zaključne naloge i početno stanje</strong>.
              </AlertDescription>
            </Alert>
            <Button variant="destructive" onClick={() => lockMut.mutate()} disabled={lockMut.isPending}>
              {lockMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Zaključaj godinu {selectedYear.year}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Audit log */}
      {log.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dnevnik izvršenih akcija</CardTitle>
          </CardHeader>
          <CardContent>
            <TableScrollContainer>
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Vreme</TableHead>
                    <TableHead>Korak</TableHead>
                    <TableHead>Detalji</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {log.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{new Date(l.executed_at).toLocaleString("sr-RS")}</TableCell>
                      <TableCell>{l.step}</TableCell>
                      <TableCell className="font-mono text-xs">{JSON.stringify(l.result)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScrollContainer>
          </CardContent>
        </Card>
      )}
      </div>
    </MainLayout>
  );
}
