import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, MoreHorizontal, Eye, Trash2, CheckCircle, FileInput, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useInvoices, Invoice, InvoiceFormData } from "@/hooks/useInvoices";
import { InvoiceDialog } from "@/components/prodaja/InvoiceDialog";
import { CreateInvoiceFromSourceDialog } from "@/components/prodaja/CreateInvoiceFromSourceDialog";
import { formatNumber } from "@/lib/formatting";
import { format } from "date-fns";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  posted: { label: "Proknjižena", variant: "default" },
  cancelled: { label: "Stornirana", variant: "destructive" },
};

export default function Fakture() {
  const navigate = useNavigate();
  const { invoices, isLoading, createInvoice, deleteInvoice, postInvoice } = useInvoices();
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort();

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromSourceDialogOpen, setFromSourceDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  const filteredInvoices = invoices.filter((invoice) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(query) ||
      invoice.partner?.name?.toLowerCase().includes(query) ||
      invoice.partner?.code?.toLowerCase().includes(query);
    const matchesDateFrom = !dateFrom || invoice.invoice_date >= dateFrom;
    const matchesDateTo = !dateTo || invoice.invoice_date <= dateTo;
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesDateFrom && matchesDateTo && matchesStatus;
  });

  const sortedInvoices = sortItems(filteredInvoices, (item, column) => {
    switch (column) {
      case "invoice_number": return item.invoice_number;
      case "invoice_date": return item.invoice_date;
      case "due_date": return item.due_date || "";
      case "partner": return item.partner?.name || "";
      case "total_amount": return item.total_amount;
      case "composed_by": return item.composed_by || "";
      case "status": return item.status;
      default: return "";
    }
  });

  const handleNavigate = (invoice: Invoice) => {
    navigate(`/prodaja/fakture/${invoice.id}`, { state: { prefetchedInvoice: invoice } });
  };

  const handleDelete = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (invoiceToDelete) {
      await deleteInvoice.mutateAsync(invoiceToDelete.id);
      setDeleteConfirmOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const handleSave = async (data: InvoiceFormData) => {
    await createInvoice.mutateAsync(data);
    setDialogOpen(false);
  };

  const handleInvoiceCreatedFromSource = (invoiceId: string) => {
    navigate(`/prodaja/fakture/${invoiceId}`);
  };

  return (
    <MainLayout title="Fakture">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex flex-wrap items-end gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pretraži fakture..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Datum od</Label>
              <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[170px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Datum do</Label>
              <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[170px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi</SelectItem>
                  <SelectItem value="draft">Nacrt</SelectItem>
                  <SelectItem value="posted">Proknjižena</SelectItem>
                  <SelectItem value="cancelled">Stornirana</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFromSourceDialogOpen(true)}>
              <FileInput className="mr-2 h-4 w-4" />
              Iz dokumenta
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova faktura
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]"><SortableHeader column="invoice_number" label="Broj fakture" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[90px]"><SortableHeader column="invoice_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[90px]"><SortableHeader column="due_date" label="Valuta" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="min-w-[300px]"><SortableHeader column="partner" label="Kupac" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="text-right w-[130px]"><SortableHeader column="total_amount" label="Iznos" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                <TableHead className="w-[80px]"><SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : sortedInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "Nema rezultata pretrage" : "Nema faktura. Kreirajte novu fakturu."}
                  </TableCell>
                </TableRow>
              ) : (
                sortedInvoices.map((invoice) => {
                  const status = STATUS_BADGES[invoice.status] || STATUS_BADGES.draft;
                  return (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleNavigate(invoice)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{invoice.invoice_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.invoice_date), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell>
                        {invoice.due_date ? format(new Date(invoice.due_date), "dd.MM.yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{invoice.partner_name ?? invoice.partner?.name}</div>
                          <div className="text-xs text-muted-foreground">{invoice.partner?.code}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(invoice.total_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleNavigate(invoice)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Prikaži
                            </DropdownMenuItem>
                            {invoice.status === "draft" && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(invoice)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Obriši
                              </DropdownMenuItem>
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
        </div>

        {/* Create dialog */}
        <InvoiceDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          invoice={null}
          onSave={handleSave}
          isLoading={createInvoice.isPending}
        />

        <CreateInvoiceFromSourceDialog
          open={fromSourceDialogOpen}
          onOpenChange={setFromSourceDialogOpen}
          onInvoiceCreated={handleInvoiceCreatedFromSource}
        />

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Potvrda brisanja</AlertDialogTitle>
              <AlertDialogDescription>
                Da li ste sigurni da želite da obrišete fakturu {invoiceToDelete?.invoice_number}?
                Ova akcija se ne može poništiti.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Otkaži</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
                Obriši
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
