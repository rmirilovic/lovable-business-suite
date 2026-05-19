import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, MoreHorizontal, Eye, Trash2, FileText, FileInput, FileSpreadsheet, Printer } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCreditNotes, CreditNote, useCreateCreditNoteFromInvoice } from "@/hooks/useCreditNotes";
import { useInvoices } from "@/hooks/useInvoices";
import { formatNumber } from "@/lib/formatting";
import { format } from "date-fns";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditNoteHeaderDialog } from "@/components/prodaja/CreditNoteHeaderDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { exportCreditNotesToExcel, exportCreditNotesToPdf, printCreditNotes } from "@/lib/creditNoteListExportUtils";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  posted: { label: "Proknjiženo", variant: "default" },
  cancelled: { label: "Stornirano", variant: "destructive" },
};

export default function KnjiznaOdobrenja() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const { creditNotes, isLoading, createCreditNote, deleteCreditNote } = useCreditNotes();
  const { invoices } = useInvoices();
  const createFromInvoice = useCreateCreditNoteFromInvoice();
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort();

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromInvoiceDialogOpen, setFromInvoiceDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CreditNote | null>(null);

  const postedInvoices = invoices.filter((inv) => inv.status === "posted");

  const filteredItems = creditNotes.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      item.credit_note_number.toLowerCase().includes(query) ||
      item.partner?.name?.toLowerCase().includes(query) ||
      item.partner?.code?.toLowerCase().includes(query);
    const matchesDateFrom = !dateFrom || item.credit_note_date >= dateFrom;
    const matchesDateTo = !dateTo || item.credit_note_date <= dateTo;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesDateFrom && matchesDateTo && matchesStatus;
  });

  const sortedItems = sortItems(filteredItems, (item, column) => {
    switch (column) {
      case "number": return item.credit_note_number;
      case "date": return item.credit_note_date;
      case "partner": return item.partner?.name || "";
      case "ref": return item.billing_reference_number || "";
      case "total_amount": return item.total_amount;
      case "status": return item.status;
      default: return "";
    }
  });

  const handleNavigate = (item: CreditNote) => {
    navigate(`/prodaja/knjizna-odobrenja/${item.id}`, { state: { prefetched: item } });
  };

  const handleCreateSave = async (data: any) => {
    const result = await createCreditNote.mutateAsync(data);
    setDialogOpen(false);
    navigate(`/prodaja/knjizna-odobrenja/${result.id}`);
  };

  const handleCreateFromInvoice = async (invoiceId: string) => {
    const result = await createFromInvoice.mutateAsync(invoiceId);
    setFromInvoiceDialogOpen(false);
    navigate(`/prodaja/knjizna-odobrenja/${result.id}`);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      await deleteCreditNote.mutateAsync(itemToDelete.id);
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  return (
    <MainLayout title="Knjižna odobrenja">
      <div className="flex-1 min-h-0 overflow-auto space-y-4">
        {/* Actions row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
          <div className="grid grid-cols-3 sm:flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCreditNotesToExcel(sortedItems, { companyName: selectedCompany?.name || "", dateFrom, dateTo })} className="w-full sm:w-auto">
              <FileSpreadsheet className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCreditNotesToPdf(sortedItems, { companyName: selectedCompany?.name || "", dateFrom, dateTo })} className="w-full sm:w-auto">
              <FileText className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => printCreditNotes(sortedItems, { companyName: selectedCompany?.name || "", dateFrom, dateTo })} className="w-full sm:w-auto">
              <Printer className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Štampa</span>
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setFromInvoiceDialogOpen(true)} className="w-full sm:w-auto">
              <FileInput className="mr-2 h-4 w-4" />Iz fakture
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Novo KO</Button>
          </div>
        </div>

        {/* Filters row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-end gap-3 lg:gap-4">
          <div className="relative sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[200px] lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pretraži..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-full lg:w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-full lg:w-[170px]" />
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi</SelectItem>
                <SelectItem value="draft">Nacrt</SelectItem>
                <SelectItem value="posted">Proknjiženo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TableScrollContainer className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]"><SortableHeader column="number" label="Broj" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[90px]"><SortableHeader column="date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="min-w-[300px]"><SortableHeader column="partner" label="Kupac" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[130px]"><SortableHeader column="ref" label="Ref. faktura" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="text-right w-[130px]"><SortableHeader column="total_amount" label="Iznos" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                <TableHead className="w-[80px]"><SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell></TableRow>
              ) : sortedItems.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{searchQuery ? "Nema rezultata" : "Nema knjižnih odobrenja."}</TableCell></TableRow>
              ) : (
                sortedItems.map((item) => {
                  const status = STATUS_BADGES[item.status] || STATUS_BADGES.draft;
                  return (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleNavigate(item)}>
                      <TableCell><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /><span className="font-medium">{item.credit_note_number}</span></div></TableCell>
                      <TableCell>{format(new Date(item.credit_note_date), "dd.MM.yyyy")}</TableCell>
                      <TableCell><div><div className="font-medium">{item.partner_name ?? item.partner?.name}</div><div className="text-xs text-muted-foreground">{item.partner?.code}</div></div></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.billing_reference_number || "-"}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(item.total_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleNavigate(item)}><Eye className="w-4 h-4 mr-2" />Prikaži</DropdownMenuItem>
                            {item.status === "draft" && (
                              <DropdownMenuItem onClick={() => { setItemToDelete(item); setDeleteConfirmOpen(true); }} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Obriši</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>

        <CreditNoteHeaderDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Novo knjižno odobrenje"
          onSave={handleCreateSave}
          isLoading={createCreditNote.isPending}
        />

        {/* Create from invoice dialog */}
        <Dialog open={fromInvoiceDialogOpen} onOpenChange={setFromInvoiceDialogOpen}>
          <DialogContent className="max-w-lg" onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader><DialogTitle>Kreiraj KO iz fakture</DialogTitle></DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {postedInvoices.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Nema proknjiženih faktura.</p>
              ) : (
                postedInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => handleCreateFromInvoice(inv.id)}>
                    <div>
                      <div className="font-medium">{inv.invoice_number}</div>
                      <div className="text-sm text-muted-foreground">{inv.partner_name ?? inv.partner?.name} · {format(new Date(inv.invoice_date), "dd.MM.yyyy")}</div>
                    </div>
                    <div className="text-right font-medium">{formatNumber(inv.total_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Potvrda brisanja</AlertDialogTitle>
              <AlertDialogDescription>Da li ste sigurni da želite da obrišete knjižno odobrenje {itemToDelete?.credit_note_number}?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Otkaži</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Obriši</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
