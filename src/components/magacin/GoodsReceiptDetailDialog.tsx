import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Edit,
  CheckCircle,
  Undo2,
  ExternalLink,
  Loader2,
  Calculator,
} from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { GoodsReceipt } from "@/hooks/useGoodsReceipts";
import { useGoodsReceiptItems } from "@/hooks/useGoodsReceipts";
import {
  useExistingCalculation,
  usePurchasePriceCalculations,
} from "@/hooks/usePurchasePriceCalculations";
import { GoodsReceiptItemsEditor } from "./GoodsReceiptItemsEditor";
import { formatDecimal, formatNumber } from "@/lib/formatting";

interface GoodsReceiptDetailDialogProps {
  receipt: GoodsReceipt;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  onPost?: () => void;
  onUnpost?: () => void;
}

export function GoodsReceiptDetailDialog({
  receipt,
  open,
  onOpenChange,
  onEdit,
  onUnpost,
  onPost,
}: GoodsReceiptDetailDialogProps) {
  const navigate = useNavigate();
  const { items, isLoading } = useGoodsReceiptItems(receipt.id);
  const [activeTab, setActiveTab] = useState("details");
  const { data: existingCalc, isLoading: calcCheckLoading } = useExistingCalculation(receipt.id);
  const { createFromReceipt } = usePurchasePriceCalculations();

  const isEditable = receipt.status === "draft" && !receipt.source_invoice_id;

  const handleCalculation = async () => {
    if (existingCalc) {
      onOpenChange(false);
      navigate(`/magacin/kalkulacije/${existingCalc.id}`);
    } else {
      const calc = await createFromReceipt.mutateAsync(receipt.id);
      onOpenChange(false);
      navigate(`/magacin/kalkulacije/${calc.id}`);
    }
  };

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl">
                {receipt.receipt_number}
              </DialogTitle>
              {receipt.status === "posted" ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                  Proknjiženo
                </Badge>
              ) : receipt.source_invoice_id ? (
                <Badge variant="secondary">Iz fakture</Badge>
              ) : (
                <Badge variant="outline">Nacrt</Badge>
              )}
            </div>
            <div className="flex gap-2">
              {onEdit && isEditable && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Izmeni
                </Button>
              )}
              {onPost && isEditable && (
                <Button size="sm" onClick={onPost}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Proknjiži
                </Button>
              )}
                {onUnpost && receipt.status === "posted" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onUnpost}
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  >
                    <Undo2 className="h-4 w-4 mr-2" />
                    Poništi
                  </Button>
                )}
                {receipt.status === "posted" && receipt.source_invoice_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCalculation}
                    disabled={createFromReceipt.isPending || calcCheckLoading}
                  >
                    {createFromReceipt.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Calculator className="h-4 w-4 mr-2" />
                    )}
                    {existingCalc ? "Otvori kalkulaciju" : "Kreiraj kalkulaciju"}
                  </Button>
                )}
                {receipt.status === "posted" && !receipt.source_invoice_id && (
                  <Badge variant="outline" className="text-muted-foreground text-xs py-1">
                    Kalkulacija zahteva povezan UFR
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Zatvori
                </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="details">Detalji</TabsTrigger>
            <TabsTrigger value="items">
              Stavke ({items.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 overflow-auto mt-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Datum prijema
                  </h4>
                  <p>
                    {format(new Date(receipt.receipt_date), "dd.MM.yyyy", {
                      locale: sr,
                    })}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Magacin
                  </h4>
                  <p>
                    {receipt.warehouse?.code} - {receipt.warehouse?.name}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Dobavljač
                  </h4>
                  <p>
                    {receipt.partner ? (
                      `${receipt.partner.code} - ${receipt.partner.name}`
                    ) : (
                      <span className="text-muted-foreground">
                        Nije definisan
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Ukupna količina
                  </h4>
                  <p className="text-lg font-semibold">
                    {formatNumber(totalQuantity)}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Ukupna vrednost
                  </h4>
                  <p className="text-lg font-semibold">
                    {formatDecimal(totalValue, 2)} RSD
                  </p>
                </div>
                {receipt.source_invoice_id && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Izvor
                    </h4>
                    <p className="flex items-center gap-1">
                      <ExternalLink className="h-4 w-4" />
                      Ulazna faktura za robu
                    </p>
                  </div>
                )}
              </div>
            </div>

            {receipt.note && (
              <>
                <Separator className="my-4" />
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Napomena
                  </h4>
                  <p className="whitespace-pre-wrap">{receipt.note}</p>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent
            value="items"
            className="flex-1 overflow-auto mt-4"
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : isEditable ? (
              <GoodsReceiptItemsEditor receiptId={receipt.id} />
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Šifra</TableHead>
                      <TableHead>Naziv</TableHead>
                      <TableHead className="text-right">Količina</TableHead>
                      <TableHead>JM</TableHead>
                      <TableHead className="text-right">Cena</TableHead>
                      <TableHead className="text-right">Vrednost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Nema stavki
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            {item.item_code || item.article?.code || "-"}
                          </TableCell>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(item.quantity)}
                          </TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell className="text-right">
                            {formatDecimal(item.unit_price, 2)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatDecimal(item.quantity * item.unit_price, 2)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
