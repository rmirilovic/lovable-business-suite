import { useState, useCallback } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, MoreHorizontal } from "lucide-react";
import { CalculationItem } from "@/hooks/usePurchasePriceCalculations";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { ArticleCalculationsDialog } from "@/components/magacin/ArticleCalculationsDialog";

interface CalculationItemsTableProps {
  items: CalculationItem[];
  isLoading: boolean;
  isEditable: boolean;
  onUpdateMarkup: (itemId: string, markupPercent: number) => void;
  onUpdateMarkupAmount: (itemId: string, markupAmount: number) => void;
  onUpdateSellingPrice: (itemId: string, sellingPrice: number) => void;
}

/** Wrapper that keeps local text state and only commits the parsed number on blur */
function BlurCommitNumberInput({
  value,
  onCommit,
  decimalPlaces = 2,
  className,
}: {
  value: number;
  onCommit: (num: number) => void;
  decimalPlaces?: number;
  className?: string;
}) {
  const [localVal, setLocalVal] = useState(formatDecimal(value, decimalPlaces));
  const [focused, setFocused] = useState(false);

  // Sync from parent when not focused
  if (!focused && formatDecimal(value, decimalPlaces) !== localVal) {
    setLocalVal(formatDecimal(value, decimalPlaces));
  }

  return (
    <LocaleNumberInput
      value={localVal}
      onChange={setLocalVal}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const num = parseLocaleNumber(localVal);
        if (!isNaN(num)) {
          onCommit(num);
        }
      }}
      decimalPlaces={decimalPlaces}
      className={className}
    />
  );
}

export function CalculationItemsTable({
  items,
  isLoading,
  isEditable,
  onUpdateMarkup,
  onUpdateMarkupAmount,
  onUpdateSellingPrice,
}: CalculationItemsTableProps) {
  const [calcDialogArticle, setCalcDialogArticle] = useState<{ id: string; code: string; name: string } | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totals = items.reduce(
    (acc, item) => ({
      purchaseValue: acc.purchaseValue + item.purchase_value,
      allocatedCosts: acc.allocatedCosts + item.allocated_costs,
      costValue: acc.costValue + item.cost_value,
      markupValue: acc.markupValue + (item.markup_amount * item.quantity),
      sellingValue: acc.sellingValue + item.selling_value,
    }),
    { purchaseValue: 0, allocatedCosts: 0, costValue: 0, markupValue: 0, sellingValue: 0 }
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Stavke kalkulacije</h3>

      <TableScrollContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead className="min-w-[60px]">Šifra</TableHead>
              <TableHead className="min-w-[150px]">Naziv</TableHead>
              <TableHead className="w-[50px]">JM</TableHead>
              <TableHead className="w-[70px] text-right">Kol.</TableHead>
              <TableHead className="w-[100px] text-right">Nab. cena</TableHead>
              <TableHead className="w-[110px] text-right">Nab. vredn.</TableHead>
              <TableHead className="w-[100px] text-right">Zav. troš.</TableHead>
              <TableHead className="w-[100px] text-right">Bruto cena</TableHead>
              <TableHead className="w-[110px] text-right">Bruto vrednost</TableHead>
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                  Nema stavki.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, idx) => {
                const isGoods = item.svk === "1"; // SVK=1 means Roba (goods)

                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="text-sm">{item.item_code || "—"}</TableCell>
                    <TableCell className="text-sm">{item.item_name}</TableCell>
                    <TableCell className="text-sm">{item.unit}</TableCell>
                    <TableCell className="text-right">{formatDecimal(item.quantity, 3)}</TableCell>
                    <TableCell className="text-right">{formatDecimal(item.purchase_price, 2)}</TableCell>
                    <TableCell className="text-right">{formatDecimal(item.purchase_value, 2)}</TableCell>
                    <TableCell className="text-right">{formatDecimal(item.allocated_costs, 2)}</TableCell>
                    <TableCell className="text-right font-medium">{formatDecimal(item.cost_price, 2)}</TableCell>
                    <TableCell className="text-right font-medium">{formatDecimal(item.cost_value, 2)}</TableCell>
                    <TableCell>
                      {isEditable && isGoods ? (
                        <BlurCommitNumberInput
                          value={item.markup_percent}
                          onCommit={(pct) => onUpdateMarkup(item.id, pct)}
                          decimalPlaces={2}
                          className="text-right w-[80px]"
                        />
                      ) : (
                        <span className="block text-right">{formatDecimal(item.markup_percent, 2)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditable && isGoods ? (
                        <BlurCommitNumberInput
                          value={item.markup_amount}
                          onCommit={(amt) => onUpdateMarkupAmount(item.id, amt)}
                          decimalPlaces={2}
                          className="text-right w-[90px]"
                        />
                      ) : (
                        <span className="block text-right">{formatDecimal(item.markup_amount, 2)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditable && isGoods ? (
                        <BlurCommitNumberInput
                          value={item.selling_price}
                          onCommit={(price) => onUpdateSellingPrice(item.id, price)}
                          decimalPlaces={2}
                          className="text-right w-[90px]"
                        />
                      ) : (
                        <span className="block text-right font-medium">{formatDecimal(item.selling_price, 2)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatDecimal(item.selling_value, 2)}
                    </TableCell>
                    <TableCell className="p-0">
                      {item.article_id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setCalcDialogArticle({ id: item.article_id!, code: item.item_code || "", name: item.item_name })}>
                              Na kalkulacijama
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
            {items.length > 0 && (
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={6} className="text-right">Ukupno:</TableCell>
                <TableCell className="text-right">{formatDecimal(totals.purchaseValue, 2)}</TableCell>
                <TableCell className="text-right">{formatDecimal(totals.allocatedCosts, 2)}</TableCell>
                <TableCell />
                <TableCell className="text-right">{formatDecimal(totals.costValue, 2)}</TableCell>
                <TableCell />
                <TableCell className="text-right">{formatDecimal(totals.markupValue, 2)}</TableCell>
                <TableCell />
                <TableCell className="text-right">{formatDecimal(totals.sellingValue, 2)}</TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableScrollContainer>

      <ArticleCalculationsDialog
        open={!!calcDialogArticle}
        onOpenChange={(open) => { if (!open) setCalcDialogArticle(null); }}
        articleId={calcDialogArticle?.id ?? null}
        articleCode={calcDialogArticle?.code ?? ""}
        articleName={calcDialogArticle?.name ?? ""}
      />
    </div>
  );
}
