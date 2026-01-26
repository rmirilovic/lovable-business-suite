import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Truck, Plus } from "lucide-react";
import { useConversionSources, useCreateInvoiceFromQuote, useCreateInvoiceFromDeliveryNote } from "@/hooks/useInvoices";
import { formatDate, formatPrice } from "@/lib/formatting";

interface CreateInvoiceFromSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvoiceCreated: (invoiceId: string) => void;
}

export function CreateInvoiceFromSourceDialog({
  open,
  onOpenChange,
  onInvoiceCreated,
}: CreateInvoiceFromSourceDialogProps) {
  const { acceptedQuotes, uninvoicedDeliveryNotes, isLoading } = useConversionSources();
  const createFromQuote = useCreateInvoiceFromQuote();
  const createFromDeliveryNote = useCreateInvoiceFromDeliveryNote();

  const handleCreateFromQuote = async (quoteId: string) => {
    const invoice = await createFromQuote.mutateAsync(quoteId);
    onInvoiceCreated(invoice.id);
    onOpenChange(false);
  };

  const handleCreateFromDeliveryNote = async (deliveryNoteId: string) => {
    const invoice = await createFromDeliveryNote.mutateAsync(deliveryNoteId);
    onInvoiceCreated(invoice.id);
    onOpenChange(false);
  };

  const isPending = createFromQuote.isPending || createFromDeliveryNote.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kreiraj fakturu iz dokumenta</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="delivery-notes" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="delivery-notes" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Otpremnice ({uninvoicedDeliveryNotes.length})
            </TabsTrigger>
            <TabsTrigger value="quotes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Ponude ({acceptedQuotes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="delivery-notes" className="mt-4">
            {uninvoicedDeliveryNotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nema proknjiženih otpremnica koje čekaju fakturisanje.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Broj</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead className="text-center">Stavke</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uninvoicedDeliveryNotes.map((dn) => (
                    <TableRow key={dn.id}>
                      <TableCell className="font-medium">{dn.delivery_number}</TableCell>
                      <TableCell>{formatDate(dn.delivery_date)}</TableCell>
                      <TableCell>
                        <div>
                          <div>{dn.partner_name}</div>
                          <div className="text-sm text-muted-foreground">{dn.partner_code}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{dn.item_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleCreateFromDeliveryNote(dn.id)}
                          disabled={isPending}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Kreiraj
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="quotes" className="mt-4">
            {acceptedQuotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nema prihvaćenih ponuda koje čekaju konverziju u fakturu.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Broj</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead className="text-right">Iznos</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acceptedQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">{quote.quote_number}</TableCell>
                      <TableCell>{formatDate(quote.quote_date)}</TableCell>
                      <TableCell>
                        <div>
                          <div>{quote.partner?.name}</div>
                          <div className="text-sm text-muted-foreground">{quote.partner?.code}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(quote.total_amount)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleCreateFromQuote(quote.id)}
                          disabled={isPending}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Kreiraj
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
