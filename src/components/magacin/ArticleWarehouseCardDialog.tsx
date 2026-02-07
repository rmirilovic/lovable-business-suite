import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Loader2 } from "lucide-react";
import { useArticleWarehouseCard } from "@/hooks/useWarehouseStock";
import { formatPrice, formatDecimal, formatDate } from "@/lib/formatting";

interface ArticleWarehouseCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  warehouseId: string;
  warehouseName: string;
  articleId: string;
  articleCode: string;
  articleName: string;
  unit: string;
  dateFrom?: string;
  dateTo?: string;
}

export function ArticleWarehouseCardDialog({
  open,
  onOpenChange,
  companyId,
  warehouseId,
  warehouseName,
  articleId,
  articleCode,
  articleName,
  unit,
  dateFrom,
  dateTo,
}: ArticleWarehouseCardDialogProps) {
  const { data: movements, isLoading } = useArticleWarehouseCard(
    companyId,
    warehouseId,
    open ? articleId : undefined,
    dateFrom,
    dateTo
  );

  // Compute running balance and totals
  const { rows, totals } = useMemo(() => {
    if (!movements) return { rows: [], totals: { debit: 0, credit: 0, balanceQty: 0, balanceValue: 0 } };

    let runningQty = 0;
    let runningValue = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const computed = movements.map((m) => {
      runningQty += m.in_quantity - m.out_quantity;
      runningValue += m.debit_value - m.credit_value;
      totalDebit += m.debit_value;
      totalCredit += m.credit_value;

      return {
        ...m,
        running_qty: runningQty,
        running_value: runningValue,
      };
    });

    return {
      rows: computed,
      totals: {
        debit: totalDebit,
        credit: totalCredit,
        balanceQty: runningQty,
        balanceValue: runningValue,
      },
    };
  }, [movements]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Robna kartica
          </DialogTitle>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>
              <span className="font-medium text-foreground">Artikal:</span>{" "}
              {articleCode} — {articleName} ({unit})
            </div>
            <div>
              <span className="font-medium text-foreground">Magacin:</span>{" "}
              {warehouseName}
            </div>
            {(dateFrom || dateTo) && (
              <div>
                <span className="font-medium text-foreground">Period:</span>{" "}
                {dateFrom ? formatDate(dateFrom) : "—"} do{" "}
                {dateTo ? formatDate(dateTo) : "—"}
              </div>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Nema proknjiženih promena za odabrani period.
          </div>
        ) : (
          <TableScrollContainer className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Datum</TableHead>
                  <TableHead className="w-[100px]">Dokument</TableHead>
                  <TableHead>Broj</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right w-[80px]">Ulaz</TableHead>
                  <TableHead className="text-right w-[80px]">Izlaz</TableHead>
                  <TableHead className="text-right w-[90px]">Cena</TableHead>
                  <TableHead className="text-right w-[110px]">Duguje</TableHead>
                  <TableHead className="text-right w-[110px]">Potražuje</TableHead>
                  <TableHead className="text-right w-[80px]">Stanje</TableHead>
                  <TableHead className="text-right w-[110px]">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{formatDate(row.movement_date)}</TableCell>
                    <TableCell>{row.document_type}</TableCell>
                    <TableCell className="font-medium">{row.document_number}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{row.partner_name}</TableCell>
                    <TableCell className="text-right">
                      {row.in_quantity > 0 ? formatDecimal(row.in_quantity) : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.out_quantity > 0 ? formatDecimal(row.out_quantity) : ""}
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(row.unit_price)}</TableCell>
                    <TableCell className="text-right">
                      {row.debit_value > 0 ? formatPrice(row.debit_value) : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.credit_value > 0 ? formatPrice(row.credit_value) : ""}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatDecimal(row.running_qty)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(row.running_value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={7} className="text-right font-semibold">
                    Ukupno:
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatPrice(totals.debit)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatPrice(totals.credit)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatDecimal(totals.balanceQty)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatPrice(totals.balanceValue)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableScrollContainer>
        )}
      </DialogContent>
    </Dialog>
  );
}
