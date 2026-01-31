import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pencil, BookCheck } from "lucide-react";
import {
  GoodsPurchaseInvoice,
  useGoodsPurchaseInvoiceItems,
  useGoodsPurchaseInvoices,
} from "@/hooks/useGoodsPurchaseInvoices";
import { GoodsPurchaseInvoiceItemsEditor } from "./GoodsPurchaseInvoiceItemsEditor";
import { formatNumber, formatDate } from "@/lib/formatting";

interface GoodsPurchaseInvoiceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: GoodsPurchaseInvoice | null;
  onEdit: () => void;
  onPost: () => void;
}

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjiženo",
  cancelled: "Stornirano",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  posted: "default",
  cancelled: "destructive",
};

export function GoodsPurchaseInvoiceDetailDialog({
  open,
  onOpenChange,
  invoice,
  onEdit,
  onPost,
}: GoodsPurchaseInvoiceDetailDialogProps) {
  const { items, isLoading: itemsLoading, addItem, updateItem, deleteItem } = useGoodsPurchaseInvoiceItems(invoice?.id || null);
  const { updateTotals } = useGoodsPurchaseInvoices();

  useEffect(() => {
    if (!invoice || invoice.status !== "draft") return;
    
    const subtotal = items.reduce((sum, item) => sum + item.line_subtotal, 0);
    const vatAmount = items.reduce((sum, item) => sum + item.line_vat, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);

    if (
      subtotal !== invoice.subtotal ||
      vatAmount !== invoice.vat_amount ||
      totalAmount !== invoice.total_amount
    ) {
      updateTotals.mutate({
        invoiceId: invoice.id,
        subtotal,
        vat_amount: vatAmount,
        total_amount: totalAmount,
      });
    }
  }, [items, invoice]);

  if (!invoice) return null;

  const isDraft = invoice.status === "draft";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle>{invoice.internal_number}</DialogTitle>
              <Badge variant={statusVariants[invoice.status]}>
                {statusLabels[invoice.status]}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Header info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Broj fakture dobavljača</div>
            <div className="font-medium">{invoice.supplier_invoice_number}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Datum fakture</div>
            <div className="font-medium">{formatDate(invoice.invoice_date)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Datum prijema</div>
            <div className="font-medium">{formatDate(invoice.receipt_date)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Magacin</div>
            <div className="font-medium">{invoice.warehouse?.code} - {invoice.warehouse?.name}</div>
          </div>
        </div>

        <Separator />

        {/* Supplier info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="col-span-2">
            <div className="text-muted-foreground">Dobavljač</div>
            <div className="font-medium">{invoice.supplier_name || invoice.partner?.name}</div>
            <div className="text-xs text-muted-foreground">
              {invoice.supplier_address}, {invoice.supplier_postal_code} {invoice.supplier_city}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">PIB</div>
            <div className="font-medium">{invoice.supplier_pib || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Matični broj</div>
            <div className="font-medium">{invoice.supplier_mb || "-"}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">U sistemu PDV-a</div>
            <Badge variant={invoice.supplier_is_in_pdv ? "default" : "outline"}>
              {invoice.supplier_is_in_pdv ? "Da" : "Ne"}
            </Badge>
          </div>
          <div>
            <div className="text-muted-foreground">Obračun PDV-a</div>
            <div className="font-medium">
              {invoice.vat_calculation_type === "standard" ? "Standardni" : "Bez obračuna (8v.2)"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Interni obračun PDV</div>
            <Badge variant={invoice.has_internal_vat_calculation ? "default" : "outline"}>
              {invoice.has_internal_vat_calculation ? "Da" : "Ne"}
            </Badge>
          </div>
          <div>
            <div className="text-muted-foreground">Tekući račun</div>
            <div className="font-medium text-xs">{invoice.supplier_bank_account || "-"}</div>
          </div>
        </div>

        <Separator />

        {/* Items editor */}
        <GoodsPurchaseInvoiceItemsEditor
          invoiceId={invoice.id}
          items={items}
          isLoading={itemsLoading}
          isEditable={isDraft}
          addItem={addItem}
          updateItem={updateItem}
          deleteItem={deleteItem}
        />

        <Separator />

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Osnovica:</span>
              <span className="font-medium">{formatNumber(invoice.subtotal)} RSD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PDV:</span>
              <span className="font-medium">{formatNumber(invoice.vat_amount)} RSD</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base">
              <span className="font-medium">Ukupno:</span>
              <span className="font-bold">{formatNumber(invoice.total_amount)} RSD</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zatvori
          </Button>
          {isDraft && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Uredi zaglavlje
              </Button>
              <Button onClick={onPost}>
                <BookCheck className="h-4 w-4 mr-2" />
                Proknjiži
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
