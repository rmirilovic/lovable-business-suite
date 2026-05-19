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
import { useOutgoingMail, DOCUMENT_TYPE_MAP, STATUS_LABELS, STATUS_VARIANTS, OutgoingMail } from "@/hooks/useOutgoingMail";
import { formatDate, formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { exportOutgoingMailToExcel, exportOutgoingMailToPdf, printOutgoingMail } from "@/lib/outgoingMailListExportUtils";

export default function ZavodjenjePoslatePoste() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const { mails, isLoading, deleteMail } = useOutgoingMail(statusFilter === "all" ? undefined : statusFilter);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<OutgoingMail | null>(null);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort();

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const base = mails.filter((d) => {
      const matchSearch =
        d.mail_number.toLowerCase().includes(q) ||
        d.document_number.toLowerCase().includes(q) ||
        d.recipient_name.toLowerCase().includes(q);
      return (
        matchSearch &&
        (!dateFrom || d.document_date >= dateFrom) &&
        (!dateTo || d.document_date <= dateTo)
      );
    });
    return sortItems(base, (item, col) => {
      switch (col) {
        case "mail_number": return item.mail_number;
        case "document_date": return item.document_date;
        case "document_type": return item.document_type;
        case "document_number": return item.document_number;
        case "recipient_name": return item.recipient_name;
        case "amount": return item.amount ?? 0;
        case "status": return item.status;
        default: return "";
      }
    });
  }, [mails, searchTerm, dateFrom, dateTo, sortItems]);

  const handleDelete = async () => {
    if (!docToDelete) return;
    await deleteMail.mutateAsync(docToDelete.id);
    setDeleteDialogOpen(false);
    setDocToDelete(null);
  };

  return (
    <MainLayout title="Zavođenje poslate pošte">
      <div className="flex-1 min-h-0 overflow-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Zavođenje poslate pošte</h1>
            <p className="text-muted-foreground">Delovodna knjiga - poslata pošta</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportOutgoingMailToExcel(filtered, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportOutgoingMailToPdf(filtered, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printOutgoingMail(filtered, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
            <Button onClick={() => navigate("/pisarnica/poslata-posta/new")}>
              <Plus className="h-4 w-4 mr-2" />Novi dokument
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Pretraži po broju, dokumentu, primaocu..."
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
                <SelectItem value="all">Svi</SelectItem>
                <SelectItem value="draft">Nacrt</SelectItem>
                <SelectItem value="registered">Zaveden</SelectItem>
                <SelectItem value="cancelled">Storniran</SelectItem>
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
                <TableHead className="w-[100px]"><SortableHeader column="mail_number" label="Broj" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[100px]"><SortableHeader column="document_date" label="Datum dok." sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader column="document_type" label="Vrsta" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader column="document_number" label="Broj dokumenta" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader column="recipient_name" label="Primalac" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="text-right w-[120px]"><SortableHeader column="amount" label="Iznos" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                <TableHead className="w-[110px]"><SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
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
                    Nema dokumenata
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d) => (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/pisarnica/poslata-posta/${d.id}`)}
                  >
                    <TableCell className="font-mono text-sm">{d.mail_number}</TableCell>
                    <TableCell className="text-sm">{formatDate(d.document_date)}</TableCell>
                    <TableCell className="text-sm">
                      {DOCUMENT_TYPE_MAP[d.document_type]?.label || d.document_type}
                    </TableCell>
                    <TableCell className="text-sm">{d.document_number}</TableCell>
                    <TableCell className="text-sm">{d.recipient_name}</TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {d.amount != null
                        ? formatNumber(d.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : ""}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANTS[d.status] || "secondary"}
                        className={cn(
                          d.status === "registered" && "bg-blue-800 text-white hover:bg-blue-900"
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
                          <DropdownMenuItem onClick={() => navigate(`/pisarnica/poslata-posta/${d.id}`)}>
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
