import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Package, Wrench } from "lucide-react";
import { useArticles } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import { InvoiceItem, InvoiceItemFormData, useInvoiceItems } from "@/hooks/useInvoices";
import { formatDecimal, formatPrice, parseLocaleNumber } from "@/lib/formatting";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";

interface InvoiceItemsEditorProps {
  invoiceId: string;
  readOnly?: boolean;
  onTotalsChange?: (subtotal: number, vatAmount: number, total: number) => void;
}

const VAT_RATES = [0, 10, 20];

export function InvoiceItemsEditor({ invoiceId, readOnly = false, onTotalsChange }: InvoiceItemsEditorProps) {
  const { selectedCompany } = useAuth();
  const { articles } = useArticles(selectedCompany?.id);
  const { items, addItem, updateItem, deleteItem } = useInvoiceItems(invoiceId);

  const [newItem, setNewItem] = useState<InvoiceItemFormData>({
    article_id: null,
    item_code: null,
    item_name: "",
    unit: "kom",
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    vat_rate: 20,
    description: null,
  });

  const [itemType, setItemType] = useState<"article" | "service">("article");

  // Calculate totals when items change
  useEffect(() => {
    const subtotal = items.reduce((sum, item) => sum + item.line_subtotal, 0);
    const vatAmount = items.reduce((sum, item) => sum + item.line_vat, 0);
    const total = items.reduce((sum, item) => sum + item.line_total, 0);
    onTotalsChange?.(subtotal, vatAmount, total);
  }, [items, onTotalsChange]);

  const handleArticleSelect = (articleId: string) => {
    const article = articles.find(a => a.id === articleId);
    if (article) {
      setNewItem({
        article_id: articleId,
        item_code: article.code,
        item_name: article.name,
        unit: article.unit,
        quantity: 1,
        unit_price: article.selling_price,
        discount_percent: 0,
        vat_rate: 20,
        description: null,
      });
    }
  };

  const handleAddItem = async () => {
    if (!newItem.item_name || newItem.quantity <= 0) return;

    await addItem.mutateAsync({
      ...newItem,
      invoice_id: invoiceId,
    });

    // Reset form
    setNewItem({
      article_id: null,
      item_code: null,
      item_name: "",
      unit: "kom",
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      vat_rate: 20,
      description: null,
    });
  };

  const handleDeleteItem = async (id: string) => {
    await deleteItem.mutateAsync(id);
  };

  const calculateLineTotal = (item: InvoiceItemFormData) => {
    const subtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
    const vat = subtotal * (item.vat_rate / 100);
    return { subtotal, vat, total: subtotal + vat };
  };

  const newItemTotals = calculateLineTotal(newItem);

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Šifra</TableHead>
            <TableHead className="min-w-[200px]">Naziv</TableHead>
            <TableHead className="w-20 text-center">JM</TableHead>
            <TableHead className="w-24 text-right">Količina</TableHead>
            <TableHead className="w-28 text-right">Cena</TableHead>
            <TableHead className="w-20 text-right">Rab.%</TableHead>
            <TableHead className="w-20 text-right">PDV%</TableHead>
            <TableHead className="w-28 text-right">Osnovica</TableHead>
            <TableHead className="w-28 text-right">Ukupno</TableHead>
            {!readOnly && <TableHead className="w-12"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={item.id}>
              <TableCell className="text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="font-mono text-sm">{item.item_code || "-"}</TableCell>
              <TableCell>{item.item_name}</TableCell>
              <TableCell className="text-center">{item.unit}</TableCell>
              <TableCell className="text-right">{formatDecimal(item.quantity, 3)}</TableCell>
              <TableCell className="text-right">{formatPrice(item.unit_price)}</TableCell>
              <TableCell className="text-right">{formatDecimal(item.discount_percent, 2)}</TableCell>
              <TableCell className="text-right">{item.vat_rate}%</TableCell>
              <TableCell className="text-right">{formatPrice(item.line_subtotal)}</TableCell>
              <TableCell className="text-right font-medium">{formatPrice(item.line_total)}</TableCell>
              {!readOnly && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteItem(item.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}

          {/* New item row */}
          {!readOnly && (
            <TableRow className="bg-muted/30">
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant={itemType === "article" ? "default" : "outline"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setItemType("article")}
                    title="Artikal"
                  >
                    <Package className="h-3 w-3" />
                  </Button>
                  <Button
                    variant={itemType === "service" ? "default" : "outline"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setItemType("service")}
                    title="Usluga"
                  >
                    <Wrench className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
              <TableCell colSpan={2}>
                {itemType === "article" ? (
                  <Select onValueChange={handleArticleSelect} value={newItem.article_id || ""}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Izaberite artikal..." />
                    </SelectTrigger>
                    <SelectContent>
                      {articles.filter(a => a.is_active).map((article) => (
                        <SelectItem key={article.id} value={article.id}>
                          {article.code} - {article.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-8"
                    placeholder="Naziv usluge..."
                    value={newItem.item_name}
                    onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value, article_id: null, item_code: null })}
                  />
                )}
              </TableCell>
              <TableCell>
                <Input
                  className="h-8 w-16 text-center"
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <LocaleNumberInput
                  className="h-8 w-20 text-right"
                  value={String(newItem.quantity)}
                  onChange={(val) => setNewItem({ ...newItem, quantity: parseLocaleNumber(val) })}
                  decimalPlaces={3}
                />
              </TableCell>
              <TableCell>
                <LocaleNumberInput
                  className="h-8 w-24 text-right"
                  value={String(newItem.unit_price)}
                  onChange={(val) => setNewItem({ ...newItem, unit_price: parseLocaleNumber(val) })}
                  decimalPlaces={2}
                />
              </TableCell>
              <TableCell>
                <LocaleNumberInput
                  className="h-8 w-16 text-right"
                  value={String(newItem.discount_percent)}
                  onChange={(val) => setNewItem({ ...newItem, discount_percent: parseLocaleNumber(val) })}
                  decimalPlaces={2}
                />
              </TableCell>
              <TableCell>
                <Select 
                  value={String(newItem.vat_rate)} 
                  onValueChange={(v) => setNewItem({ ...newItem, vat_rate: Number(v) })}
                >
                  <SelectTrigger className="h-8 w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VAT_RATES.map((rate) => (
                      <SelectItem key={rate} value={String(rate)}>
                        {rate}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {formatPrice(newItemTotals.subtotal)}
              </TableCell>
              <TableCell className="text-right text-sm font-medium">
                {formatPrice(newItemTotals.total)}
              </TableCell>
              <TableCell>
                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleAddItem}
                  disabled={!newItem.item_name || newItem.quantity <= 0 || addItem.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Totals summary */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Osnovica:</span>
            <span>{formatPrice(items.reduce((sum, i) => sum + i.line_subtotal, 0))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">PDV:</span>
            <span>{formatPrice(items.reduce((sum, i) => sum + i.line_vat, 0))}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Ukupno:</span>
            <span>{formatPrice(items.reduce((sum, i) => sum + i.line_total, 0))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
