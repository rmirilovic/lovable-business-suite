import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Search, MoreHorizontal, Trash2, Eye, BookCheck, Undo2, FileText, FileSpreadsheet, Printer } from "lucide-react";
import { useAdvancePurchaseInvoices, AdvancePurchaseInvoice } from "@/hooks/useAdvancePurchaseInvoices";
import { AdvancePurchaseInvoiceHeaderDialog } from "@/components/nabavka/AdvancePurchaseInvoiceHeaderDialog";
import { formatNumber, formatDate } from "@/lib/formatting";
import { toast } from "sonner";
import {
  exportAdvancePurchaseInvoicesToExcel,
  exportAdvancePurchaseInvoicesToPdf,
  printAdvancePurchaseInvoices,
} from "@/lib/advancePurchaseInvoiceListExportUtils";

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

export default function UlazneFaktureAvansi() {
  const { invoices, isLoading, deleteInvoice, postInvoice, unpostInvoice } = useAdvancePurchaseInvoices();
  const navigate = useNavigate();
  const { user, selectedCompany } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<AdvancePurchaseInvoice | null>(null);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [invoiceToPost, setInvoiceToPost] = useState<AdvancePurchaseInvoice | null>(null);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);
  const [invoiceToUnpost, setInvoiceToUnpost] = useState<AdvancePurchaseInvoice | null>(null);
  const [userAccessLevel, setUserAccessLevel] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !selectedCompany?.id) return;
    const checkAccess = async () => {
      const { data } = await supabase.rpc("get_user_access_level", {
        _user_id: user.id,
        _company_id: selectedCompany.id,
        _module_code: "nabavka.ulazne_fakture",
        _org_unit_id: null,
      });
      setUserAccessLevel(data);
    };
    checkAccess();
  }, [user?.id, selectedCompany?.id]);

  const canUnpost = userAccessLevel === "admin";

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.internal_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.supplier_invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.partner?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDateFrom = !dateFrom || inv.invoice_date >= dateFrom;
    const matchesDateTo = !dateTo || inv.invoice_date <= dateTo;
    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const handleView = (inv: AdvancePurchaseInvoice) => {
    navigate(`/nabavka/ulazne-fakture-avansi/${inv.id}`);
  };

  const handleNewSaved = (inv: AdvancePurchaseInvoice) => {
    navigate(`/nabavka/ulazne-fakture-avansi/${inv.id}`);
  };

  return (
    <MainLayout title="UF za plaćene avanse">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ulazne fakture za plaćene avanse</h1>
            <p className="text-muted-foreground">Fakture za avanse plaćene dobavljačima</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportAdvancePurchaseInvoicesToExcel(filteredInvoices, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportAdvancePurchaseInvoicesToPdf(filteredInvoices, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printAdvancePurchaseInvoices(filteredInvoices, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
            <Button onClick={() => setHeaderDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Nova UFA
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input placeholder="Pretraži po broju ili dobavljaču..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" autoComplete="off" />
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
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell></TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{searchTerm ? "Nema rezultata pretrage" : "Nema UFA dokumenata."}</TableCell></TableRow>
              ) : (
                filteredInvoices.map((inv) => (
                  <TableRow key={inv.id} className="relative cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <a href={`/nabavka/ulazne-fakture-avansi/${inv.id}`} onClick={(e) => { e.preventDefault(); handleView(inv); }} className="absolute inset-0 z-0" aria-hidden="true" />
                      <span className="relative z-[1] flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{inv.internal_number}</span>
                      </span>
                    </TableCell>
                    <TableCell>{inv.supplier_invoice_number}</TableCell>
                    <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{inv.supplier_name || inv.partner?.name}</div>
                        <div className="text-xs text-muted-foreground">{inv.partner?.code}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{inv.supplier_pib}</TableCell>
                    <TableCell>
                      <Badge variant={inv.supplier_is_in_pdv ? "default" : "outline"}>{inv.supplier_is_in_pdv ? "Da" : "Ne"}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatNumber(inv.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[inv.status]}>{statusLabels[inv.status]}</Badge>
                    </TableCell>
                    <TableCell className="relative z-10" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a href={`/nabavka/ulazne-fakture-avansi/${inv.id}`} onClick={(e) => { e.preventDefault(); handleView(inv); }}>
                              <Eye className="h-4 w-4 mr-2" />Prikaži
                            </a>
                          </DropdownMenuItem>
                          {inv.status === "draft" && (
                            <DropdownMenuItem onClick={() => { setInvoiceToPost(inv); setPostDialogOpen(true); }}>
                              <BookCheck className="h-4 w-4 mr-2" />Proknjiži
                            </DropdownMenuItem>
                          )}
                          {inv.status === "posted" && canUnpost && (
                            <DropdownMenuItem onClick={() => { setInvoiceToUnpost(inv); setUnpostDialogOpen(true); }}>
                              <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
                            </DropdownMenuItem>
                          )}
                          {inv.status === "draft" && (
                            <DropdownMenuItem onClick={() => { setInvoiceToDelete(inv); setDeleteDialogOpen(true); }} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />Obriši
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

      <AdvancePurchaseInvoiceHeaderDialog open={headerDialogOpen} onOpenChange={setHeaderDialogOpen} invoice={null} onSaved={handleNewSaved} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje UFA</AlertDialogTitle>
            <AlertDialogDescription>Da li ste sigurni da želite da obrišete UFA <strong>{invoiceToDelete?.internal_number}</strong>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (invoiceToDelete) { await deleteInvoice.mutateAsync(invoiceToDelete.id); setDeleteDialogOpen(false); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Obriši</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjiženje UFA</AlertDialogTitle>
            <AlertDialogDescription>Da li ste sigurni da želite da proknjižite UFA <strong>{invoiceToPost?.internal_number}</strong>? Proknjižena faktura se više ne može menjati.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (invoiceToPost) { await postInvoice.mutateAsync(invoiceToPost.id); setPostDialogOpen(false); } }}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unpostDialogOpen} onOpenChange={setUnpostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništavanje knjiženja</AlertDialogTitle>
            <AlertDialogDescription>Da li ste sigurni da želite da poništite knjiženje UFA <strong>{invoiceToUnpost?.internal_number}</strong>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (invoiceToUnpost) { await unpostInvoice.mutateAsync(invoiceToUnpost.id); setUnpostDialogOpen(false); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Poništi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
