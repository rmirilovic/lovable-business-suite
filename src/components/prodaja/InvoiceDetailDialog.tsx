import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Invoice } from "@/hooks/useInvoices";
import { useInvoiceMutations } from "@/hooks/useInvoiceMutations";
import { InvoiceItemsEditor } from "./InvoiceItemsEditor";
import { formatDate, formatPrice } from "@/lib/formatting";
import { CheckCircle, FileText, BookOpen } from "lucide-react";
import { useState } from "react";
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

interface InvoiceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
}

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

export function InvoiceDetailDialog({
  open,
  onOpenChange,
  invoice,
}: InvoiceDetailDialogProps) {
  const { postInvoice, updateInvoiceTotals } = useInvoiceMutations();
  const [showPostConfirm, setShowPostConfirm] = useState(false);

  if (!invoice) return null;

  const handleTotalsChange = (subtotal: number, vatAmount: number, total: number) => {
    if (invoice.status === "draft") {
      updateInvoiceTotals.mutate({
        invoiceId: invoice.id,
        subtotal,
        vat_amount: vatAmount,
        total_amount: total,
      });
    }
  };

  const handlePost = () => {
    setShowPostConfirm(true);
  };

  const confirmPost = async () => {
    await postInvoice.mutateAsync(invoice.id);
    setShowPostConfirm(false);
  };

  const isReadOnly = invoice.status !== "draft";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl">
                  Faktura {invoice.invoice_number}
                </DialogTitle>
                <Badge className={STATUS_COLORS[invoice.status]}>
                  {STATUS_LABELS[invoice.status]}
                </Badge>
              </div>
              <div className="flex gap-2">
                {invoice.status === "draft" && (
                  <Button onClick={handlePost} disabled={postInvoice.isPending}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Proknjiži
                  </Button>
                )}
                {invoice.journal_entry_id && (
                  <Button variant="outline" size="sm">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Nalog za knjiženje
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Invoice header info */}
          <div className="grid grid-cols-3 gap-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground">Kupac</p>
              <p className="font-medium">{invoice.partner?.name || "-"}</p>
              <p className="text-sm text-muted-foreground">{invoice.partner?.code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Datum fakture</p>
              <p className="font-medium">{formatDate(invoice.invoice_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Datum valute</p>
              <p className="font-medium">{invoice.due_date ? formatDate(invoice.due_date) : "-"}</p>
            </div>
          </div>

          {/* Source document info */}
          {(invoice.source_quote_id || invoice.source_delivery_note_id) && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Izvor: </span>
              {invoice.source_quote_id && (
                <span className="font-medium">
                  <FileText className="inline h-4 w-4 mr-1" />
                  Ponuda
                </span>
              )}
              {invoice.source_delivery_note_id && (
                <span className="font-medium">
                  <FileText className="inline h-4 w-4 mr-1" />
                  Otpremnica
                </span>
              )}
            </div>
          )}

          <Separator />

          <Tabs defaultValue="items" className="w-full">
            <TabsList>
              <TabsTrigger value="items">Stavke</TabsTrigger>
              <TabsTrigger value="notes">Napomene</TabsTrigger>
              <TabsTrigger value="history">Istorija</TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="mt-4">
              <InvoiceItemsEditor 
                invoiceId={invoice.id} 
                readOnly={isReadOnly}
                onTotalsChange={handleTotalsChange}
              />
            </TabsContent>

            <TabsContent value="notes" className="mt-4 space-y-4">
              {invoice.note && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Napomena za kupca
                  </h4>
                  <p className="text-sm">{invoice.note}</p>
                </div>
              )}
              {invoice.internal_note && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Interna napomena
                  </h4>
                  <p className="text-sm">{invoice.internal_note}</p>
                </div>
              )}
              {!invoice.note && !invoice.internal_note && (
                <p className="text-sm text-muted-foreground">Nema napomena</p>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kreirana:</span>
                  <span>{formatDate(invoice.created_at)}</span>
                </div>
                {invoice.posted_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Proknjižena:</span>
                    <span>{formatDate(invoice.posted_at)}</span>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Post confirmation dialog */}
      <AlertDialog open={showPostConfirm} onOpenChange={setShowPostConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potvrda knjiženja</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da proknjižite ovu fakturu?
              <br /><br />
              <strong>Knjiženje će:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Kreirati nalog za knjiženje u glavnoj knjizi</li>
                <li>Zabeležiti potraživanje od kupca</li>
                <li>Zabeležiti prihod i PDV obavezu</li>
              </ul>
              <br />
              Nakon knjiženja, faktura se ne može menjati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPost} disabled={postInvoice.isPending}>
              {postInvoice.isPending ? "Knjiženje..." : "Proknjiži"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
