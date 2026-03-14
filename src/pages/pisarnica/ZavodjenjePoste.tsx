import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, MoreHorizontal, Trash2, Eye, Loader2, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useIncomingMail, DOCUMENT_TYPE_MAP, STATUS_LABELS, STATUS_VARIANTS, IncomingMail } from "@/hooks/useIncomingMail";
import { IncomingMailDialog } from "@/components/pisarnica/IncomingMailDialog";
import { formatDate, formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { exportIncomingMailToExcel, exportIncomingMailToPdf, printIncomingMail } from "@/lib/incomingMailListExportUtils";

export default function ZavodjenjePoste() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const [statusFilter, setStatusFilter] = useState("draft");
  const { mails, isLoading, deleteMail } = useIncomingMail(statusFilter === "all" ? undefined : statusFilter);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [liquidatorFilter, setLiquidatorFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<IncomingMail | null>(null);

  // Collect unique liquidators from current data for the filter
  const liquidators = useMemo(() => {
    const map = new Map<string, string>();
    mails.forEach((m) => {
      if (m.liquidator_user_id && m.liquidator_name) {
        map.set(m.liquidator_user_id, m.liquidator_name);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "sr"));
  }, [mails]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return mails.filter((d) => {
      const matchSearch =
        d.mail_number.toLowerCase().includes(q) ||
        d.document_number.toLowerCase().includes(q) ||
        d.sender_name.toLowerCase().includes(q);
      const matchLiquidator =
        liquidatorFilter === "all" ||
        (liquidatorFilter === "none" ? !d.liquidator_user_id : d.liquidator_user_id === liquidatorFilter);
      return (
        matchSearch &&
        matchLiquidator &&
        (!dateFrom || d.document_date >= dateFrom) &&
        (!dateTo || d.document_date <= dateTo)
      );
    });
  }, [mails, searchTerm, dateFrom, dateTo, liquidatorFilter]);

  const handleDelete = async () => {
    if (!docToDelete) return;
    await deleteMail.mutateAsync(docToDelete.id);
    setDeleteDialogOpen(false);
    setDocToDelete(null);
  };

  return (
    <MainLayout title="Zavođenje ulazne pošte">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Zavođenje ulazne pošte</h1>
            <p className="text-muted-foreground">Delovodna knjiga - primljena pošta</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportIncomingMailToExcel(filtered, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportIncomingMailToPdf(filtered, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printIncomingMail(filtered, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Novi dokument
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
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Nacrt</SelectItem>
                <SelectItem value="registered">Zaveden</SelectItem>
                <SelectItem value="liquidated">Likvidiran</SelectItem>
                <SelectItem value="cancelled">Storniran</SelectItem>
                <SelectItem value="all">Svi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Likvidator</Label>
            <Select value={liquidatorFilter} onValueChange={setLiquidatorFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi</SelectItem>
                <SelectItem value="none">Bez likvidatora</SelectItem>
                {liquidators.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[170px]" />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Broj</TableHead>
                <TableHead className="w-[100px]">Datum dok.</TableHead>
                <TableHead>Vrsta</TableHead>
                <TableHead>Broj dokumenta</TableHead>
                <TableHead>Pošiljalac</TableHead>
                <TableHead className="text-right w-[120px]">Iznos</TableHead>
                <TableHead className="w-[150px]">Likvidator</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nema dokumenata
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d) => (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/pisarnica/zavodjenje/${d.id}`)}
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
                    <TableCell className="text-sm">{d.liquidator_name || ""}</TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANTS[d.status] || "secondary"}
                        className={cn(
                          d.status === "liquidated" && "bg-blue-800 text-white hover:bg-blue-900"
                        )}
                      >
                        {STATUS_LABELS[d.status] || d.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/pisarnica/zavodjenje/${d.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />Otvori
                          </DropdownMenuItem>
                          {d.status === "draft" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setDocToDelete(d);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />Obriši
                            </DropdownMenuItem>
                          )}
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

      <IncomingMailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(mail) => navigate(`/pisarnica/zavodjenje/${mail.id}`)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje dokumenta</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete dokument {docToDelete?.mail_number}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
