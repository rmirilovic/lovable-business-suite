import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Pencil } from "lucide-react";
import {
  PurchaseInvoice,
  usePurchaseInvoices,
  usePurchaseInvoiceItems,
} from "@/hooks/usePurchaseInvoices";
import { PurchaseInvoiceItemsEditor } from "./PurchaseInvoiceItemsEditor";
import { formatDate, formatDecimal } from "@/lib/formatting";

interface PurchaseInvoiceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PurchaseInvoice | null;
  onEdit: () => void;
}

const STATUS_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Nacrt", variant: "secondary" },
  posted: { label: "Proknjiženo", variant: "default" },
  cancelled: { label: "Stornirano", variant: "destructive" },
};

export function PurchaseInvoiceDetailDialog({
  open,
  onOpenChange,
  invoice,
  onEdit,
}: PurchaseInvoiceDetailDialogProps) {
  const { updatePurchaseInvoiceTotals } = usePurchaseInvoices();
  const { items, addItem, updateItem, deleteItem } = usePurchaseInvoiceItems(
    invoice?.id || null
  );

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const approxEqualMoney = (a: number, b: number, eps = 0.005) => Math.abs(a - b) < eps;

  // Use ref to store mutation function to prevent infinite loops
  const updateTotalsRef = useRef(updatePurchaseInvoiceTotals);
  useEffect(() => {
    updateTotalsRef.current = updatePurchaseInvoiceTotals;
  }, [updatePurchaseInvoiceTotals]);

  // Guard against repeated updates
  const lastSubmittedTotalsRef = useRef<{ s: number; v: number; t: number } | null>(null);

  const handleTotalsChange = useCallback(
    (subtotal: number, vatAmount: number, totalAmount: number) => {
      if (!invoice) return;

      if (updateTotalsRef.current.isPending) return;

      const s = round2(subtotal);
      const v = round2(vatAmount);
      const t = round2(totalAmount);

      const last = lastSubmittedTotalsRef.current;
      if (
        last &&
        approxEqualMoney(last.s, s) &&
        approxEqualMoney(last.v, v) &&
        approxEqualMoney(last.t, t)
      ) {
        return;
      }

      if (
        !approxEqualMoney(invoice.subtotal, s) ||
        !approxEqualMoney(invoice.vat_amount, v) ||
        !approxEqualMoney(invoice.total_amount, t)
      ) {
        lastSubmittedTotalsRef.current = { s, v, t };
        updateTotalsRef.current.mutate({
          invoiceId: invoice.id,
          subtotal: s,
          vat_amount: v,
          total_amount: t,
        });
      }
    },
    [invoice]
  );

  if (!invoice) return null;

  const status = STATUS_LABELS[invoice.status] || STATUS_LABELS.draft;
  const isEditable = invoice.status === "draft";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              <div>
                <DialogTitle className="text-xl">{invoice.internal_number}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Faktura dobavljača: {invoice.supplier_invoice_number}
                </p>
              </div>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </DialogHeader>

        <Separator />

        {/* Header info - read only */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Dobavljač</p>
            <p className="font-medium">{invoice.partner?.name}</p>
            <p className="text-xs text-muted-foreground">{invoice.partner?.code}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Datum fakture</p>
            <p className="font-medium">{formatDate(invoice.invoice_date)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Datum prijema</p>
            <p className="font-medium">{formatDate(invoice.receipt_date)}</p>
          </div>
          {invoice.due_date && (
            <div>
              <p className="text-sm text-muted-foreground">Datum valute</p>
              <p className="font-medium">{formatDate(invoice.due_date)}</p>
            </div>
          )}
        </div>

        <Separator />

        <Tabs defaultValue="items" className="w-full">
          <TabsList>
            <TabsTrigger value="items">Stavke</TabsTrigger>
            <TabsTrigger value="notes">Napomene</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="mt-4">
            <PurchaseInvoiceItemsEditor
              invoiceId={invoice.id}
              items={items}
              onAddItem={addItem.mutateAsync}
              onUpdateItem={updateItem.mutateAsync}
              onDeleteItem={deleteItem.mutateAsync}
              onTotalsChange={handleTotalsChange}
              isReadOnly={!isEditable}
            />
          </TabsContent>

          <TabsContent value="notes" className="mt-4 space-y-4">
            {invoice.note && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Napomena</p>
                <p className="text-sm bg-muted p-3 rounded-md">{invoice.note}</p>
              </div>
            )}
            {invoice.internal_note && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Interna napomena
                </p>
                <p className="text-sm bg-muted p-3 rounded-md">{invoice.internal_note}</p>
              </div>
            )}
            {!invoice.note && !invoice.internal_note && (
              <p className="text-muted-foreground text-center py-8">Nema napomena</p>
            )}
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Actions */}
        <div className="flex justify-end">
          {isEditable && (
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="w-4 h-4 mr-2" />
              Uredi
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
