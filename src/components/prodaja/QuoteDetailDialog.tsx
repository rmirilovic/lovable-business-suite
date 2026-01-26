import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { FileText, Pencil, ArrowRightLeft, Printer } from "lucide-react";
import { Quote, useQuotes, useQuoteItems } from "@/hooks/useQuotes";
import { QuoteItemsEditor } from "./QuoteItemsEditor";
import { formatDecimal } from "@/lib/formatting";
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
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  posted: { label: "Potvrđena", variant: "default" },
  cancelled: { label: "Stornirana", variant: "destructive" },
};

export function QuoteDetailDialog({
  open,
  onOpenChange,
  quote,
  onEdit,
  onConvertToInvoice,
}: QuoteDetailDialogProps) {
  const { selectedCompany } = useAuth();
  const { updateQuoteTotals } = useQuotes();
  const { items } = useQuoteItems(quote?.id || null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleTotalsChange = useCallback((subtotal: number, vatAmount: number, totalAmount: number) => {
    if (quote && (quote.subtotal !== subtotal || quote.vat_amount !== vatAmount || quote.total_amount !== totalAmount)) {
      updateQuoteTotals.mutate({
        quoteId: quote.id,
        subtotal,
        vat_amount: vatAmount,
        total_amount: totalAmount,
      });
    }
  }, [quote, updateQuoteTotals]);

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

      generateQuotePdf(
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
        }
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
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Kupac</p>
              <p className="font-medium">
                {quote.partner?.code} - {quote.partner?.name}
              </p>
            </div>
            {quote.valid_until && (
              <div>
                <p className="text-sm text-muted-foreground">Važi do</p>
                <p className="font-medium">
                  {format(new Date(quote.valid_until), "d. MMMM yyyy.", { locale: sr })}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-3 text-right">
            <div>
              <p className="text-sm text-muted-foreground">Ukupno</p>
              <p className="text-2xl font-bold text-primary">
                {formatDecimal(quote.total_amount)} RSD
              </p>
            </div>
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
              <Button variant="outline" onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                Uredi
              </Button>
            )}
            {isEditable && !quote.converted_to_invoice_id && (
              <Button onClick={onConvertToInvoice}>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Pretvori u fakturu
              </Button>
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
