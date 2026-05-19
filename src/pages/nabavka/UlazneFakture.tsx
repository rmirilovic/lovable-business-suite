import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye, FileText } from "lucide-react";
import { usePurchaseInvoices, PurchaseInvoice } from "@/hooks/usePurchaseInvoices";
import { PurchaseInvoiceHeaderDialog } from "@/components/nabavka/PurchaseInvoiceHeaderDialog";
import { PurchaseInvoiceDetailDialog } from "@/components/nabavka/PurchaseInvoiceDetailDialog";
import { formatNumber, formatDate } from "@/lib/formatting";

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjiženo",
  cancelled: "Stornirano",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  posted: "default",
  cancelled: "destructive",
};

export default function UlazneFakture() {
  const { purchaseInvoices, isLoading, deletePurchaseInvoice } = usePurchaseInvoices();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);

  // Keep selected invoice in sync with latest query data
  useEffect(() => {
    if (!selectedInvoice) return;
    const updated = purchaseInvoices.find((inv) => inv.id === selectedInvoice.id);
    if (!updated) return;
    // Update if status or totals changed
    if (
      updated.status !== selectedInvoice.status ||
      updated.total_amount !== selectedInvoice.total_amount ||
      updated.subtotal !== selectedInvoice.subtotal
    ) {
      setSelectedInvoice(updated);
    }
  }, [purchaseInvoices, selectedInvoice?.id, selectedInvoice?.status, selectedInvoice?.total_amount, selectedInvoice?.subtotal]);

  const filteredInvoices = purchaseInvoices.filter(
    (invoice) => {
      const matchesSearch =
        invoice.internal_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.supplier_invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.partner?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.partner?.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDateFrom = !dateFrom || invoice.invoice_date >= dateFrom;
      const matchesDateTo = !dateTo || invoice.invoice_date <= dateTo;
      return matchesSearch && matchesDateFrom && matchesDateTo;
    }
  );

  const handleCreate = () => {
    setSelectedInvoice(null);
    setHeaderDialogOpen(true);
  };

  const handleEdit = (invoice: PurchaseInvoice) => {
    setSelectedInvoice(invoice);
    setHeaderDialogOpen(true);
  };

  const handleView = (invoice: PurchaseInvoice) => {
    setSelectedInvoice(invoice);
    setDetailDialogOpen(true);
  };

  const handleDeleteClick = (invoice: PurchaseInvoice) => {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (invoiceToDelete) {
      await deletePurchaseInvoice.mutateAsync(invoiceToDelete.id);
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const handleNewInvoiceSaved = (invoice: PurchaseInvoice) => {
    // Open detail dialog for the new invoice to add items
    setSelectedInvoice(invoice);
    setDetailDialogOpen(true);
  };

  return (
    <MainLayout title="Ulazne fakture">
      <div className="flex-1 min-h-0 overflow-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ulazne fakture</h1>
            <p className="text-muted-foreground">Upravljanje ulaznim fakturama od dobavljača</p>
          </div>
          <Button onClick={handleCreate} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Nova ulazna faktura
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-end gap-3 lg:gap-4">
          <div className="relative sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[200px] lg:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Pretraži po broju ili dobavljaču..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-full lg:w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-full lg:w-[170px]" />
          </div>
        </div>

        {/* Table */}
        <TableScrollContainer className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Interni broj</TableHead>
                <TableHead>Broj fakture dobavljača</TableHead>
                <TableHead>Datum fakture</TableHead>
                <TableHead>Datum prijema</TableHead>
                <TableHead>Dobavljač</TableHead>
                <TableHead className="text-right">Ukupno</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "Nema rezultata pretrage" : "Nema ulaznih faktura. Kreirajte novu ulaznu fakturu."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleView(invoice)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{invoice.internal_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>{invoice.supplier_invoice_number}</TableCell>
                    <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                    <TableCell>{formatDate(invoice.receipt_date)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.partner?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.partner?.code}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(invoice.total_amount)} RSD
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[invoice.status]}>
                        {statusLabels[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(invoice)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Prikaži
                          </DropdownMenuItem>
                          {invoice.status === "draft" && (
                            <>
                              <DropdownMenuItem onClick={() => handleEdit(invoice)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Uredi zaglavlje
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(invoice)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Obriši
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>

      <PurchaseInvoiceHeaderDialog
        open={headerDialogOpen}
        onOpenChange={setHeaderDialogOpen}
        invoice={selectedInvoice}
        onSaved={handleNewInvoiceSaved}
      />

      <PurchaseInvoiceDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        invoice={selectedInvoice}
        onEdit={() => {
          setDetailDialogOpen(false);
          handleEdit(selectedInvoice!);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje ulazne fakture</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete ulaznu fakturu{" "}
              <strong>{invoiceToDelete?.internal_number}</strong>? Ova akcija se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
