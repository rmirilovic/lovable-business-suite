import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, ArrowLeft, RefreshCw, History, Pencil, Eye, FileCode, FileDown, FileSpreadsheet, Printer } from "lucide-react";
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
import { generateInvoiceXml, downloadInvoiceXml } from "@/lib/invoiceXmlGenerator";
import { generateInvoicePdf, printInvoicePdf } from "@/lib/invoicePdfGenerator";
import { exportInvoiceToExcel } from "@/lib/invoiceExcelExport";
import { useBankAccounts } from "@/hooks/useBankAccounts";
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
  const location = useLocation();
  const { selectedCompany, selectedYear } = useAuth();

  const prefetchedInvoice = (location.state as { prefetchedInvoice?: Invoice } | null)?.prefetchedInvoice;
  const hasMatchingPrefetchedInvoice = !!prefetchedInvoice && prefetchedInvoice.id === id;

  const [invoice, setInvoice] = useState<Invoice | null>(hasMatchingPrefetchedInvoice ? prefetchedInvoice : null);
  const [isLoading, setIsLoading] = useState(!hasMatchingPrefetchedInvoice);
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [localTotals, setLocalTotals] = useState({
    subtotal: hasMatchingPrefetchedInvoice ? prefetchedInvoice!.subtotal : 0,
    vat_amount: hasMatchingPrefetchedInvoice ? prefetchedInvoice!.vat_amount : 0,
    total_amount: hasMatchingPrefetchedInvoice ? prefetchedInvoice!.total_amount : 0,
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [linkedDocs, setLinkedDocs] = useState<{
    deliveryNoteNumber?: string;
    deliveryOrderNumber?: string;
    quoteNumber?: string;
  }>({});

  const { postInvoice } = useInvoiceMutations();
  const { units } = useOrganizationalUnits(selectedCompany?.id);
  const { bankAccounts } = useBankAccounts(selectedCompany?.id);
  
  const { checkLock, updateLockTimestamp } = useDocumentLock({
    tableName: "invoices",
    documentId: id || null,
    initialUpdatedAt: invoice?.updated_at || null,
    onConflict: () => fetchInvoice(),
  });

  const fetchInvoice = async (showLoader = true) => {
    if (!id) return;

    if (showLoader) setIsLoading(true);
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

    // Fetch linked document numbers
    fetchLinkedDocs(data);
  };

  const fetchLinkedDocs = async (inv: any) => {
    const docs: typeof linkedDocs = {};

    // If invoice came from a delivery note
    if (inv.source_delivery_note_id) {
      const { data: dn } = await supabase
        .from("delivery_notes")
        .select("delivery_number")
        .eq("id", inv.source_delivery_note_id)
        .single();
      if (dn) docs.deliveryNoteNumber = dn.delivery_number;

      // Check if delivery note has a linked delivery order with a quote
      const { data: doData } = await supabase
        .from("delivery_orders")
        .select("order_number, source_quote_id")
        .eq("delivery_note_id", inv.source_delivery_note_id)
        .maybeSingle();
      if (doData) {
        docs.deliveryOrderNumber = doData.order_number;
        if (doData.source_quote_id) {
          const { data: q } = await supabase
            .from("quotes")
            .select("quote_number")
            .eq("id", doData.source_quote_id)
            .single();
          if (q) docs.quoteNumber = q.quote_number;
        }
      }
    }

    // If invoice came directly from a quote
    if (inv.source_quote_id && !docs.quoteNumber) {
      const { data: q } = await supabase
        .from("quotes")
        .select("quote_number")
        .eq("id", inv.source_quote_id)
        .single();
      if (q) docs.quoteNumber = q.quote_number;
    }

    setLinkedDocs(docs);
  };

  useEffect(() => {
    fetchInvoice(!hasMatchingPrefetchedInvoice);
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

  const handleExportXml = async () => {
    if (!invoice || !selectedCompany) return;

    // Fetch items and company details in parallel
    const [itemsRes, companyRes] = await Promise.all([
      supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("item_order"),
      supabase
        .from("companies")
        .select("*")
        .eq("id", selectedCompany.id)
        .single(),
    ]);

    if (itemsRes.error || !itemsRes.data?.length) {
      toast.error("Greška pri učitavanju stavki ili nema stavki za export");
      return;
    }
    if (companyRes.error || !companyRes.data) {
      toast.error("Greška pri učitavanju podataka o firmi");
      return;
    }

    const co = companyRes.data;
    const defaultBank = bankAccounts.find((b) => b.is_default && b.is_active) 
      || bankAccounts.find((b) => b.is_active);

    const xml = generateInvoiceXml({
      invoice,
      items: itemsRes.data as any,
      company: {
        name: co.name,
        pib: co.pib,
        mb: co.mb,
        address: co.address,
        city: co.city,
        postal_code: co.postal_code,
        municipality: co.municipality,
        municipality_code: co.municipality_code,
        email: co.email,
        phone: co.phone,
        responsible_person_name: co.responsible_person_name,
      },
      bankAccount: defaultBank ? { account_number: defaultBank.account_number, bank_name: defaultBank.bank_name } : null,
    });

    downloadInvoiceXml(xml, invoice.invoice_number);
    toast.success("eFaktura XML je uspešno exportovan");
  };

  const fetchInvoiceDataForExport = async () => {
    if (!invoice || !selectedCompany) return null;

    const [itemsRes, companyRes] = await Promise.all([
      supabase.from("invoice_items").select("*").eq("invoice_id", invoice.id).order("item_order"),
      supabase.from("companies").select("*").eq("id", selectedCompany.id).single(),
    ]);

    if (itemsRes.error || !itemsRes.data) { toast.error("Greška pri učitavanju stavki"); return null; }
    if (companyRes.error || !companyRes.data) { toast.error("Greška pri učitavanju podataka o firmi"); return null; }

    const co = companyRes.data;
    const defaultBank = bankAccounts.find((b) => b.is_default && b.is_active) || bankAccounts.find((b) => b.is_active);

    return {
      items: itemsRes.data as any,
      company: {
        name: co.name, address: co.address, city: co.city, postal_code: co.postal_code,
        pib: co.pib, mb: co.mb, phone: co.phone, email: co.email,
        invoice_note_1: co.invoice_note_1, invoice_note_2: co.invoice_note_2,
        logo_url: co.logo_url, logo_text: co.logo_text, responsible_person_name: co.responsible_person_name,
      },
      partner: {
        name: invoice.partner?.name || invoice.partner_name || "", code: invoice.partner?.code || "",
        address: invoice.partner?.address, city: invoice.partner?.city,
        postal_code: invoice.partner?.postal_code, pib: invoice.partner?.pib, mb: invoice.partner?.mb,
      },
      bankAccountText: defaultBank ? `${defaultBank.account_number} (${defaultBank.bank_name})` : null,
    };
  };

  const handleExportPdf = async () => {
    const data = await fetchInvoiceDataForExport();
    if (!data || !invoice) return;
    await generateInvoicePdf(invoice, data.items, data.company, data.partner, data.bankAccountText);
    toast.success("PDF je uspešno exportovan");
  };

  const handlePrint = async () => {
    const data = await fetchInvoiceDataForExport();
    if (!data || !invoice) return;
    await printInvoicePdf(invoice, data.items, data.company, data.partner, data.bankAccountText);
  };

  const handleExportExcel = async () => {
    if (!invoice) return;
    const { data: itemsData, error } = await supabase
      .from("invoice_items").select("*").eq("invoice_id", invoice.id).order("item_order");
    if (error || !itemsData) { toast.error("Greška pri učitavanju stavki"); return; }
    exportInvoiceToExcel(invoice, itemsData as any);
    toast.success("Excel je uspešno exportovan");
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
            <Button variant="ghost" size="sm" onClick={() => fetchInvoice()} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} title="PDF">
              <FileDown className="w-4 h-4 mr-2" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} title="Excel">
              <FileSpreadsheet className="w-4 h-4 mr-2" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} title="Štampa">
              <Printer className="w-4 h-4 mr-2" />Štampa
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportXml} title="eFaktura XML">
              <FileCode className="w-4 h-4 mr-2" />eFaktura XML
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

        {/* PDV category */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">PDV kategorija</div>
            <div className="font-medium">
              {invoice.tax_category_code === "S" && "S - Standardna stopa"}
              {invoice.tax_category_code === "E" && "E - Oslobođeno PDV-a"}
              {invoice.tax_category_code === "O" && "O - Van sistema PDV-a"}
              {invoice.tax_category_code === "AE" && "AE - Obrnuti obračun"}
              {!invoice.tax_category_code && "S - Standardna stopa"}
            </div>
          </div>
          {invoice.tax_category_code && invoice.tax_category_code !== "S" && invoice.tax_exemption_reason && (
            <div className="col-span-2">
              <div className="text-muted-foreground">Osnov oslobođenja</div>
              <div className="font-medium">{invoice.tax_exemption_reason}</div>
            </div>
          )}
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

        {/* Linked documents */}
        {(linkedDocs.deliveryNoteNumber || linkedDocs.deliveryOrderNumber || linkedDocs.quoteNumber) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {linkedDocs.deliveryNoteNumber && (
              <div>
                <div className="text-muted-foreground">Otpremnica</div>
                <div className="font-medium">{linkedDocs.deliveryNoteNumber}</div>
              </div>
            )}
            {linkedDocs.deliveryOrderNumber && (
              <div>
                <div className="text-muted-foreground">Nalog za isporuku</div>
                <div className="font-medium">{linkedDocs.deliveryOrderNumber}</div>
              </div>
            )}
            {linkedDocs.quoteNumber && (
              <div>
                <div className="text-muted-foreground">Ponuda</div>
                <div className="font-medium">{linkedDocs.quoteNumber}</div>
              </div>
            )}
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

        {/* Tax exemption note */}
        {invoice.tax_category_code && invoice.tax_category_code !== "S" ? (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">Poresko oslobođenje: </span>
            <span className="font-medium">
              {invoice.tax_category_code === "E" && "Oslobođeno PDV-a"}
              {invoice.tax_category_code === "O" && "Van sistema PDV-a"}
              {invoice.tax_category_code === "AE" && "Obrnuti obračun PDV-a"}
              {invoice.tax_exemption_reason && ` — ${invoice.tax_exemption_reason}`}
            </span>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Poreskog oslobođenja nema.
          </div>
        )}
      </div>

      {headerDialogOpen && (
        <InvoiceHeaderDialog
          open={headerDialogOpen}
          onOpenChange={setHeaderDialogOpen}
          invoice={invoice}
          readOnly={!isDraft}
          onSaved={fetchInvoice}
        />
      )}

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
