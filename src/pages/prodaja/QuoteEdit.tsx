import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Pencil, ThumbsUp, ArrowLeft, RefreshCw, History } from "lucide-react";
import { Quote, useQuotes } from "@/hooks/useQuotes";
import { QuoteItemsEditor } from "@/components/prodaja/QuoteItemsEditor";
import { QuoteDialog } from "@/components/prodaja/QuoteDialog";
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
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [localTotals, setLocalTotals] = useState({ subtotal: 0, vat_amount: 0, total_amount: 0 });
  const [historyOpen, setHistoryOpen] = useState(false);

  const { approveQuote, updateQuote } = useQuotes();
  
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

    setQuote(data as Quote);
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

  const handleHeaderSaved = async () => {
    setHeaderDialogOpen(false);
    fetchQuote();
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
  const status = STATUS_BADGES[quote.status] || STATUS_BADGES.draft;

  return (
    <MainLayout title={`Ponuda: ${quote.quote_number}`}>
      <div className="space-y-4">
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
          </div>
        </div>

        {/* Header info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
          <div>
            <div className="text-muted-foreground">Datum ponude</div>
            <div className="font-medium">{formatDate(quote.quote_date)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Važi do</div>
            <div className="font-medium">{quote.valid_until ? formatDate(quote.valid_until) : "-"}</div>
          </div>
          <div className="col-span-2">
            <div className="text-muted-foreground">Kupac</div>
            <div className="font-medium">{quote.partner_name ?? quote.partner?.name}</div>
            <div className="text-xs text-muted-foreground">{quote.partner?.code}</div>
          </div>
        </div>

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
      <QuoteDialog
        open={headerDialogOpen}
        onOpenChange={setHeaderDialogOpen}
        quote={quote}
        onSave={handleHeaderSaved}
        isLoading={false}
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

      {quote && (
        <DocumentHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          documentId={quote.id}
          documentName={quote.quote_number}
          documentType="quote"
        />
      )}
    </MainLayout>
  );
}
