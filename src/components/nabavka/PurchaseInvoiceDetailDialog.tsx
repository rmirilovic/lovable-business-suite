import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PurchaseInvoice, usePurchaseInvoiceItems } from "@/hooks/usePurchaseInvoices";
import { formatDecimal, formatDate } from "@/lib/formatting";

interface PurchaseInvoiceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PurchaseInvoice | null;
}

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjiženo",
  cancelled: "Stornirano",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  posted: "default",
  cancelled: "destructive",
};

export function PurchaseInvoiceDetailDialog({
  open,
  onOpenChange,
  invoice,
}: PurchaseInvoiceDetailDialogProps) {
  const { items, isLoading } = usePurchaseInvoiceItems(invoice?.id || null);

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Ulazna faktura: {invoice.internal_number}</DialogTitle>
            <Badge variant={statusVariants[invoice.status]}>
              {statusLabels[invoice.status]}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Header Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Interni broj</div>
              <div className="font-medium">{invoice.internal_number}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Broj fakture dobavljača</div>
              <div className="font-medium">{invoice.supplier_invoice_number}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Datum fakture</div>
              <div className="font-medium">{formatDate(invoice.invoice_date)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Datum prijema</div>
              <div className="font-medium">{formatDate(invoice.receipt_date)}</div>
            </div>
            {invoice.due_date && (
              <div>
                <div className="text-sm text-muted-foreground">Datum valute</div>
                <div className="font-medium">{formatDate(invoice.due_date)}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-muted-foreground">Dobavljač</div>
              <div className="font-medium">{invoice.partner?.name}</div>
              <div className="text-sm text-muted-foreground">{invoice.partner?.code}</div>
            </div>
          </div>

          {/* Notes */}
          {(invoice.note || invoice.internal_note) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invoice.note && (
                <div>
                  <div className="text-sm text-muted-foreground">Napomena</div>
                  <div className="text-sm">{invoice.note}</div>
                </div>
              )}
              {invoice.internal_note && (
                <div>
                  <div className="text-sm text-muted-foreground">Interna napomena</div>
                  <div className="text-sm">{invoice.internal_note}</div>
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            <h3 className="font-semibold">Stavke</h3>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">R.br.</TableHead>
                    <TableHead>Šifra</TableHead>
                    <TableHead>Naziv</TableHead>
                    <TableHead className="text-right">JM</TableHead>
                    <TableHead className="text-right">Količina</TableHead>
                    <TableHead className="text-right">Cena</TableHead>
                    <TableHead className="text-right">Popust</TableHead>
                    <TableHead className="text-right">PDV</TableHead>
                    <TableHead className="text-right">Iznos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-4">
                        Učitavanje...
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">
                        Nema stavki
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{item.item_code || "-"}</TableCell>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell className="text-right">{item.unit}</TableCell>
                        <TableCell className="text-right">
                          {formatDecimal(item.quantity, 3)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDecimal(item.unit_price, 4)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDecimal(item.discount_percent, 2)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDecimal(item.vat_rate, 0)}%
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatDecimal(item.line_total, 2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Osnovica:</span>
                <span className="font-medium">{formatDecimal(invoice.subtotal, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PDV:</span>
                <span className="font-medium">{formatDecimal(invoice.vat_amount, 2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Ukupno:</span>
                <span>{formatDecimal(invoice.total_amount, 2)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
