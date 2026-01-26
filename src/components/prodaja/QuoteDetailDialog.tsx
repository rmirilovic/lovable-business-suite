import { useState, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { FileText, Pencil, ArrowRightLeft, Printer, Check, Truck, Copy } from "lucide-react";
import { Quote, useQuotes, useQuoteItems } from "@/hooks/useQuotes";
import { QuoteItemsEditor } from "./QuoteItemsEditor";
import { QuotePartnerEditor } from "./QuotePartnerEditor";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { generateQuotePdf } from "@/lib/quotePdfGenerator";
import { toast } from "sonner";

interface QuoteDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
  onEdit: () => void;
  onConvertToInvoice: () => void;
  onConvertToDeliveryNote: () => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  approved: { label: "Odobrena", variant: "outline" },
  posted: { label: "Potvrđena", variant: "default" },
  cancelled: { label: "Stornirana", variant: "destructive" },
};

export function QuoteDetailDialog({
  open,
  onOpenChange,
  quote,
  onEdit,
  onConvertToInvoice,
  onConvertToDeliveryNote,
}: QuoteDetailDialogProps) {
  const { selectedCompany, user } = useAuth();
  const { updateQuoteTotals, approveQuote, copyQuote } = useQuotes();
  const { items } = useQuoteItems(quote?.id || null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const approxEqualMoney = (a: number, b: number, eps = 0.005) => Math.abs(a - b) < eps;

  // Use ref to store mutation function to prevent infinite loops
  const updateTotalsRef = useRef(updateQuoteTotals);
  useEffect(() => {
    updateTotalsRef.current = updateQuoteTotals;
  }, [updateQuoteTotals]);

  // Guard against repeated updates while parent quote props are still stale.
  // Without this, opening the dialog can trigger totals recalculation -> mutation -> rerender -> mutation...
  const lastSubmittedTotalsRef = useRef<{ s: number; v: number; t: number } | null>(null);

  const handleTotalsChange = useCallback((subtotal: number, vatAmount: number, totalAmount: number) => {
    if (!quote) return;

    // If a totals update is already in-flight, don't enqueue another one.
    // React Query mutation state changes can retrigger renders before `quote` is refreshed from query.
    if (updateTotalsRef.current.isPending) return;

    // Prevent update loops caused by floating point/numeric precision differences
    const s = round2(subtotal);
    const v = round2(vatAmount);
    const t = round2(totalAmount);

    // If we already sent these totals, avoid resending until quote refreshes.
    const last = lastSubmittedTotalsRef.current;
    if (last && approxEqualMoney(last.s, s) && approxEqualMoney(last.v, v) && approxEqualMoney(last.t, t)) {
      return;
    }

    if (
      !approxEqualMoney(quote.subtotal, s) ||
      !approxEqualMoney(quote.vat_amount, v) ||
      !approxEqualMoney(quote.total_amount, t)
    ) {
      lastSubmittedTotalsRef.current = { s, v, t };
      updateTotalsRef.current.mutate({
        quoteId: quote.id,
        subtotal: s,
        vat_amount: v,
        total_amount: t,
      });
    }
  }, [quote]);

  const handlePrint = async () => {
    if (!quote || !selectedCompany) return;

    setIsPrinting(true);
    try {
      // Fetch full company data
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", selectedCompany.id)
        .single();

      if (companyError) throw companyError;

      // Fetch full partner data
      const { data: partnerData, error: partnerError } = await supabase
        .from("partners")
        .select("*")
        .eq("id", quote.partner_id)
        .single();

      if (partnerError) throw partnerError;

      // Build approver name if quote is approved
      let approverName: string | null = null;
      if (quote.approver) {
        approverName = `${quote.approver.first_name || ""} ${quote.approver.last_name || ""}`.trim() || null;
      } else if (quote.approved_by) {
        // Fallback: if parent state is stale or approver isn't hydrated, fetch profile
        const { data: approverProfile, error: approverError } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", quote.approved_by)
          .maybeSingle();
        if (!approverError && approverProfile) {
          approverName = `${approverProfile.first_name || ""} ${approverProfile.last_name || ""}`.trim() || null;
        }
      }

      await generateQuotePdf(
        quote,
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
        {
          name: partnerData.name,
          code: partnerData.code,
          address: partnerData.address,
          city: partnerData.city,
          postal_code: partnerData.postal_code,
          pib: partnerData.pib,
          mb: partnerData.mb,
        },
        approverName
      );
      
      toast.success("PDF ponuda je generisana");
    } catch (error: any) {
      toast.error(`Greška pri generisanju PDF-a: ${error.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  if (!quote) return null;

  const status = STATUS_LABELS[quote.status] || STATUS_LABELS.draft;
  const isEditable = quote.status === "draft";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              <div>
                <DialogTitle className="text-xl">{quote.quote_number}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(quote.quote_date), "d. MMMM yyyy.", { locale: sr })}
                </p>
              </div>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </DialogHeader>

        <Separator />

        {/* Header info */}
        <div className="grid grid-cols-2 gap-6">
          <QuotePartnerEditor quote={quote} isEditable={isEditable} />
          <div className="space-y-3">
            {quote.valid_until && (
              <div>
                <p className="text-sm text-muted-foreground">Važi do</p>
                <p className="font-medium">
                  {format(new Date(quote.valid_until), "d. MMMM yyyy.", { locale: sr })}
                </p>
              </div>
            )}
            {quote.approver && (
              <div>
                <p className="text-sm text-muted-foreground">Odobrio/la</p>
                <p className="font-medium">
                  {quote.approver.first_name} {quote.approver.last_name}
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <Tabs defaultValue="items" className="w-full">
          <TabsList>
            <TabsTrigger value="items">Stavke</TabsTrigger>
            <TabsTrigger value="notes">Napomene</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="mt-4">
            <QuoteItemsEditor
              quoteId={quote.id}
              isReadOnly={!isEditable}
              onTotalsChange={handleTotalsChange}
            />
          </TabsContent>

          <TabsContent value="notes" className="mt-4 space-y-4">
            {quote.note && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Napomena za kupca</p>
                <p className="text-sm bg-muted p-3 rounded-md">{quote.note}</p>
              </div>
            )}
            {quote.internal_note && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Interna napomena</p>
                <p className="text-sm bg-muted p-3 rounded-md">{quote.internal_note}</p>
              </div>
            )}
            {!quote.note && !quote.internal_note && (
              <p className="text-muted-foreground text-center py-8">Nema napomena</p>
            )}
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Actions */}
        <div className="flex justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
              <Printer className="w-4 h-4 mr-2" />
              {isPrinting ? "Generisanje..." : "Štampaj PDF"}
            </Button>
          </div>
          <div className="flex gap-2">
            {isEditable && (
              <>
                <Button variant="outline" onClick={onEdit}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Uredi
                </Button>
                <Button 
                  onClick={async () => {
                    setIsApproving(true);
                    await approveQuote.mutateAsync(quote.id);
                    setIsApproving(false);
                  }}
                  disabled={isApproving || items.length === 0}
                  variant="default"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {isApproving ? "Odobravanje..." : "Odobri"}
                </Button>
              </>
            )}
            {quote.status === "approved" && (
              <>
                <Button
                  variant="outline"
                  onClick={async () => {
                    setIsCopying(true);
                    try {
                      await copyQuote.mutateAsync(quote);
                      onOpenChange(false);
                    } finally {
                      setIsCopying(false);
                    }
                  }}
                  disabled={isCopying}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {isCopying ? "Kopiranje..." : "Kopiraj"}
                </Button>
                {!quote.converted_to_invoice_id && (
                  <>
                    <Button variant="outline" onClick={onConvertToDeliveryNote}>
                      <Truck className="w-4 h-4 mr-2" />
                      Pretvori u otpremnicu
                    </Button>
                    <Button onClick={onConvertToInvoice}>
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      Pretvori u fakturu
                    </Button>
                  </>
                )}
              </>
            )}
            {quote.converted_to_invoice_id && (
              <Badge variant="outline">Konvertovana u fakturu</Badge>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
