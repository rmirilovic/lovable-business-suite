import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Download, Trash2 } from "lucide-react";
import { CustomsClearanceItem } from "@/hooks/useCustomsClearances";
import { formatPrice, formatNumber } from "@/lib/formatting";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { useState } from "react";

interface Props {
  items: CustomsClearanceItem[];
  isLoading: boolean;
  isEditable: boolean;
  onImport: () => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
}

export function CustomsClearanceItemsEditor({
  items,
  isLoading,
  isEditable,
  onImport,
  onUpdateQuantity,
  onRemoveItem,
}: Props) {
  // Track local quantity strings for each item
  const [qtyValues, setQtyValues] = useState<Record<string, string>>({});

  const getQtyValue = (item: CustomsClearanceItem) => {
    return qtyValues[item.id] ?? formatDecimal(item.quantity, item.quantity % 1 === 0 ? 0 : 3);
  };

  const handleQtyChange = (itemId: string, value: string) => {
    setQtyValues((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleQtyBlur = (item: CustomsClearanceItem, value: string) => {
    const num = parseLocaleNumber(value);
    const clamped = Math.min(Math.max(0, num), item.available_quantity);
    onUpdateQuantity(item.id, clamped);
    setQtyValues((prev) => ({ ...prev, [item.id]: formatDecimal(clamped, clamped % 1 === 0 ? 0 : 3) }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Stavke carinskog obračuna</h3>
        {isEditable && (
          <Button variant="outline" size="sm" onClick={onImport}>
            <Download className="h-4 w-4 mr-2" /> Preuzmi stavke iz UFR
          </Button>
        )}
      </div>

      <TableScrollContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead className="min-w-[50px]">Šifra</TableHead>
              <TableHead className="min-w-[130px]">Naziv</TableHead>
              <TableHead className="w-[50px]">JM</TableHead>
              <TableHead className="w-[100px] text-right">Raspolož.</TableHead>
              <TableHead className="w-[110px] text-right">Količina</TableHead>
              <TableHead className="w-[100px] text-right">Fakt. cena</TableHead>
              <TableHead className="w-[110px] text-right">Fakt. vr. RSD</TableHead>
              <TableHead className="w-[100px] text-right">Zav. troš.</TableHead>
              <TableHead className="w-[90px] text-right">Carina</TableHead>
              <TableHead className="w-[90px] text-right">Akciza</TableHead>
              <TableHead className="w-[100px] text-right">Nab. cena</TableHead>
              <TableHead className="w-[110px] text-right">Nab. vred.</TableHead>
              {isEditable && <TableHead className="w-[40px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isEditable ? 14 : 13} className="text-center py-8 text-muted-foreground">
                  Nema stavki. Kliknite "Preuzmi stavke iz UFR" da preuzmete stavke.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>{item.item_code || "-"}</TableCell>
                  <TableCell>{item.item_name}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatNumber(item.available_quantity, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</TableCell>
                  <TableCell className="text-right">
                    {isEditable ? (
                      <LocaleNumberInput
                        value={getQtyValue(item)}
                        onChange={(v) => handleQtyChange(item.id, v)}
                        onBlur={() => handleQtyBlur(item, getQtyValue(item))}
                        decimalPlaces={3}
                        className="w-24 text-right"
                      />
                    ) : (
                      formatNumber(item.quantity, { minimumFractionDigits: 0, maximumFractionDigits: 3 })
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatPrice(item.invoice_price)}</TableCell>
                  <TableCell className="text-right">{formatPrice(item.invoice_value_rsd)}</TableCell>
                  <TableCell className="text-right">{formatPrice(item.allocated_costs)}</TableCell>
                  <TableCell className="text-right">{formatPrice(item.allocated_customs_duty)}</TableCell>
                  <TableCell className="text-right">{formatPrice(item.allocated_excise)}</TableCell>
                  <TableCell className="text-right font-medium">{formatPrice(item.cost_price)}</TableCell>
                  <TableCell className="text-right font-medium">{formatPrice(item.cost_value)}</TableCell>
                  {isEditable && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => onRemoveItem(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
            {items.length > 0 && (
              <TableRow className="bg-muted/50 font-medium">
                <TableCell colSpan={5} className="text-right">Ukupno:</TableCell>
                <TableCell className="text-right">{formatNumber(items.reduce((s, i) => s + i.quantity, 0), { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</TableCell>
                <TableCell />
                <TableCell className="text-right">{formatPrice(items.reduce((s, i) => s + i.invoice_value_rsd, 0))}</TableCell>
                <TableCell className="text-right">{formatPrice(items.reduce((s, i) => s + i.allocated_costs, 0))}</TableCell>
                <TableCell className="text-right">{formatPrice(items.reduce((s, i) => s + i.allocated_customs_duty, 0))}</TableCell>
                <TableCell className="text-right">{formatPrice(items.reduce((s, i) => s + i.allocated_excise, 0))}</TableCell>
                <TableCell />
                <TableCell className="text-right">{formatPrice(items.reduce((s, i) => s + i.cost_value, 0))}</TableCell>
                {isEditable && <TableCell />}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableScrollContainer>
    </div>
  );
}
