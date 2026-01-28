import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { usePurchaseInvoices, PurchaseInvoice } from "@/hooks/usePurchaseInvoices";
import { PurchaseInvoiceDialog } from "@/components/nabavka/PurchaseInvoiceDialog";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);

  const filteredInvoices = purchaseInvoices.filter(
    (invoice) =>
      invoice.internal_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.supplier_invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.partner?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.partner?.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => {
    setSelectedInvoice(null);
    setDialogOpen(true);
  };

  const handleEdit = (invoice: PurchaseInvoice) => {
    setSelectedInvoice(invoice);
    setDialogOpen(true);
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

  return (
    <MainLayout title="Ulazne fakture">
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Pretraži po broju, dobavljaču..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoComplete="off"
            />
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova ulazna faktura
          </Button>
        </div>

        <div className="border rounded-lg">
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
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "Nema rezultata pretrage" : "Nema ulaznih faktura"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.internal_number}</TableCell>
                    <TableCell>{invoice.supplier_invoice_number}</TableCell>
                    <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                    <TableCell>{formatDate(invoice.receipt_date)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.partner?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {invoice.partner?.code}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(invoice.total_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[invoice.status]}>
                        {statusLabels[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
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
                                Izmeni
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
        </div>
      </div>

      <PurchaseInvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invoice={selectedInvoice}
      />

      <PurchaseInvoiceDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        invoice={selectedInvoice}
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
