import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, ArrowLeft, RefreshCw, History, Pencil, Eye } from "lucide-react";
import { Invoice } from "@/hooks/useInvoices";
import { useInvoiceMutations } from "@/hooks/useInvoiceMutations";
import { InvoiceItemsEditor } from "@/components/prodaja/InvoiceItemsEditor";
import { InvoiceHeaderDialog } from "@/components/prodaja/InvoiceHeaderDialog";
import { formatDate, formatPrice } from "@/lib/formatting";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
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

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  posted: { label: "Proknjižena", variant: "default" },
  cancelled: { label: "Stornirana", variant: "destructive" },
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

  const { postInvoice } = useInvoiceMutations();
  const { units } = useOrganizationalUnits(selectedCompany?.id);
  
  const { checkLock, updateLockTimestamp } = useDocumentLock({
    tableName: "invoices",
    documentId: id || null,
    initialUpdatedAt: invoice?.updated_at || null,
    onConflict: () => fetchInvoice(),
  });

  const fetchInvoice = async () => {
    if (!id) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        *,
        partner:partners(id, name, code, address, city, postal_code, pib, mb)
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
  const status = STATUS_BADGES[invoice.status] || STATUS_BADGES.draft;

  return (
    <MainLayout title={`Faktura: ${invoice.invoice_number}`}>
      <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/prodaja/fakture")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Nazad
            </Button>
            <h1 className="text-xl font-semibold">{invoice.invoice_number}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchInvoice} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isDraft ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
                </Button>
                <Button size="sm" onClick={() => setPostDialogOpen(true)}>
                  <CheckCircle className="h-4 w-4 mr-2" />Proknjiži
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}>
                <Eye className="h-4 w-4 mr-2" />Prikaži zaglavlje
              </Button>
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
            <div className="text-muted-foreground">Datum valute</div>
            <div className="font-medium">{invoice.due_date ? formatDate(invoice.due_date) : "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Org. jedinica</div>
            <div className="font-medium">
              {invoice.org_unit_id
                ? units.find((u) => u.id === invoice.org_unit_id)?.name || "-"
                : "-"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Fakturu sastavio</div>
            <div className="font-medium">{invoice.composed_by || "-"}</div>
          </div>
        </div>

        {/* Partner info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="col-span-2">
            <div className="text-muted-foreground">Kupac</div>
            <div className="font-medium">
              {invoice.partner?.code && <span className="text-muted-foreground mr-1">[{invoice.partner.code}]</span>}
              {invoice.partner_name ?? invoice.partner?.name}
            </div>
            {(invoice.partner_address ?? invoice.partner?.address) && (
              <div className="text-xs text-muted-foreground">
                {invoice.partner_address ?? invoice.partner?.address}
                {(invoice.partner_city ?? invoice.partner?.city) && `, ${invoice.partner_postal_code ?? invoice.partner?.postal_code ?? ""} ${invoice.partner_city ?? invoice.partner?.city}`}
              </div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground">PIB</div>
            <div className="font-medium">{invoice.partner_pib ?? invoice.partner?.pib ?? "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Matični broj</div>
            <div className="font-medium">{invoice.partner_mb ?? invoice.partner?.mb ?? "-"}</div>
          </div>
        </div>

        {/* Notes */}
        {(invoice.note || invoice.internal_note || invoice.header_note) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {invoice.header_note && (
              <div>
                <div className="text-muted-foreground mb-1">Napomena u zaglavlju</div>
                <div className="bg-muted p-2 rounded-md">{invoice.header_note}</div>
              </div>
            )}
            {invoice.note && (
              <div>
                <div className="text-muted-foreground mb-1">Napomena za kupca</div>
                <div className="bg-muted p-2 rounded-md">{invoice.note}</div>
              </div>
            )}
            {invoice.internal_note && (
              <div>
                <div className="text-muted-foreground mb-1">Interna napomena</div>
                <div className="bg-muted p-2 rounded-md">{invoice.internal_note}</div>
              </div>
            )}
          </div>
        )}

        {/* Source document */}
        {(invoice.source_quote_id || invoice.source_delivery_note_id) && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">Izvor: </span>
            {invoice.source_quote_id && <span className="font-medium">Ponuda</span>}
            {invoice.source_delivery_note_id && <span className="font-medium">Otpremnica</span>}
          </div>
        )}

        <Separator />

        <InvoiceItemsEditor
          invoiceId={invoice.id}
          readOnly={!isDraft}
          onTotalsChange={handleTotalsChange}
        />

        <Separator />

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

      <InvoiceHeaderDialog
        open={headerDialogOpen}
        onOpenChange={setHeaderDialogOpen}
        invoice={invoice}
        readOnly={!isDraft}
        onSaved={fetchInvoice}
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
