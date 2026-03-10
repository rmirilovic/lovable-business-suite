import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useAuth } from "@/contexts/AuthContext";
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
import { Plus, Search, MoreHorizontal, Trash2, Eye, FileText, BookCheck, Undo2, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { useServicePurchaseInvoices, ServicePurchaseInvoice } from "@/hooks/useServicePurchaseInvoices";
import { ServicePurchaseInvoiceHeaderDialog } from "@/components/nabavka/ServicePurchaseInvoiceHeaderDialog";
import { ServicePurchaseInvoiceDetailDialog } from "@/components/nabavka/ServicePurchaseInvoiceDetailDialog";
import { formatNumber, formatDate } from "@/lib/formatting";
import { generateServicePurchaseInvoicePdf } from "@/lib/servicePurchaseInvoicePdfGenerator";
import { toast } from "sonner";
import {
  exportServicePurchaseInvoicesToExcel,
  exportServicePurchaseInvoicesToPdf,
  printServicePurchaseInvoices,
} from "@/lib/servicePurchaseInvoiceListExportUtils";

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

export default function UlazneFaktureUsluge() {
  const { invoices, isLoading, deleteInvoice, postInvoice, unpostInvoice } = useServicePurchaseInvoices();
  const navigate = useNavigate();
  const { user, selectedCompany } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ServicePurchaseInvoice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<ServicePurchaseInvoice | null>(null);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [invoiceToPost, setInvoiceToPost] = useState<ServicePurchaseInvoice | null>(null);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);
  const [invoiceToUnpost, setInvoiceToUnpost] = useState<ServicePurchaseInvoice | null>(null);
  const [userAccessLevel, setUserAccessLevel] = useState<string | null>(null);

  // Check user access level for unpost permission
  useEffect(() => {
    if (!user?.id || !selectedCompany?.id) return;
    
    const checkAccess = async () => {
      const { data } = await supabase.rpc("get_user_access_level", {
        _user_id: user.id,
        _company_id: selectedCompany.id,
        _module_code: "nabavka.ulazne_fakture_usluge",
        _org_unit_id: null,
      });
      setUserAccessLevel(data);
    };
    
    checkAccess();
  }, [user?.id, selectedCompany?.id]);

  const canUnpost = userAccessLevel === "admin";

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
          invoice.partner?.name.toLowerCase().includes(searchTerm.toLowerCase());
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
        case 'supplier_pib': return item.supplier_pib || '';
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

  const handleEdit = (invoice: ServicePurchaseInvoice) => {
    setSelectedInvoice(invoice);
    setHeaderDialogOpen(true);
  };

  const handleView = (invoice: ServicePurchaseInvoice) => {
    navigate(`/nabavka/ulazne-fakture-usluge/${invoice.id}`);
  };

  const handleDeleteClick = (invoice: ServicePurchaseInvoice) => {
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

  const handlePostClick = (invoice: ServicePurchaseInvoice) => {
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

  const handleNewInvoiceSaved = (invoice: ServicePurchaseInvoice) => {
    navigate(`/nabavka/ulazne-fakture-usluge/${invoice.id}`);
  };

  const handleUnpostClick = (invoice: ServicePurchaseInvoice) => {
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

  const handleDownloadPdf = async (invoice: ServicePurchaseInvoice) => {
    if (!selectedCompany?.id) return;
    try {
      const [{ data: items }, { data: company }] = await Promise.all([
        supabase
          .from("service_purchase_invoice_items")
          .select("*")
          .eq("service_purchase_invoice_id", invoice.id)
          .order("item_order"),
        supabase
          .from("companies")
          .select("name, address, city, postal_code, pib, mb, phone, email")
          .eq("id", selectedCompany.id)
          .single(),
      ]);
      if (!items || !company) throw new Error("Greška pri učitavanju podataka");
      await generateServicePurchaseInvoicePdf(invoice, items as any, company);
    } catch (err: any) {
      toast.error(err.message || "Greška pri generisanju PDF-a");
    }
  };

  return (
    <MainLayout title="Ulazne fakture za usluge">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ulazne fakture za usluge</h1>
            <p className="text-muted-foreground">Fakture za usluge i troškove od dobavljača</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportServicePurchaseInvoicesToExcel(filteredInvoices, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportServicePurchaseInvoicesToPdf(filteredInvoices, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printServicePurchaseInvoices(filteredInvoices, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova UF za usluge
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
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
                <TableHead>PIB</TableHead>
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
                    {searchTerm ? "Nema rezultata pretrage" : "Nema ulaznih faktura za usluge."}
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
                        href={`/nabavka/ulazne-fakture-usluge/${invoice.id}`}
                        onClick={(e) => { e.preventDefault(); handleView(invoice); }}
                        className="absolute inset-0 z-0"
                        aria-hidden="true"
                      />
                      <span className="relative z-[1] flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{invoice.internal_number}</span>
                      </span>
                    </TableCell>
                    <TableCell>{invoice.supplier_invoice_number}</TableCell>
                    <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.supplier_name || invoice.partner?.name}</div>
                        <div className="text-xs text-muted-foreground">{invoice.partner?.code}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{invoice.supplier_pib}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.supplier_is_in_pdv ? "default" : "outline"}>
                        {invoice.supplier_is_in_pdv ? "Da" : "Ne"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(invoice.total_amount)}
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
                              href={`/nabavka/ulazne-fakture-usluge/${invoice.id}`}
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
                          {invoice.status === "posted" && canUnpost && (
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

      <ServicePurchaseInvoiceHeaderDialog
        open={headerDialogOpen}
        onOpenChange={setHeaderDialogOpen}
        invoice={selectedInvoice}
        onSaved={handleNewInvoiceSaved}
      />

      <ServicePurchaseInvoiceDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        invoice={selectedInvoice}
        onEdit={() => {
          setDetailDialogOpen(false);
          handleEdit(selectedInvoice!);
        }}
        onPost={() => handlePostClick(selectedInvoice!)}
        onUnpost={() => handleUnpostClick(selectedInvoice!)}
        canUnpost={canUnpost}
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
              Da li ste sigurni da želite da poništite knjiženje ulazne fakture{" "}
              <strong>{invoiceToUnpost?.internal_number}</strong>?
              <br /><br />
              Ovo će obrisati povezani nalog za knjiženje iz Glavne knjige i vratiti dokument u status "Nacrt" za izmene.
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
