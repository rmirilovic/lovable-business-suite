import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Package, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableArticleSelect, type Article as SearchableArticle } from "@/components/ui/searchable-article-select";
import { useArticles } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import { InvoiceItemFormData, useInvoiceItems } from "@/hooks/useInvoices";
import { formatDecimal, formatPrice, parseLocaleNumber } from "@/lib/formatting";

interface InvoiceItemsEditorProps {
  invoiceId: string;
  readOnly?: boolean;
  onTotalsChange?: (subtotal: number, vatAmount: number, total: number) => void;
}

const VAT_RATES = [0, 10, 20];

type EditingItem = Partial<InvoiceItemFormData> & { isService?: boolean };

export function InvoiceItemsEditor({ invoiceId, readOnly = false, onTotalsChange }: InvoiceItemsEditorProps) {
  const { selectedCompany } = useAuth();
  const { items, isLoading, addItem, deleteItem } = useInvoiceItems(invoiceId);

  const [editingItem, setEditingItem] = useState<EditingItem>({});
  const [isAdding, setIsAdding] = useState(false);
  const [itemType, setItemType] = useState<"article" | "service">("article");

  const { articles } = useArticles(!readOnly && isAdding ? selectedCompany?.id : undefined);

  const onTotalsChangeRef = useRef(onTotalsChange);
  useEffect(() => {
    onTotalsChangeRef.current = onTotalsChange;
  }, [onTotalsChange]);

  useEffect(() => {
    const subtotal = items.reduce((sum, item) => sum + item.line_subtotal, 0);
    const vatAmount = items.reduce((sum, item) => sum + item.line_vat, 0);
    const total = items.reduce((sum, item) => sum + item.line_total, 0);
    onTotalsChangeRef.current?.(subtotal, vatAmount, total);
  }, [items]);

  const resetEditingItem = () => {
    setEditingItem({});
    setIsAdding(false);
    setItemType("article");
  };

  const handleAddNew = (type: "article" | "service") => {
    setItemType(type);
    setIsAdding(true);
    setEditingItem({
      article_id: null,
      item_code: null,
      item_name: "",
      unit: type === "service" ? "usluga" : "kom",
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      vat_rate: 20,
      description: null,
      isService: type === "service",
    });
  };

  const handleArticleSelect = (articleId: string, article: SearchableArticle) => {
    setEditingItem((prev) => ({
      ...prev,
      article_id: articleId,
      item_code: article.code,
      item_name: article.name,
      unit: article.unit,
      unit_price: article.selling_price || 0,
      vat_rate: 20,
    }));
  };

  const handleSaveItem = async () => {
    if (!editingItem.item_name) return;

    const itemData: InvoiceItemFormData = {
      article_id: editingItem.article_id || null,
      item_code: editingItem.item_code || null,
      item_name: editingItem.item_name,
      unit: editingItem.unit || "kom",
      quantity: editingItem.quantity || 1,
      unit_price: editingItem.unit_price || 0,
      discount_percent: editingItem.discount_percent || 0,
      vat_rate: editingItem.vat_rate || 20,
      description: editingItem.description || null,
    };

    await addItem.mutateAsync({
      ...itemData,
      invoice_id: invoiceId,
    });

    resetEditingItem();
  };

  const handleDeleteItem = async (id: string) => {
    await deleteItem.mutateAsync(id);
  };

  const calculateLineTotals = () => {
    const quantity = editingItem.quantity ?? 0;
    const unitPrice = editingItem.unit_price ?? 0;
    const discountPercent = editingItem.discount_percent ?? 0;
    const vatRate = editingItem.vat_rate ?? 0;

    const subtotal = quantity * unitPrice * (1 - discountPercent / 100);
    const vat = subtotal * (vatRate / 100);

    return { subtotal, total: subtotal + vat };
  };

  const editingTotals = calculateLineTotals();

  if (isLoading) {
    return <div className="text-muted-foreground">Učitavanje stavki...</div>;
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end gap-2">
          {!isAdding && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleAddNew("article")}>
                <Package className="w-4 h-4 mr-2" />
                Dodaj artikal
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAddNew("service")}>
                <Briefcase className="w-4 h-4 mr-2" />
                Dodaj uslugu
              </Button>
            </>
          )}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead className="w-24">Šifra</TableHead>
            <TableHead className="min-w-[220px]">Naziv</TableHead>
            <TableHead className="w-20 text-center">JM</TableHead>
            <TableHead className="w-28 text-right">Količina</TableHead>
            <TableHead className="w-32 text-right">Cena</TableHead>
            <TableHead className="w-20 text-right">Rab.%</TableHead>
            <TableHead className="w-20 text-right">PDV%</TableHead>
            <TableHead className="w-32 text-right">Osnovica</TableHead>
            <TableHead className="w-32 text-right">Ukupno</TableHead>
            {!readOnly && <TableHead className="w-16"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={item.id}>
              <TableCell className="text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="font-mono text-sm">{item.item_code || "-"}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {item.article_id ? (
                    <Package className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                  )}
                  {item.item_name}
                </div>
              </TableCell>
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

          {!readOnly && isAdding && (
            <TableRow className="bg-muted/30">
              <TableCell className="text-muted-foreground">{items.length + 1}</TableCell>
              <TableCell>
                {itemType === "service" ? (
                  <Input
                    className="h-8"
                    value={editingItem.item_code || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, item_code: e.target.value })}
                    placeholder="Šifra"
                    autoComplete="off"
                  />
                ) : (
                  <span className="text-muted-foreground">{editingItem.item_code || "-"}</span>
                )}
              </TableCell>
              <TableCell>
                {itemType === "article" ? (
                  <SearchableArticleSelect
                    articles={articles}
                    value={editingItem.article_id || ""}
                    onValueChange={handleArticleSelect}
                    placeholder="Pretraži artikal..."
                  />
                ) : (
                  <Input
                    className="h-8"
                    placeholder="Naziv usluge..."
                    value={editingItem.item_name || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, item_name: e.target.value, article_id: null })}
                    autoComplete="off"
                  />
                )}
              </TableCell>
              <TableCell>
                <Input
                  className="h-8 w-16 text-center"
                  value={editingItem.unit || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                  autoComplete="off"
                />
              </TableCell>
              <TableCell>
                <LocaleNumberInput
                  className="h-8 w-24 text-right"
                  value={String(editingItem.quantity ?? 1)}
                  onChange={(val) => setEditingItem({ ...editingItem, quantity: parseLocaleNumber(val) })}
                  decimalPlaces={3}
                />
              </TableCell>
              <TableCell>
                <LocaleNumberInput
                  className="h-8 w-28 text-right"
                  value={String(editingItem.unit_price ?? 0)}
                  onChange={(val) => setEditingItem({ ...editingItem, unit_price: parseLocaleNumber(val) })}
                  decimalPlaces={2}
                />
              </TableCell>
              <TableCell>
                <LocaleNumberInput
                  className="h-8 w-16 text-right"
                  value={String(editingItem.discount_percent ?? 0)}
                  onChange={(val) => setEditingItem({ ...editingItem, discount_percent: parseLocaleNumber(val) })}
                  decimalPlaces={2}
                />
              </TableCell>
              <TableCell>
                <Select
                  value={String(editingItem.vat_rate ?? 20)}
                  onValueChange={(v) => setEditingItem({ ...editingItem, vat_rate: Number(v) })}
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
                {formatPrice(editingTotals.subtotal)}
              </TableCell>
              <TableCell className="text-right text-sm font-medium">
                {formatPrice(editingTotals.total)}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="default"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleSaveItem}
                    disabled={!editingItem.item_name || (editingItem.quantity ?? 0) <= 0 || addItem.isPending}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetEditingItem}>
                    ×
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}

          {items.length === 0 && !isAdding && (
            <TableRow>
              <TableCell colSpan={readOnly ? 10 : 11} className="text-center text-muted-foreground py-8">
                Nema stavki. Dodajte artikal ili uslugu.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

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

