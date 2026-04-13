import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Loader2, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useArticleWarehouseCard } from "@/hooks/useWarehouseStock";
import { formatPrice, formatDecimal, formatDate } from "@/lib/formatting";
import { exportCardToExcel, exportCardToPdf, printCard } from "@/lib/warehouseExportUtils";
import { toast } from "sonner";

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
  variantId?: string;
  variantCode?: string;
  variantDescription?: string;
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
  variantId,
  variantCode,
  variantDescription,
}: ArticleWarehouseCardDialogProps) {
  const { data: movements, isLoading } = useArticleWarehouseCard(
    companyId,
    warehouseId,
    open ? articleId : undefined,
    dateFrom,
    dateTo,
    variantId
  );

  const [exporting, setExporting] = useState(false);

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

  const meta = { articleCode, articleName, unit, warehouseName, dateFrom, dateTo };

  const handleExcelExport = () => {
    if (rows.length === 0) return;
    exportCardToExcel(rows, meta, totals);
    toast.success("Excel fajl je kreiran.");
  };

  const handlePdfExport = async () => {
    if (rows.length === 0) return;
    setExporting(true);
    try {
      await exportCardToPdf(rows, meta, totals);
      toast.success("PDF fajl je kreiran.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    if (rows.length === 0) return;
    setExporting(true);
    try {
      await printCard(rows, meta, totals);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col" onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>Robna kartica</DialogTitle>
            {rows.length > 0 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={exporting}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handlePdfExport} disabled={exporting}>
                  <FileText className="h-4 w-4 mr-1" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} disabled={exporting}>
                  <Printer className="h-4 w-4 mr-1" />
                  Štampaj
                </Button>
              </div>
            )}
          </div>
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
                  <TableHead>Dokument</TableHead>
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
                {rows.map((row, idx) => {
                  const isDonos = row.document_type === 'Donos';
                  return (
                  <TableRow key={idx} className={isDonos ? "bg-muted/50 font-semibold" : ""}>
                    <TableCell>{formatDate(row.movement_date)}</TableCell>
                    <TableCell className="font-medium">{isDonos ? 'Donos' : `${row.document_type} ${row.document_number}`}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{row.partner_name}</TableCell>
                    <TableCell className="text-right">
                      {row.in_quantity !== 0 ? formatDecimal(row.in_quantity) : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.out_quantity !== 0 ? formatDecimal(row.out_quantity) : ""}
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(row.unit_price)}</TableCell>
                    <TableCell className="text-right">
                      {row.debit_value !== 0 ? formatPrice(row.debit_value) : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.credit_value !== 0 ? formatPrice(row.credit_value) : ""}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatDecimal(row.running_qty)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(row.running_value)}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6} className="text-right font-semibold">
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
