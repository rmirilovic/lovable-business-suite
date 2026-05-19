import { useState, useMemo, useCallback, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Eye, Undo2, ArrowRight, Loader2, Paperclip, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useIncomingMail, DOCUMENT_TYPE_MAP, STATUS_LABELS, IncomingMail } from "@/hooks/useIncomingMail";
import { exportIncomingMailToExcel, exportIncomingMailToPdf, printIncomingMail } from "@/lib/incomingMailListExportUtils";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNumber } from "@/lib/formatting";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function LikvidacijaPoste() {
  const { user, selectedCompany } = useAuth();
  const { mails, isLoading, updateMail } = useIncomingMail("registered");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMail, setSelectedMail] = useState<IncomingMail | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [unregisterDialogOpen, setUnregisterDialogOpen] = useState(false);
  const [liquidateDialogOpen, setLiquidateDialogOpen] = useState(false);
  const [archiveLabel, setArchiveLabel] = useState("");
  const [costCenterDist, setCostCenterDist] = useState("");

  // Filter only mails assigned to current user as liquidator
  const myMails = useMemo(() => {
    if (!user?.id) return [];
    return mails.filter((m) => m.liquidator_user_id === user.id);
  }, [mails, user?.id]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return myMails.filter((d) =>
      d.mail_number.toLowerCase().includes(q) ||
      d.document_number.toLowerCase().includes(q) ||
      d.sender_name.toLowerCase().includes(q)
    );
  }, [myMails, searchTerm]);

  const handleOpenDetail = (mail: IncomingMail) => {
    setSelectedMail(mail);
    setArchiveLabel(mail.archive_label || "");
    setCostCenterDist(mail.cost_center_distribution || "");
    setDetailDialogOpen(true);
  };

  const handleUnregister = async () => {
    if (!selectedMail) return;
    await updateMail.mutateAsync({
      id: selectedMail.id,
      status: "draft",
      liquidator_user_id: null,
      liquidator_name: null,
      registration_date: null,
    } as any);
    setUnregisterDialogOpen(false);
    setDetailDialogOpen(false);
    setSelectedMail(null);
  };

  const handleLiquidate = async () => {
    if (!selectedMail) return;
    await updateMail.mutateAsync({
      id: selectedMail.id,
      status: "liquidated",
      archive_label: archiveLabel.trim() || null,
      cost_center_distribution: costCenterDist.trim() || null,
      liquidation_date: format(new Date(), "yyyy-MM-dd"),
    } as any);
    setLiquidateDialogOpen(false);
    setDetailDialogOpen(false);
    setSelectedMail(null);
  };

  const handleViewAttachment = async (mail: IncomingMail) => {
    if (!mail.attachment_path) return;
    const { data } = await supabase.storage
      .from("mail-attachments")
      .createSignedUrl(mail.attachment_path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  return (
    <MainLayout title="Likvidacija dokumenta">
      <div className="flex-1 min-h-0 overflow-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Likvidacija dokumenta</h1>
            <p className="text-muted-foreground">Dokumenti dodeljeni vama na likvidaciju</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportIncomingMailToExcel(filtered, { companyName: selectedCompany?.name ?? "" })}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportIncomingMailToPdf(filtered, { companyName: selectedCompany?.name ?? "" })}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printIncomingMail(filtered, { companyName: selectedCompany?.name ?? "" })}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Pretraži po broju, dokumentu, pošiljaocu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Broj</TableHead>
                <TableHead className="w-[100px]">Datum dok.</TableHead>
                <TableHead>Vrsta</TableHead>
                <TableHead>Broj dokumenta</TableHead>
                <TableHead>Pošiljalac</TableHead>
                <TableHead className="text-right w-[120px]">Iznos</TableHead>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nema dokumenata za likvidaciju
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d) => (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleOpenDetail(d)}
                  >
                    <TableCell className="font-mono text-sm">{d.mail_number}</TableCell>
                    <TableCell className="text-sm">{formatDate(d.document_date)}</TableCell>
                    <TableCell className="text-sm">
                      {DOCUMENT_TYPE_MAP[d.document_type]?.label || d.document_type}
                    </TableCell>
                    <TableCell className="text-sm">{d.document_number}</TableCell>
                    <TableCell className="text-sm">{d.sender_name}</TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {d.amount != null
                        ? formatNumber(d.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : ""}
                    </TableCell>
                    <TableCell>
                      {d.attachment_path && <Paperclip className="w-4 h-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDetail(d)}>
                            <Eye className="w-4 h-4 mr-2" />Otvori
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail / Liquidation Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dokument {selectedMail?.mail_number}</DialogTitle>
          </DialogHeader>
          {selectedMail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Vrsta dokumenta</div>
                  <div className="font-medium">{DOCUMENT_TYPE_MAP[selectedMail.document_type]?.label}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Broj dokumenta</div>
                  <div className="font-medium">{selectedMail.document_number}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Datum dokumenta</div>
                  <div className="font-medium">{formatDate(selectedMail.document_date)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Pošiljalac</div>
                  <div className="font-medium">{selectedMail.sender_name}</div>
                </div>
                {selectedMail.sender_pib && (
                  <div>
                    <div className="text-muted-foreground">PIB</div>
                    <div className="font-medium">{selectedMail.sender_pib}</div>
                  </div>
                )}
                {selectedMail.sender_mb && (
                  <div>
                    <div className="text-muted-foreground">MB</div>
                    <div className="font-medium">{selectedMail.sender_mb}</div>
                  </div>
                )}
                {selectedMail.amount != null && (
                  <div>
                    <div className="text-muted-foreground">Iznos</div>
                    <div className="font-medium">{formatNumber(selectedMail.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                )}
                {selectedMail.note && (
                  <div className="col-span-2">
                    <div className="text-muted-foreground">Napomena</div>
                    <div className="font-medium">{selectedMail.note}</div>
                  </div>
                )}
              </div>

              {selectedMail.attachment_path && (
                <Button variant="outline" size="sm" onClick={() => handleViewAttachment(selectedMail)}>
                  <Eye className="w-4 h-4 mr-2" />Vidi prilog ({selectedMail.attachment_name})
                </Button>
              )}

              <div className="border-t pt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Oznaka arhive (max 15 karaktera)</Label>
                  <Input
                    value={archiveLabel}
                    onChange={(e) => setArchiveLabel(e.target.value.slice(0, 15))}
                    maxLength={15}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Raspored po mestima troškova (max 31 karakter)</Label>
                  <Input
                    value={costCenterDist}
                    onChange={(e) => setCostCenterDist(e.target.value.slice(0, 31))}
                    maxLength={31}
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => setUnregisterDialogOpen(true)}
            >
              <Undo2 className="w-4 h-4 mr-2" />Vrati u nacrt
            </Button>
            <Button onClick={() => setLiquidateDialogOpen(true)}>
              <ArrowRight className="w-4 h-4 mr-2" />Prosledi dokument za dalje
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unregister confirmation */}
      <AlertDialog open={unregisterDialogOpen} onOpenChange={setUnregisterDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništavanje zavođenja</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da vratite dokument {selectedMail?.mail_number} u nacrt?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnregister} className="bg-destructive text-destructive-foreground">
              Vrati u nacrt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Liquidate confirmation */}
      <AlertDialog open={liquidateDialogOpen} onOpenChange={setLiquidateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Likvidacija dokumenta</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da likvidirate dokument {selectedMail?.mail_number}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleLiquidate}>Likvidiraj</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
