import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Eye, Edit, Trash2, CheckCircle, FileInput, BookOpen } from "lucide-react";
import { useInvoices, Invoice, InvoiceFormData } from "@/hooks/useInvoices";
import { InvoiceDialog } from "@/components/prodaja/InvoiceDialog";
import { InvoiceDetailDialog } from "@/components/prodaja/InvoiceDetailDialog";
import { CreateInvoiceFromSourceDialog } from "@/components/prodaja/CreateInvoiceFromSourceDialog";
import { formatDate, formatPrice } from "@/lib/formatting";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
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

const STATUS_LABELS: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjižena",
  cancelled: "Stornirana",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  posted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function Fakture() {
  const { invoices, isLoading, createInvoice, updateInvoice, deleteInvoice, postInvoice } = useInvoices();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [fromSourceDialogOpen, setFromSourceDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  const filteredInvoices = invoices.filter(invoice => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(query) ||
      invoice.partner?.name?.toLowerCase().includes(query) ||
      invoice.partner?.code?.toLowerCase().includes(query);
    const matchesDateFrom = !dateFrom || invoice.invoice_date >= dateFrom;
    const matchesDateTo = !dateTo || invoice.invoice_date <= dateTo;
    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const handleCreateNew = () => {
    setSelectedInvoice(null);
    setDialogOpen(true);
  };

  const handleCreateFromSource = () => {
    setFromSourceDialogOpen(true);
  };

  const handleEdit = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDialogOpen(true);
  };

  const handleView = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDetailDialogOpen(true);
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

  const handlePost = async (invoice: Invoice) => {
    await postInvoice.mutateAsync(invoice.id);
  };

  const handleSave = async (data: InvoiceFormData) => {
    if (selectedInvoice) {
      await updateInvoice.mutateAsync({ id: selectedInvoice.id, ...data });
    } else {
      await createInvoice.mutateAsync(data);
    }
    setDialogOpen(false);
  };

  const handleInvoiceCreatedFromSource = (invoiceId: string) => {
    // Find and open the newly created invoice
    setTimeout(() => {
      const newInvoice = invoices.find(inv => inv.id === invoiceId);
      if (newInvoice) {
        setSelectedInvoice(newInvoice);
        setDetailDialogOpen(true);
      }
    }, 500);
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
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCreateFromSource}>
              <FileInput className="mr-2 h-4 w-4" />
              Iz dokumenta
            </Button>
            <Button onClick={handleCreateNew}>
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
                <TableHead>Broj</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Valuta</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">Iznos</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "Nema rezultata pretrage" : "Nema faktura"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow 
                    key={invoice.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleView(invoice)}
                  >
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                    <TableCell>{invoice.due_date ? formatDate(invoice.due_date) : "-"}</TableCell>
                    <TableCell>
                      <div>
                        <div>{invoice.partner?.name}</div>
                        <div className="text-sm text-muted-foreground">{invoice.partner?.code}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(invoice.total_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={STATUS_COLORS[invoice.status]}>
                        {STATUS_LABELS[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleView(invoice); }}>
                            <Eye className="mr-2 h-4 w-4" />
                            Prikaži
                          </DropdownMenuItem>
                          {invoice.status === "draft" && (
                            <>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(invoice); }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Uredi
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePost(invoice); }}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Proknjiži
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); handleDelete(invoice); }}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Obriši
                              </DropdownMenuItem>
                            </>
                          )}
                          {invoice.journal_entry_id && (
                            <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                              <BookOpen className="mr-2 h-4 w-4" />
                              Nalog za knjiženje
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

        {/* Summary */}
        <div className="flex justify-end gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Ukupno faktura: </span>
            <span className="font-medium">{filteredInvoices.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Ukupan iznos: </span>
            <span className="font-medium">
              {formatPrice(filteredInvoices.reduce((sum, inv) => sum + inv.total_amount, 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <InvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invoice={selectedInvoice}
        onSave={handleSave}
        isLoading={createInvoice.isPending || updateInvoice.isPending}
      />

      <InvoiceDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        invoice={selectedInvoice}
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
    </MainLayout>
  );
}
