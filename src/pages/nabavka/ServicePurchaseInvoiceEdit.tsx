import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Pencil, BookCheck, FileText, FileSpreadsheet, Printer, Undo2, ArrowLeft, RefreshCw, History, Eye } from "lucide-react";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import {
  ServicePurchaseInvoice,
  useServicePurchaseInvoiceItems,
  useServicePurchaseInvoices,
} from "@/hooks/useServicePurchaseInvoices";
import { ServicePurchaseInvoiceItemsEditor } from "@/components/nabavka/ServicePurchaseInvoiceItemsEditor";
import { ServicePurchaseInvoiceHeaderDialog } from "@/components/nabavka/ServicePurchaseInvoiceHeaderDialog";
import { formatNumber, formatDate, formatPrice } from "@/lib/formatting";
import { generateServicePurchaseInvoicePdf } from "@/lib/servicePurchaseInvoicePdfGenerator";
import { exportServicePurchaseInvoiceToExcel } from "@/lib/servicePurchaseInvoiceExcelExport";
import { isForeignCurrency } from "@/lib/currencies";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentLock } from "@/hooks/useDocumentLock";
import { toast } from "sonner";
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

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjiženo",
  cancelled: "Stornirano",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  posted: "default",
  cancelled: "destructive",
};

export default function ServicePurchaseInvoiceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, user } = useAuth();
  
  const [invoice, setInvoice] = useState<ServicePurchaseInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [userAccessLevel, setUserAccessLevel] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState<{
    name: string;
    address?: string | null;
    city?: string | null;
    postal_code?: string | null;
    pib?: string | null;
    mb?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null>(null);

  const { items, isLoading: itemsLoading, addItem, updateItem, deleteItem } = useServicePurchaseInvoiceItems(id || null);
  const { updateTotals, postInvoice, unpostInvoice } = useServicePurchaseInvoices();
  
  // Optimistic locking
  const { checkLock, updateLockTimestamp } = useDocumentLock({
    tableName: "service_purchase_invoices",
    documentId: id || null,
    initialUpdatedAt: invoice?.updated_at || null,
    onConflict: () => fetchInvoice(), // Refresh on conflict
  });

  const canUnpost = userAccessLevel === "admin";

  // Fetch invoice data
  const fetchInvoice = async () => {
    if (!id) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from("service_purchase_invoices")
      .select(`
        *,
        partner:partners(id, name, code, pib, mb, is_in_pdv, address, city, postal_code),
        org_unit:organizational_units(id, code, name)
      `)
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Greška pri učitavanju dokumenta");
      navigate("/nabavka/ulazne-fakture-usluge");
      return;
    }

    setInvoice(data as ServicePurchaseInvoice);
    updateLockTimestamp(data.updated_at);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  // Check user access level
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

  // Fetch company data for PDF
  useEffect(() => {
    if (!selectedCompany?.id) return;
    
    const fetchCompanyData = async () => {
      const { data } = await supabase
        .from("companies")
        .select("name, address, city, postal_code, pib, mb, phone, email")
        .eq("id", selectedCompany.id)
        .single();
      if (data) setCompanyData(data);
    };
    
    fetchCompanyData();
  }, [selectedCompany?.id]);

  // Recalculate totals when items change
  useEffect(() => {
    if (!invoice || invoice.status !== "draft") return;
    
    const subtotal = items.reduce((sum, item) => sum + item.line_subtotal, 0);
    const vatAmount = items.reduce((sum, item) => sum + item.line_vat, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);

    const approxEqual = (a: number, b: number) => Math.abs(a - b) < 0.005;

    if (
      !approxEqual(subtotal, invoice.subtotal) ||
      !approxEqual(vatAmount, invoice.vat_amount) ||
      !approxEqual(totalAmount, invoice.total_amount)
    ) {
      updateTotals.mutateAsync({
        invoiceId: invoice.id,
        subtotal,
        vat_amount: vatAmount,
        total_amount: totalAmount,
      }).then((result) => {
        if (result?.updated_at) {
          updateLockTimestamp(result.updated_at);
          setInvoice(prev => prev ? {
            ...prev,
            subtotal,
            vat_amount: vatAmount,
            total_amount: totalAmount,
            updated_at: result.updated_at,
          } : null);
        }
      });
    }
  }, [items, invoice?.id, invoice?.status]);

  const handleDownloadPdf = async () => {
    if (!invoice || !companyData) return;
    setIsPdfLoading(true);
    try {
      await generateServicePurchaseInvoicePdf(invoice, items, companyData);
    } finally {
      setIsPdfLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!invoice || !companyData) return;
    setIsPdfLoading(true);
    try {
      await generateServicePurchaseInvoicePdf(invoice, items, companyData, { print: true });
    } finally {
      setIsPdfLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!invoice) return;
    exportServicePurchaseInvoiceToExcel(invoice, items);
  };

  const handlePostConfirm = async () => {
    if (!invoice) return;
    
    const canProceed = await checkLock();
    if (!canProceed) return;
    
    await postInvoice.mutateAsync(invoice.id);
    setPostDialogOpen(false);
    fetchInvoice(); // Refresh to get new status
  };

  const handleUnpostConfirm = async () => {
    if (!invoice) return;
    
    await unpostInvoice.mutateAsync(invoice.id);
    setUnpostDialogOpen(false);
    fetchInvoice(); // Refresh to get new status
  };

  const handleHeaderSaved = () => {
    fetchInvoice(); // Refresh after header edit
  };

  if (isLoading || !selectedCompany || !selectedYear) {
    return (
      <MainLayout title="Učitavanje...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!invoice) {
    return (
      <MainLayout title="Dokument nije pronađen">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Dokument nije pronađen ili nemate pristup.</p>
          <Button onClick={() => navigate("/nabavka/ulazne-fakture-usluge")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Nazad na listu
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isDraft = invoice.status === "draft";
  const isPosted = invoice.status === "posted";

  return (
    <MainLayout title={`UF za usluge: ${invoice.internal_number}`}>
      <div className="space-y-4">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/nabavka/ulazne-fakture-usluge")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Nazad
            </Button>
            <h1 className="text-xl font-semibold">{invoice.internal_number}</h1>
            <Badge variant={statusVariants[invoice.status]}>
              {statusLabels[invoice.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchInvoice} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isPdfLoading || !companyData}>
              <FileText className="h-4 w-4 mr-2" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPdfLoading || !companyData}>
              <Printer className="h-4 w-4 mr-2" />Štampa
            </Button>
            {isDraft ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
                </Button>
                <Button size="sm" onClick={() => setPostDialogOpen(true)}>
                  <BookCheck className="h-4 w-4 mr-2" />Proknjiži
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}>
                <Eye className="h-4 w-4 mr-2" />Prikaži zaglavlje
              </Button>
            )}
            {isPosted && canUnpost && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => setUnpostDialogOpen(true)}>
                <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
              </Button>
            )}
          </div>
        </div>

        {/* Header info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
          <div>
            <div className="text-muted-foreground">Broj fakture dobavljača</div>
            <div className="font-medium">{invoice.supplier_invoice_number}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Datum fakture</div>
            <div className="font-medium">{formatDate(invoice.invoice_date)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Datum prijema</div>
            <div className="font-medium">{formatDate(invoice.receipt_date)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Datum valute</div>
            <div className="font-medium">{invoice.due_date ? formatDate(invoice.due_date) : "-"}</div>
          </div>
        </div>

        {/* Currency info */}
        {isForeignCurrency(invoice.currency) && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm p-3 border border-dashed rounded-lg">
            <div>
              <div className="text-muted-foreground">Valuta</div>
              <div className="font-medium">{invoice.currency}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Kurs</div>
              <div className="font-medium">1 {invoice.currency} = {formatNumber(invoice.exchange_rate, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} RSD</div>
            </div>
          </div>
        )}

        {/* Supplier info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="col-span-2">
            <div className="text-muted-foreground">Dobavljač</div>
            <div className="font-medium">
              {invoice.partner?.code && <span className="text-muted-foreground mr-1">[{invoice.partner.code}]</span>}
              {invoice.supplier_name || invoice.partner?.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {invoice.supplier_address}, {invoice.supplier_postal_code} {invoice.supplier_city}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">PIB</div>
            <div className="font-medium">{invoice.supplier_pib || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Matični broj</div>
            <div className="font-medium">{invoice.supplier_mb || "-"}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">U sistemu PDV-a</div>
            <Badge variant={invoice.supplier_is_in_pdv ? "default" : "outline"}>
              {invoice.supplier_is_in_pdv ? "Da" : "Ne"}
            </Badge>
          </div>
          <div>
            <div className="text-muted-foreground">Bez obračuna PDV (8v.2)</div>
            <Badge variant={invoice.vat_calculation_type === "no_vat_8v2" ? "default" : "outline"}>
              {invoice.vat_calculation_type === "no_vat_8v2" ? "Da" : "Ne"}
            </Badge>
          </div>
          <div>
            <div className="text-muted-foreground">Interni obračun PDV</div>
            <Badge variant={invoice.has_internal_vat_calculation ? "default" : "outline"}>
              {invoice.has_internal_vat_calculation ? "Da" : "Ne"}
            </Badge>
          </div>
          {invoice.org_unit && (
            <div>
              <div className="text-muted-foreground">Organizaciona jedinica</div>
              <div className="font-medium">{invoice.org_unit.code} - {invoice.org_unit.name}</div>
            </div>
          )}
        </div>

        {/* Payment info */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm bg-muted/10 p-3 rounded-lg border border-dashed">
          <div>
            <div className="text-muted-foreground">Valuta plaćanja</div>
            <div className="font-medium">{invoice.due_date ? formatDate(invoice.due_date) : "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Tekući račun za uplatu</div>
            <div className="font-medium">{invoice.supplier_bank_account || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Poziv na broj</div>
            <div className="font-medium">{invoice.payment_reference || "-"}</div>
          </div>
        </div>

        <Separator />

        {/* Items editor */}
        <ServicePurchaseInvoiceItemsEditor
          invoiceId={invoice.id}
          items={items}
          isLoading={itemsLoading}
          isEditable={isDraft}
          supplierIsInPdv={invoice.supplier_is_in_pdv}
          currency={invoice.currency || "RSD"}
          exchangeRate={invoice.exchange_rate || 1}
          addItem={addItem}
          updateItem={updateItem}
          deleteItem={deleteItem}
        />

        <Separator />

        {/* Totals */}
        <div className="flex justify-end">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">Osnovica:</span>
              <span className="font-medium">{formatPrice(invoice.subtotal)} RSD</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">PDV:</span>
              <span className="font-medium">{formatPrice(invoice.vat_amount)} RSD</span>
            </div>
            <Separator />
            <div className="flex justify-between gap-8 text-base">
              <span className="font-medium">Ukupno:</span>
              <span className="font-bold">{formatPrice(invoice.total_amount)} RSD</span>
            </div>
            {isForeignCurrency(invoice.currency) && invoice.exchange_rate > 0 && (
              <>
                <Separator />
                <div className="flex justify-between gap-8">
                  <span className="text-muted-foreground">Osnovica ({invoice.currency}):</span>
                  <span className="font-medium">{formatPrice(invoice.subtotal / invoice.exchange_rate)} {invoice.currency}</span>
                </div>
                <div className="flex justify-between gap-8">
                  <span className="text-muted-foreground">PDV ({invoice.currency}):</span>
                  <span className="font-medium">{formatPrice(invoice.vat_amount / invoice.exchange_rate)} {invoice.currency}</span>
                </div>
                <Separator />
                <div className="flex justify-between gap-8 text-base">
                  <span className="font-medium">Ukupno ({invoice.currency}):</span>
                  <span className="font-bold">{formatPrice(invoice.total_amount / invoice.exchange_rate)} {invoice.currency}</span>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Dialogs */}
      <ServicePurchaseInvoiceHeaderDialog
        open={headerDialogOpen}
        onOpenChange={setHeaderDialogOpen}
        invoice={invoice}
        onSaved={handleHeaderSaved}
        readOnly={!isDraft}
      />

      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjiženje ulazne fakture</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da proknjižite ulaznu fakturu{" "}
              <strong>{invoice.internal_number}</strong>? 
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
              <strong>{invoice.internal_number}</strong>?
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
      {invoice && (
        <DocumentHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} documentId={invoice.id} documentName={invoice.internal_number} documentType="service_purchase_invoice" />
      )}
    </MainLayout>
  );
}
