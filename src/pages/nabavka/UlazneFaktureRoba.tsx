import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, MoreHorizontal, Trash2, Eye, Package, BookCheck, Undo2, FileDown, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useGoodsPurchaseInvoices, GoodsPurchaseInvoice } from "@/hooks/useGoodsPurchaseInvoices";
import { GoodsPurchaseInvoiceHeaderDialog } from "@/components/nabavka/GoodsPurchaseInvoiceHeaderDialog";

import { formatNumber, formatDate } from "@/lib/formatting";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { generateGoodsPurchaseInvoicePdf } from "@/lib/goodsPurchaseInvoicePdfGenerator";
import { toast } from "sonner";
import {
  exportGoodsPurchaseInvoicesToExcel,
  exportGoodsPurchaseInvoicesToPdf,
  printGoodsPurchaseInvoices,
} from "@/lib/goodsPurchaseInvoiceListExportUtils";

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

export default function UlazneFaktureRoba() {
  const navigate = useNavigate();
  const { invoices, isLoading, deleteInvoice, postInvoice, unpostInvoice } = useGoodsPurchaseInvoices();
  const { selectedCompany } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  
  const [selectedInvoice, setSelectedInvoice] = useState<GoodsPurchaseInvoice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<GoodsPurchaseInvoice | null>(null);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [invoiceToPost, setInvoiceToPost] = useState<GoodsPurchaseInvoice | null>(null);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);
  const [invoiceToUnpost, setInvoiceToUnpost] = useState<GoodsPurchaseInvoice | null>(null);

  useEffect(() => {
    if (!selectedInvoice) return;
    const updated = invoices.find((inv) => inv.id === selectedInvoice.id);
    if (updated && (
      updated.status !== selectedInvoice.status ||
      updated.total_amount !== selectedInvoice.total_amount
    )) {
      setSelectedInvoice(updated);
    }
  }, [invoices, selectedInvoice]);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort();

  const filteredInvoices = useMemo(() => {
    const filtered = invoices.filter(
      (invoice) => {
        const matchesSearch =
          invoice.internal_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invoice.supplier_invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invoice.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invoice.partner?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invoice.warehouse?.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDateFrom = !dateFrom || invoice.invoice_date >= dateFrom;
        const matchesDateTo = !dateTo || invoice.invoice_date <= dateTo;
        return matchesSearch && matchesDateFrom && matchesDateTo;
      }
    );
    return sortItems(filtered, (item, col) => {
      switch (col) {
        case 'internal_number': return item.internal_number;
        case 'supplier_invoice_number': return item.supplier_invoice_number;
        case 'invoice_date': return item.invoice_date;
        case 'supplier_name': return item.supplier_name || item.partner?.name || '';
        case 'warehouse': return item.warehouse?.name || '';
        case 'supplier_is_in_pdv': return item.supplier_is_in_pdv;
        case 'total_amount': return item.total_amount;
        case 'status': return item.status;
        default: return '';
      }
    });
  }, [invoices, searchTerm, dateFrom, dateTo, sortItems]);

  const handleCreate = () => {
    setSelectedInvoice(null);
    setHeaderDialogOpen(true);
  };

  const handleEdit = (invoice: GoodsPurchaseInvoice) => {
    setSelectedInvoice(invoice);
    setHeaderDialogOpen(true);
  };

  const handleView = (invoice: GoodsPurchaseInvoice) => {
    navigate(`/nabavka/ulazne-fakture-roba/${invoice.id}`);
  };

  const handleDeleteClick = (invoice: GoodsPurchaseInvoice) => {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (invoiceToDelete) {
      await deleteInvoice.mutateAsync(invoiceToDelete.id);
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const handlePostClick = (invoice: GoodsPurchaseInvoice) => {
    setInvoiceToPost(invoice);
    setPostDialogOpen(true);
  };

  const handlePostConfirm = async () => {
    if (invoiceToPost) {
      await postInvoice.mutateAsync(invoiceToPost.id);
      setPostDialogOpen(false);
      setInvoiceToPost(null);
    }
  };

  const handleUnpostClick = (invoice: GoodsPurchaseInvoice) => {
    setInvoiceToUnpost(invoice);
    setUnpostDialogOpen(true);
  };

  const handleUnpostConfirm = async () => {
    if (invoiceToUnpost) {
      await unpostInvoice.mutateAsync(invoiceToUnpost.id);
      setUnpostDialogOpen(false);
      setInvoiceToUnpost(null);
    }
  };

  const handleNewInvoiceSaved = (invoice: GoodsPurchaseInvoice) => {
    navigate(`/nabavka/ulazne-fakture-roba/${invoice.id}`);
  };

  const handleDownloadPdf = async (invoice: GoodsPurchaseInvoice) => {
    if (!selectedCompany?.id) return;
    try {
      const [{ data: items }, { data: company }] = await Promise.all([
        supabase
          .from("goods_purchase_invoice_items")
          .select("*")
          .eq("goods_purchase_invoice_id", invoice.id)
          .order("item_order"),
        supabase
          .from("companies")
          .select("name, address, city, postal_code, pib, mb, phone, email")
          .eq("id", selectedCompany.id)
          .single(),
      ]);
      if (!items || !company) throw new Error("Greška pri učitavanju podataka");
      await generateGoodsPurchaseInvoicePdf(invoice, items as any, company);
    } catch (err: any) {
      toast.error(err.message || "Greška pri generisanju PDF-a");
    }
  };

  return (
    <MainLayout title="Ulazne fakture za robu">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
           <div>
            <h1 className="text-2xl font-bold text-foreground">Ulazne fakture za robu</h1>
            <p className="text-muted-foreground">Fakture za robu, repromaterijal i rezervne delove</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportGoodsPurchaseInvoicesToExcel(filteredInvoices, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportGoodsPurchaseInvoicesToPdf(filteredInvoices, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printGoodsPurchaseInvoices(filteredInvoices, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova UF za robu
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Pretraži po broju, dobavljaču ili magacinu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoComplete="off"
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

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Interni broj</TableHead>
                <TableHead>Broj fakture dobavljača</TableHead>
                <TableHead>Datum fakture</TableHead>
                <TableHead>Dobavljač</TableHead>
                <TableHead>Magacin</TableHead>
                <TableHead>PDV</TableHead>
                <TableHead className="text-right">Ukupno</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "Nema rezultata pretrage" : "Nema ulaznih faktura za robu."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    className="relative cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <a
                        href={`/nabavka/ulazne-fakture-roba/${invoice.id}`}
                        onClick={(e) => { e.preventDefault(); handleView(invoice); }}
                        className="absolute inset-0 z-0"
                        aria-hidden="true"
                      />
                      <span className="relative z-[1] flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{invoice.internal_number}</span>
                      </span>
                    </TableCell>
                    <TableCell>{invoice.supplier_invoice_number}</TableCell>
                    <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.supplier_name || invoice.partner?.name}</div>
                        <div className="text-xs text-muted-foreground">{invoice.supplier_pib}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{invoice.warehouse?.code}</div>
                        <div className="text-xs text-muted-foreground">{invoice.warehouse?.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={invoice.supplier_is_in_pdv ? "default" : "outline"}>
                        {invoice.supplier_is_in_pdv ? "Da" : "Ne"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(invoice.total_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[invoice.status]}>
                        {statusLabels[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="relative z-10" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a
                              href={`/nabavka/ulazne-fakture-roba/${invoice.id}`}
                              onClick={(e) => { e.preventDefault(); handleView(invoice); }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Prikaži
                            </a>
                          </DropdownMenuItem>
                          {invoice.status === "draft" && (
                            <DropdownMenuItem onClick={() => handlePostClick(invoice)}>
                              <BookCheck className="h-4 w-4 mr-2" />
                              Proknjiži
                            </DropdownMenuItem>
                          )}
                          {invoice.status === "posted" && (
                            <DropdownMenuItem onClick={() => handleUnpostClick(invoice)}>
                              <Undo2 className="h-4 w-4 mr-2" />
                              Poništi knjiženje
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDownloadPdf(invoice)}>
                            <FileDown className="h-4 w-4 mr-2" />
                            PDF
                          </DropdownMenuItem>
                          {invoice.status === "draft" && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(invoice)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Obriši
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

      <GoodsPurchaseInvoiceHeaderDialog
        open={headerDialogOpen}
        onOpenChange={setHeaderDialogOpen}
        invoice={selectedInvoice}
        onSaved={handleNewInvoiceSaved}
      />



      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje ulazne fakture</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete ulaznu fakturu{" "}
              <strong>{invoiceToDelete?.internal_number}</strong>?
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

      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjiženje ulazne fakture</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da proknjižite ulaznu fakturu{" "}
              <strong>{invoiceToPost?.internal_number}</strong>? 
              Proknjižena faktura se više ne može menjati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handlePostConfirm}>
              Proknjiži
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unpostDialogOpen} onOpenChange={setUnpostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništavanje knjiženja</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje fakture{" "}
              <strong>{invoiceToUnpost?.internal_number}</strong>?
              Ova akcija će obrisati sva povezana knjiženja iz glavne knjige.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnpostConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Poništi knjiženje
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
