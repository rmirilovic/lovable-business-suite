import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ThumbsUp, ArrowLeft, RefreshCw, History, Printer, Copy, ArrowRightLeft, Truck, Pencil, FileText, Undo2 } from "lucide-react";
import { Quote, useQuotes, useQuoteItems } from "@/hooks/useQuotes";
import { QuoteItemsEditor } from "@/components/prodaja/QuoteItemsEditor";
import { QuoteHeaderDialog } from "@/components/prodaja/QuoteHeaderDialog";
import { CreateDeliveryNoteFromQuoteDialog } from "@/components/prodaja/CreateDeliveryNoteFromQuoteDialog";
import { formatDate, formatPrice } from "@/lib/formatting";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentLock } from "@/hooks/useDocumentLock";
import { toast } from "sonner";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { generateQuotePdf, printQuotePdf } from "@/lib/quotePdfGenerator";
import { useCreateInvoiceFromQuote } from "@/hooks/useInvoices";
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
  approved: { label: "Odobrena", variant: "outline" },
  posted: { label: "Potvrđena", variant: "default" },
  cancelled: { label: "Stornirana", variant: "destructive" },
};

export default function QuoteEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear } = useAuth();
  
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [localTotals, setLocalTotals] = useState({ subtotal: 0, vat_amount: 0, total_amount: 0 });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [deliveryNoteDialogOpen, setDeliveryNoteDialogOpen] = useState(false);

  const { approveQuote, copyQuote, revertQuoteToDraft } = useQuotes();
  const { items } = useQuoteItems(quote?.id || null);
  const createFromQuote = useCreateInvoiceFromQuote();
  const { units } = useOrganizationalUnits(selectedCompany?.id);
  
  // Optimistic locking
  const { checkLock, updateLockTimestamp } = useDocumentLock({
    tableName: "quotes",
    documentId: id || null,
    initialUpdatedAt: quote?.updated_at || null,
    onConflict: () => fetchQuote(),
  });

  // Fetch quote data
  const fetchQuote = async () => {
    if (!id) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from("quotes")
      .select(`
        *,
        partner:partners(id, name, code, address, city, postal_code, pib, mb)
      `)
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Greška pri učitavanju dokumenta");
      navigate("/prodaja/ponude");
      return;
    }

    // Fetch approver if exists
    let approver = null;
    if (data.approved_by) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", data.approved_by)
        .single();
      approver = profile;
    }

    const q = { ...data, approver } as Quote;
    setQuote(q);
    updateLockTimestamp(data.updated_at);
    setLocalTotals({
      subtotal: data.subtotal,
      vat_amount: data.vat_amount,
      total_amount: data.total_amount,
    });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchQuote();
  }, [id]);

  const handleTotalsChange = useCallback((subtotal: number, vatAmount: number, totalAmount: number) => {
    setLocalTotals({ subtotal, vat_amount: vatAmount, total_amount: totalAmount });
  }, []);

  const handleApproveConfirm = async () => {
    if (!quote) return;
    
    const canProceed = await checkLock();
    if (!canProceed) return;
    
    await approveQuote.mutateAsync(quote.id);
    setApproveDialogOpen(false);
    fetchQuote();
  };

  const handleRevertConfirm = async () => {
    if (!quote) return;
    await revertQuoteToDraft.mutateAsync(quote.id);
    setRevertDialogOpen(false);
    fetchQuote();
  };

  const preparePdfData = async () => {
    if (!quote || !selectedCompany) return null;

    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", selectedCompany.id)
      .single();

    if (companyError) throw companyError;

    const { data: freshQuote, error: freshQuoteError } = await supabase
      .from("quotes")
      .select("subtotal, vat_amount, total_amount, note, internal_note, header_note, partner_name, partner_address, partner_city, partner_postal_code, partner_pib, partner_mb, composed_by, approved_by_name")
      .eq("id", quote.id)
      .single();

    if (freshQuoteError) throw freshQuoteError;

    const quoteForPdf: Quote = { ...quote, ...freshQuote };

    return {
      quoteForPdf,
      items,
      company: {
        name: companyData.name,
        address: companyData.address,
        city: companyData.city,
        postal_code: companyData.postal_code,
        pib: companyData.pib,
        mb: companyData.mb,
        phone: companyData.phone,
        email: companyData.email,
        quote_note_1: companyData.quote_note_1,
        quote_note_2: companyData.quote_note_2,
        logo_url: companyData.logo_url,
        logo_text: companyData.logo_text,
      },
      partner: {
        name: quoteForPdf.partner_name || quoteForPdf.partner?.name || "",
        code: quoteForPdf.partner?.code || "",
        address: quoteForPdf.partner_address || quoteForPdf.partner?.address || null,
        city: quoteForPdf.partner_city || quoteForPdf.partner?.city || null,
        postal_code: quoteForPdf.partner_postal_code || quoteForPdf.partner?.postal_code || null,
        pib: quoteForPdf.partner_pib || quoteForPdf.partner?.pib || null,
        mb: quoteForPdf.partner_mb || quoteForPdf.partner?.mb || null,
      },
      approverName: quoteForPdf.approved_by_name || null,
      creatorName: quoteForPdf.composed_by || null,
    };
  };

  const handleDownloadPdf = async () => {
    setIsPrinting(true);
    try {
      const data = await preparePdfData();
      if (!data) return;
      await generateQuotePdf(data.quoteForPdf, data.items, data.company, data.partner, data.approverName, data.creatorName);
      toast.success("PDF ponuda je generisana");
    } catch (error: any) {
      toast.error(`Greška pri generisanju PDF-a: ${error.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintDirect = async () => {
    setIsPrinting(true);
    try {
      const data = await preparePdfData();
      if (!data) return;
      await printQuotePdf(data.quoteForPdf, data.items, data.company, data.partner, data.approverName, data.creatorName);
    } catch (error: any) {
      toast.error(`Greška pri štampi: ${error.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCopy = async () => {
    if (!quote) return;
    setIsCopying(true);
    try {
      const newQuote = await copyQuote.mutateAsync(quote);
      navigate(`/prodaja/ponude/${newQuote.id}`);
    } finally {
      setIsCopying(false);
    }
  };

  const handleConvertToInvoice = async () => {
    if (!quote) return;
    try {
      const invoice = await createFromQuote.mutateAsync(quote.id);
      navigate(`/prodaja/fakture/${invoice.id}`);
    } catch (error: any) {
      toast.error(`Greška pri konverziji: ${error.message}`);
    }
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

  if (!quote) {
    return (
      <MainLayout title="Dokument nije pronađen">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Dokument nije pronađen ili nemate pristup.</p>
          <Button onClick={() => navigate("/prodaja/ponude")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Nazad na listu
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isDraft = quote.status === "draft";
  const isApproved = quote.status === "approved";
  const status = STATUS_BADGES[quote.status] || STATUS_BADGES.draft;

  return (
    <MainLayout title={`Ponuda: ${quote.quote_number}`}>
      <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/prodaja/ponude")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Nazad
            </Button>
            <h1 className="text-xl font-semibold">{quote.quote_number}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchQuote} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isPrinting}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrintDirect} disabled={isPrinting}>
              <Printer className="w-4 h-4 mr-2" />
              Štampa
            </Button>
            {isDraft && (
              <>
                <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
                </Button>
                <Button size="sm" onClick={() => setApproveDialogOpen(true)}>
                  <ThumbsUp className="h-4 w-4 mr-2" />Odobri
                </Button>
              </>
            )}
            {isApproved && (
              <>
                <Button variant="outline" size="sm" onClick={handleCopy} disabled={isCopying}>
                  <Copy className="w-4 h-4 mr-2" />
                  {isCopying ? "Kopiranje..." : "Kopiraj"}
                </Button>
                {!quote.converted_to_invoice_id && (
                  <Button variant="outline" size="sm" onClick={() => setRevertDialogOpen(true)}>
                    <Undo2 className="w-4 h-4 mr-2" />
                    Vrati u nacrt
                  </Button>
                )}
                {quote.converted_to_invoice_id && (
                  <Badge variant="outline">Konvertovana u fakturu</Badge>
                )}
              </>
            )}
          </div>
        </div>

        {/* Header info - read-only display */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
          <div>
            <div className="text-muted-foreground">Datum ponude</div>
            <div className="font-medium">{formatDate(quote.quote_date)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Važi do</div>
            <div className="font-medium">{quote.valid_until ? formatDate(quote.valid_until) : "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Org. jedinica</div>
            <div className="font-medium">
              {quote.org_unit_id
                ? units.find((u) => u.id === quote.org_unit_id)?.name || "-"
                : "-"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Ponudu sastavio</div>
            <div className="font-medium">{quote.composed_by || "-"}</div>
          </div>
        </div>

        {/* Partner info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="col-span-2">
            <div className="text-muted-foreground">Kupac</div>
            <div className="font-medium">
              {quote.partner?.code && <span className="text-muted-foreground mr-1">[{quote.partner.code}]</span>}
              {quote.partner_name ?? quote.partner?.name}
            </div>
            {(quote.partner_address ?? quote.partner?.address) && (
              <div className="text-xs text-muted-foreground">
                {quote.partner_address ?? quote.partner?.address}
                {(quote.partner_city ?? quote.partner?.city) && `, ${quote.partner_postal_code ?? quote.partner?.postal_code ?? ""} ${quote.partner_city ?? quote.partner?.city}`}
              </div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground">PIB</div>
            <div className="font-medium">{quote.partner_pib ?? quote.partner?.pib ?? "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Ponudu odobrio</div>
            <div className="font-medium">{quote.approved_by_name || "-"}</div>
          </div>
        </div>

        {/* Notes display */}
        {(quote.note || quote.internal_note || quote.header_note) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {quote.header_note && (
              <div>
                <div className="text-muted-foreground mb-1">Napomena u zaglavlju</div>
                <div className="bg-muted p-2 rounded-md">{quote.header_note}</div>
              </div>
            )}
            {quote.note && (
              <div>
                <div className="text-muted-foreground mb-1">Napomena za kupca</div>
                <div className="bg-muted p-2 rounded-md">{quote.note}</div>
              </div>
            )}
            {quote.internal_note && (
              <div>
                <div className="text-muted-foreground mb-1">Interna napomena</div>
                <div className="bg-muted p-2 rounded-md">{quote.internal_note}</div>
              </div>
            )}
          </div>
        )}

        {quote.approver && (
          <div className="text-sm text-muted-foreground">
            Odobrio/la: <span className="font-medium text-foreground">{quote.approver.first_name} {quote.approver.last_name}</span>
          </div>
        )}

        <Separator />

        {/* Items editor */}
        <QuoteItemsEditor
          quoteId={quote.id}
          isReadOnly={!isDraft}
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
      <QuoteHeaderDialog
        open={headerDialogOpen}
        onOpenChange={setHeaderDialogOpen}
        quote={quote}
        onSaved={fetchQuote}
      />

      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odobrenje ponude</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da odobrite ponudu{" "}
              <strong>{quote.quote_number}</strong>? 
              Odobrena ponuda se može konvertovati u fakturu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveConfirm}>
              Odobri
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vraćanje u nacrt</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da vratite ponudu <strong>{quote.quote_number}</strong> u nacrt?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevertConfirm}>Vrati u nacrt</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {quote && (
        <DocumentHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          documentId={quote.id}
          documentName={quote.quote_number}
          documentType="quote"
        />
      )}

      <CreateDeliveryNoteFromQuoteDialog
        open={deliveryNoteDialogOpen}
        onOpenChange={setDeliveryNoteDialogOpen}
        onSuccess={(deliveryNoteId) => navigate(`/prodaja/otpremnice`)}
      />
    </MainLayout>
  );
}
