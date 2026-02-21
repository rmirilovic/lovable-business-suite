import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { Loader2, ThumbsUp, ArrowLeft, RefreshCw, History, Printer, Copy, ArrowRightLeft, Truck, Save } from "lucide-react";
import { Quote, useQuotes, useQuoteItems } from "@/hooks/useQuotes";
import { QuoteItemsEditor } from "@/components/prodaja/QuoteItemsEditor";
import { CreateDeliveryNoteFromQuoteDialog } from "@/components/prodaja/CreateDeliveryNoteFromQuoteDialog";
import { formatDate, formatPrice } from "@/lib/formatting";
import { useAuth } from "@/contexts/AuthContext";
import { usePartners } from "@/hooks/usePartners";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentLock } from "@/hooks/useDocumentLock";
import { toast } from "sonner";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { generateQuotePdf } from "@/lib/quotePdfGenerator";
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
  const { selectedCompany, selectedYear, user } = useAuth();
  
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [localTotals, setLocalTotals] = useState({ subtotal: 0, vat_amount: 0, total_amount: 0 });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [deliveryNoteDialogOpen, setDeliveryNoteDialogOpen] = useState(false);

  // Header form state
  const [headerForm, setHeaderForm] = useState({
    quote_date: "",
    valid_until: "",
    partner_id: "",
    org_unit_id: "",
    note: "",
    internal_note: "",
    header_note: "",
    partner_name: "",
    partner_address: "",
    partner_city: "",
    partner_postal_code: "",
    partner_pib: "",
    partner_mb: "",
    composed_by: "",
    approved_by_name: "",
  });
  const [headerDirty, setHeaderDirty] = useState(false);

  const { approveQuote, updateQuote, copyQuote } = useQuotes();
  const { items } = useQuoteItems(quote?.id || null);
  const createFromQuote = useCreateInvoiceFromQuote();
  const { partners } = usePartners();
  const { units } = useOrganizationalUnits(selectedCompany?.id);

  const customerPartners = partners.filter(p => p.is_customer && p.is_active);
  
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
    // Initialize header form
    setHeaderForm({
      quote_date: data.quote_date,
      valid_until: data.valid_until || "",
      partner_id: data.partner_id,
      org_unit_id: data.org_unit_id || "",
      note: data.note || "",
      internal_note: data.internal_note || "",
      header_note: data.header_note || "",
      partner_name: data.partner_name ?? q.partner?.name ?? "",
      partner_address: data.partner_address ?? q.partner?.address ?? "",
      partner_city: data.partner_city ?? q.partner?.city ?? "",
      partner_postal_code: data.partner_postal_code ?? q.partner?.postal_code ?? "",
      partner_pib: data.partner_pib ?? q.partner?.pib ?? "",
      partner_mb: data.partner_mb ?? q.partner?.mb ?? "",
      composed_by: data.composed_by || "",
      approved_by_name: data.approved_by_name || "",
    });
    setHeaderDirty(false);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchQuote();
  }, [id]);

  const handleTotalsChange = useCallback((subtotal: number, vatAmount: number, totalAmount: number) => {
    setLocalTotals({ subtotal, vat_amount: vatAmount, total_amount: totalAmount });
  }, []);

  const updateHeaderField = (field: string, value: string) => {
    setHeaderForm((prev) => ({ ...prev, [field]: value }));
    setHeaderDirty(true);
  };

  const handlePartnerChange = (partnerId: string) => {
    const p = customerPartners.find((x) => x.id === partnerId);
    setHeaderForm((prev) => ({
      ...prev,
      partner_id: partnerId,
      partner_name: p?.name ?? "",
      partner_address: p?.address ?? "",
      partner_city: p?.city ?? "",
      partner_postal_code: p?.postal_code ?? "",
      partner_pib: p?.pib ?? "",
      partner_mb: p?.mb ?? "",
    }));
    setHeaderDirty(true);
  };

  const handleSaveHeader = async () => {
    if (!quote || !id) return;
    const canProceed = await checkLock();
    if (!canProceed) return;

    await updateQuote.mutateAsync({
      id,
      quote_date: headerForm.quote_date,
      valid_until: headerForm.valid_until || null,
      partner_id: headerForm.partner_id,
      org_unit_id: headerForm.org_unit_id || null,
      note: headerForm.note || null,
      internal_note: headerForm.internal_note || null,
      header_note: headerForm.header_note || null,
      partner_name: headerForm.partner_name || null,
      partner_address: headerForm.partner_address || null,
      partner_city: headerForm.partner_city || null,
      partner_postal_code: headerForm.partner_postal_code || null,
      partner_pib: headerForm.partner_pib || null,
      partner_mb: headerForm.partner_mb || null,
      composed_by: headerForm.composed_by || null,
      approved_by_name: headerForm.approved_by_name || null,
    });
    setHeaderDirty(false);
    fetchQuote();
  };

  const handleApproveConfirm = async () => {
    if (!quote) return;
    
    const canProceed = await checkLock();
    if (!canProceed) return;
    
    await approveQuote.mutateAsync(quote.id);
    setApproveDialogOpen(false);
    fetchQuote();
  };

  const handlePrint = async () => {
    if (!quote || !selectedCompany) return;

    setIsPrinting(true);
    try {
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

      const partnerForPdf = {
        name: quoteForPdf.partner_name || quoteForPdf.partner?.name || "",
        code: quoteForPdf.partner?.code || "",
        address: quoteForPdf.partner_address || quoteForPdf.partner?.address || null,
        city: quoteForPdf.partner_city || quoteForPdf.partner?.city || null,
        postal_code: quoteForPdf.partner_postal_code || quoteForPdf.partner?.postal_code || null,
        pib: quoteForPdf.partner_pib || quoteForPdf.partner?.pib || null,
        mb: quoteForPdf.partner_mb || quoteForPdf.partner?.mb || null,
      };

      await generateQuotePdf(
        quoteForPdf,
        items,
        {
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
        },
        partnerForPdf,
        quoteForPdf.approved_by_name || null,
        quoteForPdf.composed_by || null
      );

      toast.success("PDF ponuda je generisana");
    } catch (error: any) {
      toast.error(`Greška pri generisanju PDF-a: ${error.message}`);
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
            {isDraft && headerDirty && (
              <Button size="sm" onClick={handleSaveHeader} disabled={updateQuote.isPending}>
                <Save className="w-4 h-4 mr-2" />
                Sačuvaj
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchQuote} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
              <Printer className="w-4 h-4 mr-2" />
              {isPrinting ? "Generisanje..." : "Štampaj PDF"}
            </Button>
            {isDraft && (
              <Button size="sm" onClick={() => setApproveDialogOpen(true)}>
                <ThumbsUp className="h-4 w-4 mr-2" />Odobri
              </Button>
            )}
            {isApproved && (
              <>
                <Button variant="outline" size="sm" onClick={handleCopy} disabled={isCopying}>
                  <Copy className="w-4 h-4 mr-2" />
                  {isCopying ? "Kopiranje..." : "Kopiraj"}
                </Button>
                {!quote.converted_to_invoice_id && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setDeliveryNoteDialogOpen(true)}>
                      <Truck className="w-4 h-4 mr-2" />
                      U otpremnicu
                    </Button>
                    <Button size="sm" onClick={handleConvertToInvoice}>
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      U fakturu
                    </Button>
                  </>
                )}
                {quote.converted_to_invoice_id && (
                  <Badge variant="outline">Konvertovana u fakturu</Badge>
                )}
              </>
            )}
          </div>
        </div>

        {/* Header fields - inline editable when draft */}
        <div className="p-4 border rounded-lg bg-card">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Datum ponude</Label>
              {isDraft ? (
                <LocaleDateInput
                  value={headerForm.quote_date}
                  onChange={(v) => updateHeaderField("quote_date", v)}
                />
              ) : (
                <div className="font-medium text-sm">{formatDate(quote.quote_date)}</div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Važi do</Label>
              {isDraft ? (
                <LocaleDateInput
                  value={headerForm.valid_until}
                  onChange={(v) => updateHeaderField("valid_until", v)}
                />
              ) : (
                <div className="font-medium text-sm">{quote.valid_until ? formatDate(quote.valid_until) : "-"}</div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kupac</Label>
              {isDraft ? (
                <SearchablePartnerSelect
                  partners={customerPartners}
                  value={headerForm.partner_id}
                  onValueChange={handlePartnerChange}
                  placeholder="Izaberi kupca..."
                />
              ) : (
                <div className="font-medium text-sm">{quote.partner_name ?? quote.partner?.name}</div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Org. jedinica</Label>
              {isDraft ? (
                <Select
                  value={headerForm.org_unit_id || "none"}
                  onValueChange={(v) => updateHeaderField("org_unit_id", v === "none" ? "" : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="--" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Bez org. jedinice --</SelectItem>
                    {units.filter(u => u.is_active).map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.code} - {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="font-medium text-sm">
                  {quote.org_unit_id
                    ? units.find(u => u.id === quote.org_unit_id)?.name || "-"
                    : "-"}
                </div>
              )}
            </div>
          </div>

          {/* Partner snapshot details (editable when draft) */}
          {isDraft ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Naziv kupca na ponudi</Label>
                <Input
                  value={headerForm.partner_name}
                  onChange={(e) => updateHeaderField("partner_name", e.target.value)}
                  className="h-9"
                  autoComplete="off"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Adresa</Label>
                <Input
                  value={headerForm.partner_address}
                  onChange={(e) => updateHeaderField("partner_address", e.target.value)}
                  className="h-9"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Poštanski broj</Label>
                <Input
                  value={headerForm.partner_postal_code}
                  onChange={(e) => updateHeaderField("partner_postal_code", e.target.value)}
                  className="h-9"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mesto</Label>
                <Input
                  value={headerForm.partner_city}
                  onChange={(e) => updateHeaderField("partner_city", e.target.value)}
                  className="h-9"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">PIB</Label>
                <Input
                  value={headerForm.partner_pib}
                  onChange={(e) => updateHeaderField("partner_pib", e.target.value)}
                  className="h-9"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Matični broj</Label>
                <Input
                  value={headerForm.partner_mb}
                  onChange={(e) => updateHeaderField("partner_mb", e.target.value)}
                  className="h-9"
                  autoComplete="off"
                />
              </div>
            </div>
          ) : (
            /* Read-only partner info for non-draft */
            <div className="mt-4 pt-4 border-t text-sm">
              <div className="font-medium">{quote.partner?.code} - {quote.partner_name ?? quote.partner?.name}</div>
              {(quote.partner_address ?? quote.partner?.address) && (
                <div className="text-muted-foreground">
                  {quote.partner_address ?? quote.partner?.address}
                  {(quote.partner_city ?? quote.partner?.city) && `, ${quote.partner_postal_code ?? quote.partner?.postal_code ?? ""} ${quote.partner_city ?? quote.partner?.city}`}
                </div>
              )}
              {(quote.partner_pib ?? quote.partner?.pib) && (
                <div className="text-muted-foreground">
                  PIB: {quote.partner_pib ?? quote.partner?.pib}
                  {(quote.partner_mb ?? quote.partner?.mb) && ` | MB: ${quote.partner_mb ?? quote.partner?.mb}`}
                </div>
              )}
            </div>
          )}

          {/* Notes section */}
          {isDraft ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div className="space-y-1">
                <Label className="text-xs">Napomena u zaglavlju</Label>
                <Textarea
                  value={headerForm.header_note}
                  onChange={(e) => updateHeaderField("header_note", e.target.value)}
                  rows={2}
                  placeholder="Kratka napomena iznad stavki..."
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Napomena za kupca</Label>
                <Textarea
                  value={headerForm.note}
                  onChange={(e) => updateHeaderField("note", e.target.value)}
                  rows={2}
                  placeholder="Napomena na ponudi..."
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Interna napomena</Label>
                <Textarea
                  value={headerForm.internal_note}
                  onChange={(e) => updateHeaderField("internal_note", e.target.value)}
                  rows={2}
                  placeholder="Interna napomena..."
                  autoComplete="off"
                />
              </div>
            </div>
          ) : (
            (quote.note || quote.internal_note || quote.header_note) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t text-sm">
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
            )
          )}

          {/* Composed by / Approved by */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
            <div className="space-y-1">
              <Label className="text-xs">Ponudu sastavio</Label>
              {isDraft ? (
                <Input
                  value={headerForm.composed_by}
                  onChange={(e) => updateHeaderField("composed_by", e.target.value)}
                  className="h-9"
                  autoComplete="off"
                />
              ) : (
                <div className="font-medium text-sm">{quote.composed_by || "-"}</div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ponudu odobrio</Label>
              {isDraft ? (
                <Input
                  value={headerForm.approved_by_name}
                  onChange={(e) => updateHeaderField("approved_by_name", e.target.value)}
                  className="h-9"
                  autoComplete="off"
                />
              ) : (
                <div className="font-medium text-sm">{quote.approved_by_name || "-"}</div>
              )}
            </div>
          </div>
        </div>

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
