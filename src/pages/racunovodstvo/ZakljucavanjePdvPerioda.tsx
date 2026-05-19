import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  useVatPeriodLocks,
  useVatPeriodLockAudit,
  useVatPeriodLockMutations,
} from "@/hooks/useVatPeriodLocks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lock, LockOpen, ShieldAlert, History, Info } from "lucide-react";
import { format } from "date-fns";

export default function ZakljucavanjePdvPerioda() {
  const { selectedCompany, isSuperAdmin, isLocalAdmin } = useAuth();
  const isAdmin = isSuperAdmin || isLocalAdmin;
  const locksQuery = useVatPeriodLocks();
  const auditQuery = useVatPeriodLockAudit();
  const { unlockPeriod } = useVatPeriodLockMutations();

  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [selectedLockId, setSelectedLockId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const locks = locksQuery.data || [];
  const audit = auditQuery.data || [];

  const activeLocks = useMemo(() => locks.filter((l) => l.is_active), [locks]);
  const historicalLocks = useMemo(() => locks.filter((l) => !l.is_active), [locks]);

  const handleUnlockClick = (lockId: string) => {
    setSelectedLockId(lockId);
    setReason("");
    setUnlockDialogOpen(true);
  };

  const handleUnlockConfirm = () => {
    if (!selectedLockId) return;
    if (reason.trim().length < 5) return;
    unlockPeriod.mutate(
      { lockId: selectedLockId, reason: reason.trim() },
      {
        onSuccess: () => {
          setUnlockDialogOpen(false);
          setSelectedLockId(null);
          setReason("");
        },
      }
    );
  };

  if (!selectedCompany) {
    return (
      <MainLayout title="Zaključavanje PDV perioda">
        <div className="flex-1 min-h-0 overflow-auto p-8 text-center text-muted-foreground">Izaberite firmu.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Zaključavanje PDV perioda">
      <div className="flex-1 min-h-0 overflow-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Zaključavanje PDV perioda</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pregled i upravljanje zaključanim PDV periodima za firmu {selectedCompany.name}.
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Kako funkcioniše?</AlertTitle>
          <AlertDescription className="space-y-2 mt-2">
            <p>
              Nakon što se PP-PDV prijava finalizuje, administrator može da zaključa odgovarajući period
              klikom na dugme <strong>„Zaključaj PDV period"</strong> na samoj prijavi. Time se sprečava
              naknadna izmena, brisanje ili unos novih dokumenata sa datumom u tom periodu.
            </p>
            <p className="font-medium">Zaključavanje blokira sledeće dokumente:</p>
            <ul className="list-disc list-inside text-sm space-y-0.5 ml-2">
              <li>Izlazne fakture, avansne fakture, knjižna odobrenja</li>
              <li>UFR (ulazne fakture za robu), UFU (ulazne za usluge), avansne ulazne</li>
              <li>Carinski obračuni</li>
            </ul>
            <p className="text-sm">
              Otključavanje je moguće samo uz <strong>obavezan razlog</strong> (min. 5 karaktera) i
              evidentira se u dnevniku akcija.
            </p>
          </AlertDescription>
        </Alert>

        {/* Aktivni lockovi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Aktivni zaključani periodi ({activeLocks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {locksQuery.isLoading ? (
              <div className="text-muted-foreground">Učitavanje…</div>
            ) : activeLocks.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center">
                Nema aktivnih zaključanih PDV perioda.
              </div>
            ) : (
              <TableScrollContainer>
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Datumi</TableHead>
                      <TableHead>Zaključan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeLocks.map((lock) => (
                      <TableRow key={lock.id}>
                        <TableCell className="font-medium">{lock.period_label}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(lock.period_start), "dd.MM.yyyy")} —{" "}
                          {format(new Date(lock.period_end), "dd.MM.yyyy")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(lock.locked_at), "dd.MM.yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="gap-1">
                            <Lock className="h-3 w-3" />
                            Zaključan
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!isAdmin}
                            onClick={() => handleUnlockClick(lock.id)}
                            className="gap-1"
                          >
                            <LockOpen className="h-4 w-4" />
                            Otključaj
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableScrollContainer>
            )}
            {!isAdmin && activeLocks.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                Samo lokalni administrator ili super administrator može da otključa period.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Istorija lockova */}
        {historicalLocks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockOpen className="h-5 w-5" />
                Istorija otključanih perioda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TableScrollContainer>
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Zaključan</TableHead>
                      <TableHead>Otključan</TableHead>
                      <TableHead>Razlog otključavanja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicalLocks.map((lock) => (
                      <TableRow key={lock.id}>
                        <TableCell className="font-medium">{lock.period_label}</TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(lock.locked_at), "dd.MM.yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {lock.unlocked_at
                            ? format(new Date(lock.unlocked_at), "dd.MM.yyyy HH:mm")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm max-w-md truncate" title={lock.unlock_reason || ""}>
                          {lock.unlock_reason || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableScrollContainer>
            </CardContent>
          </Card>
        )}

        {/* Audit log */}
        {audit.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Dnevnik akcija
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TableScrollContainer>
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vreme</TableHead>
                      <TableHead>Akcija</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Razlog</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(a.performed_at), "dd.MM.yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.action === "lock" ? "default" : "secondary"}>
                            {a.action === "lock" ? "Zaključan" : "Otključan"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {(a.details as any)?.period_label || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.reason || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableScrollContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Unlock dialog */}
      <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockOpen className="h-5 w-5" />
              Otključaj PDV period
            </DialogTitle>
            <DialogDescription>
              Otključavanjem perioda dozvoljavate izmene PDV-relevantnih dokumenata u tom periodu.
              Razlog se trajno čuva u dnevniku.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="unlock-reason">Razlog otključavanja (obavezno, min. 5 karaktera)</Label>
            <Textarea
              id="unlock-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Npr. Ispravka pogrešno unete fakture broj 24/0123 nakon obaveštenja od dobavljača…"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Trenutna dužina: {reason.trim().length} karaktera
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockDialogOpen(false)}>
              Otkaži
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnlockConfirm}
              disabled={reason.trim().length < 5 || unlockPeriod.isPending}
            >
              {unlockPeriod.isPending ? "Otključavanje…" : "Otključaj period"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
