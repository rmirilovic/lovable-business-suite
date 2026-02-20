import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Pencil, CheckCircle, ArrowLeft, RefreshCw, History } from "lucide-react";
import { Invoice, useInvoices } from "@/hooks/useInvoices";
import { InvoiceItemsEditor } from "@/components/prodaja/InvoiceItemsEditor";
import { InvoiceDialog } from "@/components/prodaja/InvoiceDialog";
import { formatDate, formatPrice } from "@/lib/formatting";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentLock } from "@/hooks/useDocumentLock";
import { toast } from "sonner";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
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

export default function InvoiceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear } = useAuth();
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [localTotals, setLocalTotals] = useState({ subtotal: 0, vat_amount: 0, total_amount: 0 });
  const [historyOpen, setHistoryOpen] = useState(false);

  const { postInvoice, updateInvoice } = useInvoices();
  
  // Optimistic locking
  const { checkLock, updateLockTimestamp } = useDocumentLock({
    tableName: "invoices",
    documentId: id || null,
    initialUpdatedAt: invoice?.updated_at || null,
    onConflict: () => fetchInvoice(),
  });

  // Fetch invoice data
  const fetchInvoice = async () => {
    if (!id) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        *,
        partner:partners(id, name, code)
      `)
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Greška pri učitavanju dokumenta");
      navigate("/prodaja/fakture");
      return;
    }

    setInvoice(data as Invoice);
    updateLockTimestamp(data.updated_at);
    setLocalTotals({
      subtotal: data.subtotal,
      vat_amount: data.vat_amount,
      total_amount: data.total_amount,
    });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const handleTotalsChange = useCallback((subtotal: number, vatAmount: number, totalAmount: number) => {
    setLocalTotals({ subtotal, vat_amount: vatAmount, total_amount: totalAmount });
  }, []);

  const handlePostConfirm = async () => {
    if (!invoice) return;
    
    const canProceed = await checkLock();
    if (!canProceed) return;
    
    await postInvoice.mutateAsync(invoice.id);
    setPostDialogOpen(false);
    fetchInvoice();
  };

  const handleHeaderSaved = async () => {
    setHeaderDialogOpen(false);
    fetchInvoice();
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
          <Button onClick={() => navigate("/prodaja/fakture")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Nazad na listu
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isDraft = invoice.status === "draft";

  return (
    <MainLayout title={`Faktura: ${invoice.invoice_number}`}>
      <div className="space-y-4">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/prodaja/fakture")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Nazad
            </Button>
            <h1 className="text-xl font-semibold">{invoice.invoice_number}</h1>
            <Badge className={STATUS_COLORS[invoice.status]}>
              {STATUS_LABELS[invoice.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchInvoice} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isDraft && (
              <>
                <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
                </Button>
                <Button size="sm" onClick={() => setPostDialogOpen(true)}>
                  <CheckCircle className="h-4 w-4 mr-2" />Proknjiži
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Header info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
          <div>
            <div className="text-muted-foreground">Datum fakture</div>
            <div className="font-medium">{formatDate(invoice.invoice_date)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Valuta</div>
            <div className="font-medium">{invoice.due_date ? formatDate(invoice.due_date) : "-"}</div>
          </div>
          <div className="col-span-2">
            <div className="text-muted-foreground">Kupac</div>
            <div className="font-medium">{invoice.partner?.name}</div>
            <div className="text-xs text-muted-foreground">{invoice.partner?.code}</div>
          </div>
        </div>

        <Separator />

        {/* Items editor */}
        <InvoiceItemsEditor
          invoiceId={invoice.id}
          readOnly={!isDraft}
          onTotalsChange={handleTotalsChange}
        />

        <Separator />

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Osnovica:</span>
              <span className="font-medium">{formatPrice(localTotals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PDV:</span>
              <span className="font-medium">{formatPrice(localTotals.vat_amount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base">
              <span className="font-medium">Ukupno:</span>
              <span className="font-bold">{formatPrice(localTotals.total_amount)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Dialogs */}
      <InvoiceDialog
        open={headerDialogOpen}
        onOpenChange={setHeaderDialogOpen}
        invoice={invoice}
        onSave={handleHeaderSaved}
        isLoading={false}
      />

      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjiženje fakture</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da proknjižite fakturu{" "}
              <strong>{invoice.invoice_number}</strong>? 
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

      {invoice && (
        <DocumentHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          documentId={invoice.id}
          documentName={invoice.invoice_number}
          documentType="invoice"
        />
      )}
    </MainLayout>
  );
}
