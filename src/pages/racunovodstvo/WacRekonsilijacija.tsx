import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertTriangle, Calculator, CheckCircle2, FileText, Loader2,
  PlayCircle, RotateCcw, Search, ExternalLink, HelpCircle, Info,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useWacReconciliationRuns,
  useWacReconciliationChanges,
  useWacReconciliationMutations,
  WAC_STATUS_COLORS,
  WAC_STATUS_LABELS,
  WAC_TRIGGER_LABELS,
  type WacReconRun,
} from "@/hooks/useWacReconciliation";

const fmtNumber = (n: number, decimals = 2) =>
  new Intl.NumberFormat("sr-Latn-RS", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n ?? 0);

const fmtDate = (s: string | null) => (s ? format(new Date(s), "dd.MM.yyyy") : "-");
const fmtDateTime = (s: string | null) =>
  s ? format(new Date(s), "dd.MM.yyyy HH:mm") : "-";

const DOC_TYPE_LABELS: Record<string, string> = {
  delivery_note: "Otpremnica",
  material_requisition: "Trebovanje",
  inter_warehouse_transfer_out: "MMP - izlaz",
  inter_warehouse_transfer_in: "MMP - ulaz",
  production_delivery_note: "Predajnica GP",
  reprocessing_delivery_note: "Predajnica RPR",
  inventory_count: "Popis",
  article_swap: "Zamena artikla",
  customs_clearance: "Carinski obračun",
};

const TRIGGER_SOURCE_LABELS: Record<string, string> = {
  goods_receipt: "Prijemnica",
  calculation: "Kalkulacija",
  price_adjustment: "Nivelacija",
  customs_clearance: "Carinski obračun",
  inventory_count: "Popis",
  inter_warehouse_transfer_in: "MMP - ulaz",
  production_delivery_note: "Predajnica GP",
  reprocessing_delivery_note: "Predajnica RPR",
};

export default function WacRekonsilijacija() {
  const { selectedCompany, isSuperAdmin, isLocalAdmin } = useAuth();
  const navigate = useNavigate();
  const canManage = isSuperAdmin || isLocalAdmin;

  const [warehouseId, setWarehouseId] = useState<string>("");
  const [articleId, setArticleId] = useState<string>("__all__");
  const [fromDate, setFromDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [overridePdv, setOverridePdv] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-for-wac", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, code, name")
        .eq("company_id", selectedCompany!.id)
        .order("code");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: articles = [] } = useQuery({
    queryKey: ["articles-for-wac", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, code, name")
        .eq("company_id", selectedCompany!.id)
        .eq("is_active", true)
        .order("code")
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: runs = [], isLoading: runsLoading } = useWacReconciliationRuns();
  const { data: changes = [], isLoading: changesLoading } =
    useWacReconciliationChanges(selectedRunId);
  const { detect, preview, apply, revert } = useWacReconciliationMutations();

  const selectedRun: WacReconRun | undefined = useMemo(
    () => runs.find((r) => r.id === selectedRunId),
    [runs, selectedRunId]
  );

  const warehouseName = (id: string | null) =>
    id ? warehouses.find((w) => w.id === id)?.code + " - " + warehouses.find((w) => w.id === id)?.name : "-";

  const handleDetect = async () => {
    if (!warehouseId) return;
    const id = await detect.mutateAsync({
      warehouse_id: warehouseId,
      article_id: articleId === "__all__" ? null : articleId,
      from_date: fromDate || null,
      notes: notes || null,
    });
    if (id) setSelectedRunId(id);
  };

  const handlePreview = async () => {
    if (!selectedRunId) return;
    await preview.mutateAsync(selectedRunId);
  };

  const handleApply = async () => {
    if (!selectedRunId) return;
    await apply.mutateAsync({
      runId: selectedRunId,
      overridePdv,
      overrideReason: overridePdv ? overrideReason || null : null,
    });
  };

  const handleRevert = async () => {
    if (!selectedRunId) return;
    if (!confirm("Da li ste sigurni da želite da poništite ovo usklađivanje PNC? Cene će biti vraćene na prethodne vrednosti, a nalog ispravke u GK će biti storniran.")) return;
    await revert.mutateAsync({ runId: selectedRunId, reason: "Ručni revert iz UI" });
  };

  const totalDiff = useMemo(
    () => changes.reduce((s, c) => s + Number(c.cost_difference || 0), 0),
    [changes]
  );

  return (
    <MainLayout title="Usklađivanje PNC (Prosečna Nabavna Cena)">
      <div className="flex flex-col gap-4 h-full min-h-0 overflow-auto">
        {!canManage && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Pristup ograničen</AlertTitle>
            <AlertDescription>
              Samo administratori mogu pokretati i primeniti usklađivanje PNC. Možete pregledati postojeće zapise.
            </AlertDescription>
          </Alert>
        )}

        {/* In-app dokumentacija */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" />
              Pomoć: Šta je usklađivanje PNC i kada se koristi?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="what">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Šta radi ovaj servis?
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2 text-muted-foreground">
                  <p>
                    Servis preračunava <strong>prosečne nabavne cene (PNC)</strong> magacina
                    od izabranog datuma i ažurira sve naknadne izlazne dokumente
                    (otpremnice, trebovanja, MMP, predajnice, popisi, zamene).
                  </p>
                  <p>
                    Sve nastale razlike se knjiže kao <strong>jedan zbirni nalog ispravke</strong> u
                    Glavnoj knjizi (klase 13xx i 50xx). PDV obračun se <strong>ne menja</strong>.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="when-auto">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Kada sistem automatski kreira nacrt?
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2 text-muted-foreground">
                  <p>Nacrt se kreira automatski kada se proknjiži <strong>retroaktivni</strong> dokument koji menja stanje magacina:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Prijemnica, Kalkulacija ili Nivelacija sa ranijim datumom</li>
                    <li>Carinski obračun (uvoz)</li>
                    <li>Popis koji koriguje stanje</li>
                    <li>MMP – ulaz na destinacijski magacin</li>
                    <li>Predajnica GP ili Predajnica iz prerade</li>
                  </ul>
                  <p>
                    Pored toga, svake noći u <strong>02:30h</strong> radi integritetni check
                    i flaguje neslaganja koja sistem nije sam uhvatio.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="workflow">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Kako da koristim stranicu (3 koraka)?
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2 text-muted-foreground">
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>
                      <strong>Inicijalizuj</strong> — izaberi magacin (i opciono artikal/datum) ili klikni na postojeći
                      <Badge variant="outline" className="mx-1">Nacrt</Badge> u tabeli ispod.
                    </li>
                    <li>
                      <strong>Generiši pregled</strong> — sistem računa stare i nove cene po dokumentu i prikazuje razlike.
                      Ovaj korak <em>ne menja</em> podatke u bazi.
                    </li>
                    <li>
                      <strong>Primeni</strong> — kada potvrdiš da su brojke ispravne, klikni "Primeni i proknjiži ispravku".
                      Tek tada se ažuriraju cene na dokumentima i kreira jedinstveni nalog ispravke u GK.
                    </li>
                  </ol>
                  <p className="pt-2">
                    Ako napraviš grešku, koristi <strong>"Poništi usklađivanje"</strong> — sistem će vratiti cene i
                    stornirati nalog ispravke.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="pdv">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    Šta sa zaključenim PDV periodom?
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2 text-muted-foreground">
                  <p>
                    Ako rekonsilijacija dotiče period za koji je PDV već prijavljen, sistem blokira primenu.
                    Lokalni admin može markirati polje <strong>"Lokalni admin override"</strong> i upisati razlog —
                    izmena će biti zabeležena u audit logu.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Wizard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="w-4 h-4" />
                1. Pokreni novo usklađivanje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Magacin *</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite magacin" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.code} - {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Artikal (opciono)</Label>
                <Select value={articleId} onValueChange={setArticleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Svi artikli" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Svi artikli u magacinu</SelectItem>
                    {articles.slice(0, 500).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Prikazano prvih 500 aktivnih artikala. Ostavite "Svi artikli" za pun obuhvat.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Datum od (opciono)</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Ako se ne unese, sistem će sam pronaći najraniji retroaktivni unos.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Napomena (opciono)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Razlog pokretanja, npr. naknadno proknjižena prijemnica..."
                  rows={2}
                />
              </div>

              <Button
                onClick={handleDetect}
                disabled={!canManage || !warehouseId || detect.isPending}
                className="w-full"
              >
                {detect.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Inicijalizuj usklađivanje
              </Button>
            </CardContent>
          </Card>

          {/* Step 2-4 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                2. Pregled i primena
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedRun ? (
                <p className="text-sm text-muted-foreground">
                  Izaberite zapis iz tabele ili pokrenite novo usklađivanje PNC.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Status: </span>
                      <Badge className={WAC_STATUS_COLORS[selectedRun.status]}>
                        {WAC_STATUS_LABELS[selectedRun.status]}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pokretač: </span>
                      {WAC_TRIGGER_LABELS[selectedRun.trigger_type]}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Magacin: </span>
                      {warehouseName(selectedRun.warehouse_id)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Datum od: </span>
                      {fmtDate(selectedRun.reconcile_from_date)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dokumenata: </span>
                      {selectedRun.affected_documents_count}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Artikala: </span>
                      {selectedRun.affected_articles_count}
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Razlika vrednosti: </span>
                      <strong>{fmtNumber(Number(selectedRun.total_value_difference))} RSD</strong>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2 border-t">
                    <Button
                      onClick={handlePreview}
                      disabled={!canManage || preview.isPending || selectedRun.status === "applied"}
                      variant="secondary"
                    >
                      {preview.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                      Generiši pregled izmena
                    </Button>

                    {selectedRun.status === "previewed" && (
                      <>
                        <div className="flex items-start gap-2 p-2 rounded-md bg-muted">
                          <Checkbox
                            id="override-pdv"
                            checked={overridePdv}
                            onCheckedChange={(v) => setOverridePdv(!!v)}
                          />
                          <div className="flex-1 space-y-1">
                            <label htmlFor="override-pdv" className="text-sm font-medium">
                              Lokalni admin override (zaključan PDV period)
                            </label>
                            {overridePdv && (
                              <Input
                                value={overrideReason}
                                onChange={(e) => setOverrideReason(e.target.value)}
                                placeholder="Razlog overridea..."
                                className="text-xs"
                              />
                            )}
                          </div>
                        </div>

                        <Button
                          onClick={handleApply}
                          disabled={!canManage || apply.isPending}
                        >
                          {apply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                          Primeni i proknjiži ispravku
                        </Button>
                      </>
                    )}

                    {selectedRun.status === "applied" && (
                      <>
                        {selectedRun.correction_journal_entry_id && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              navigate(`/racunovodstvo/nalozi/${selectedRun.correction_journal_entry_id}`)
                            }
                          >
                            <ExternalLink className="w-4 h-4" />
                            Otvori nalog ispravke u GK
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          onClick={handleRevert}
                          disabled={!canManage || revert.isPending}
                        >
                          {revert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                          Poništi usklađivanje
                        </Button>
                      </>
                    )}

                    {selectedRun.error_message && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Greška</AlertTitle>
                        <AlertDescription className="text-xs">{selectedRun.error_message}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lista runova */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Istorija usklađivanja PNC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TableScrollContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum kreiranja</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pokretač</TableHead>
                    <TableHead>Magacin</TableHead>
                    <TableHead>Datum od</TableHead>
                    <TableHead className="text-right">Dokumenata</TableHead>
                    <TableHead className="text-right">Artikala</TableHead>
                    <TableHead className="text-right">Razlika (RSD)</TableHead>
                    <TableHead>Primenjeno</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runsLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-6">
                        <Loader2 className="w-4 h-4 animate-spin inline" /> Učitavanje...
                      </TableCell>
                    </TableRow>
                  ) : runs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                        Nema zapisa usklađivanja.
                      </TableCell>
                    </TableRow>
                  ) : (
                    runs.map((r) => (
                      <TableRow
                        key={r.id}
                        className={selectedRunId === r.id ? "bg-muted" : "cursor-pointer"}
                        onClick={() => setSelectedRunId(r.id)}
                      >
                        <TableCell className="text-xs">{fmtDateTime(r.created_at)}</TableCell>
                        <TableCell>
                          <Badge className={WAC_STATUS_COLORS[r.status]}>{WAC_STATUS_LABELS[r.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{WAC_TRIGGER_LABELS[r.trigger_type]}</TableCell>
                        <TableCell className="text-xs">{warehouseName(r.warehouse_id)}</TableCell>
                        <TableCell className="text-xs">{fmtDate(r.reconcile_from_date)}</TableCell>
                        <TableCell className="text-right">{r.affected_documents_count}</TableCell>
                        <TableCell className="text-right">{r.affected_articles_count}</TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtNumber(Number(r.total_value_difference))}
                        </TableCell>
                        <TableCell className="text-xs">{fmtDateTime(r.applied_at)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRunId(r.id);
                            }}
                          >
                            Detalji
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableScrollContainer>
          </CardContent>
        </Card>

        {/* Detalji izmena */}
        {selectedRun && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Predložene / primenjene izmene ({changes.length})
                </span>
                <span className="text-sm font-normal">
                  Ukupna razlika: <strong className="font-mono">{fmtNumber(totalDiff)} RSD</strong>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TableScrollContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Datum dok.</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Broj dok.</TableHead>
                      <TableHead className="text-right">Količina</TableHead>
                      <TableHead className="text-right">Stara cena</TableHead>
                      <TableHead className="text-right">Nova cena</TableHead>
                      <TableHead className="text-right">Razlika</TableHead>
                      <TableHead>Konto</TableHead>
                      <TableHead>MT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changesLoading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-6">
                          <Loader2 className="w-4 h-4 animate-spin inline" /> Učitavanje izmena...
                        </TableCell>
                      </TableRow>
                    ) : changes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                          Nema izmena. Pokrenite "Generiši pregled" da bi se izračunale.
                        </TableCell>
                      </TableRow>
                    ) : (
                      changes.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs">{c.processing_order}</TableCell>
                          <TableCell className="text-xs">{fmtDate(c.document_date)}</TableCell>
                          <TableCell className="text-xs">
                            {DOC_TYPE_LABELS[c.document_type] || c.document_type}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{c.document_number || "-"}</TableCell>
                          <TableCell className="text-right font-mono">{fmtNumber(Number(c.quantity), 3)}</TableCell>
                          <TableCell className="text-right font-mono">{fmtNumber(Number(c.old_unit_cost), 4)}</TableCell>
                          <TableCell className="text-right font-mono">{fmtNumber(Number(c.new_unit_cost), 4)}</TableCell>
                          <TableCell className={`text-right font-mono ${Number(c.cost_difference) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {fmtNumber(Number(c.cost_difference))}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{c.account_code || "-"}</TableCell>
                          <TableCell className="text-xs">{c.cost_center_code || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
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
