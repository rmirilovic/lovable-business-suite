import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { useArticles } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import { PurchaseInvoiceItem, PurchaseInvoiceItemFormData } from "@/hooks/usePurchaseInvoices";
import { formatDecimal } from "@/lib/formatting";
import { parseLocaleNumber } from "@/lib/formatting";
import { Plus, Trash2, Save, X, Pencil } from "lucide-react";

interface PurchaseInvoiceItemsEditorProps {
  invoiceId: string;
  items: PurchaseInvoiceItem[];
  onAddItem: (item: PurchaseInvoiceItemFormData & { purchase_invoice_id: string }) => Promise<any>;
  onUpdateItem: (item: PurchaseInvoiceItemFormData & { id: string }) => Promise<any>;
  onDeleteItem: (id: string) => Promise<void>;
  onTotalsChange: (subtotal: number, vatAmount: number, total: number) => void;
}

interface ItemFormState {
  article_id: string | null;
  item_code: string | null;
  item_name: string;
  unit: string;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  vat_rate: string;
  description: string | null;
}

const emptyItemForm: ItemFormState = {
  article_id: null,
  item_code: null,
  item_name: "",
  unit: "kom",
  quantity: "1",
  unit_price: "0",
  discount_percent: "0",
  vat_rate: "20",
  description: null,
};

function formToData(form: ItemFormState): PurchaseInvoiceItemFormData {
  return {
    article_id: form.article_id,
    item_code: form.item_code,
    item_name: form.item_name,
    unit: form.unit,
    quantity: parseLocaleNumber(form.quantity),
    unit_price: parseLocaleNumber(form.unit_price),
    discount_percent: parseLocaleNumber(form.discount_percent),
    vat_rate: parseLocaleNumber(form.vat_rate),
    description: form.description,
  };
}

function dataToForm(data: PurchaseInvoiceItem): ItemFormState {
  return {
    article_id: data.article_id,
    item_code: data.item_code,
    item_name: data.item_name,
    unit: data.unit,
    quantity: data.quantity.toString().replace('.', ','),
    unit_price: data.unit_price.toString().replace('.', ','),
    discount_percent: data.discount_percent.toString().replace('.', ','),
    vat_rate: data.vat_rate.toString().replace('.', ','),
    description: data.description,
  };
}

export function PurchaseInvoiceItemsEditor({
  invoiceId,
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onTotalsChange,
}: PurchaseInvoiceItemsEditorProps) {
  const { selectedCompany } = useAuth();
  const { articles } = useArticles(selectedCompany?.id);
  const [newItem, setNewItem] = useState<ItemFormState>({ ...emptyItemForm });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ItemFormState | null>(null);

  // Store callback ref to prevent infinite loops
  const onTotalsChangeRef = useRef(onTotalsChange);
  onTotalsChangeRef.current = onTotalsChange;

  // Calculate totals - only depend on items, use ref for callback
  useEffect(() => {
    const subtotal = items.reduce((sum, item) => sum + item.line_subtotal, 0);
    const vatAmount = items.reduce((sum, item) => sum + item.line_vat, 0);
    const total = items.reduce((sum, item) => sum + item.line_total, 0);
    onTotalsChangeRef.current(subtotal, vatAmount, total);
  }, [items]);

  const calculateLineAmounts = (form: ItemFormState) => {
    const qty = parseLocaleNumber(form.quantity);
    const price = parseLocaleNumber(form.unit_price);
    const discount = parseLocaleNumber(form.discount_percent);
    const vat = parseLocaleNumber(form.vat_rate);
    
    const lineSubtotal = qty * price * (1 - discount / 100);
    const lineVat = lineSubtotal * (vat / 100);
    const lineTotal = lineSubtotal + lineVat;
    return { lineSubtotal, lineVat, lineTotal };
  };

  const handleArticleSelect = (
    articleId: string,
    setItem: React.Dispatch<React.SetStateAction<ItemFormState>>
  ) => {
    const article = articles.find((a) => a.id === articleId);
    if (article) {
      setItem((prev) => ({
        ...prev,
        article_id: articleId,
        item_code: article.code,
        item_name: article.name,
        unit: article.unit,
        unit_price: (article.purchase_price || 0).toString().replace('.', ','),
        vat_rate: "20", // Default VAT rate
      }));
    }
  };

  const handleAddItem = async () => {
    if (!newItem.item_name) return;
    await onAddItem({ ...formToData(newItem), purchase_invoice_id: invoiceId });
    setNewItem({ ...emptyItemForm });
  };

  const handleStartEdit = (item: PurchaseInvoiceItem) => {
    setEditingItemId(item.id);
    setEditingItem(dataToForm(item));
  };

  const handleSaveEdit = async () => {
    if (!editingItemId || !editingItem) return;
    await onUpdateItem({ id: editingItemId, ...formToData(editingItem) });
    setEditingItemId(null);
    setEditingItem(null);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingItem(null);
  };

  const newLineAmounts = calculateLineAmounts(newItem);
  const totals = {
    subtotal: items.reduce((sum, item) => sum + item.line_subtotal, 0),
    vatAmount: items.reduce((sum, item) => sum + item.line_vat, 0),
    total: items.reduce((sum, item) => sum + item.line_total, 0),
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Stavke</h3>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">R.br.</TableHead>
              <TableHead className="min-w-[200px]">Artikal</TableHead>
              <TableHead className="w-[80px]">JM</TableHead>
              <TableHead className="w-[100px] text-right">Količina</TableHead>
              <TableHead className="w-[120px] text-right">Cena</TableHead>
              <TableHead className="w-[80px] text-right">Popust %</TableHead>
              <TableHead className="w-[80px] text-right">PDV %</TableHead>
              <TableHead className="w-[120px] text-right">Iznos</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  {editingItemId === item.id && editingItem ? (
                    <SearchableArticleSelect
                      articles={articles}
                      value={editingItem.article_id || ""}
                      onValueChange={(value) =>
                        handleArticleSelect(value, setEditingItem)
                      }
                      placeholder="Izaberi artikal"
                    />
                  ) : (
                    <div>
                      <div className="font-medium">{item.item_name}</div>
                      {item.item_code && (
                        <div className="text-sm text-muted-foreground">{item.item_code}</div>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {editingItemId === item.id && editingItem ? (
                    <Input
                      value={editingItem.unit}
                      onChange={(e) =>
                        setEditingItem((prev) => prev && { ...prev, unit: e.target.value })
                      }
                      className="w-16"
                    />
                  ) : (
                    item.unit
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingItemId === item.id && editingItem ? (
                    <LocaleNumberInput
                      value={editingItem.quantity}
                      onChange={(value) =>
                        setEditingItem((prev) => prev && { ...prev, quantity: value })
                      }
                      decimalPlaces={3}
                      className="w-24 text-right"
                    />
                  ) : (
                    formatDecimal(item.quantity, 3)
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingItemId === item.id && editingItem ? (
                    <LocaleNumberInput
                      value={editingItem.unit_price}
                      onChange={(value) =>
                        setEditingItem((prev) => prev && { ...prev, unit_price: value })
                      }
                      decimalPlaces={4}
                      className="w-28 text-right"
                    />
                  ) : (
                    formatDecimal(item.unit_price, 4)
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingItemId === item.id && editingItem ? (
                    <LocaleNumberInput
                      value={editingItem.discount_percent}
                      onChange={(value) =>
                        setEditingItem((prev) => prev && { ...prev, discount_percent: value })
                      }
                      decimalPlaces={2}
                      className="w-20 text-right"
                    />
                  ) : (
                    formatDecimal(item.discount_percent, 2)
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingItemId === item.id && editingItem ? (
                    <LocaleNumberInput
                      value={editingItem.vat_rate}
                      onChange={(value) =>
                        setEditingItem((prev) => prev && { ...prev, vat_rate: value })
                      }
                      decimalPlaces={0}
                      className="w-16 text-right"
                    />
                  ) : (
                    formatDecimal(item.vat_rate, 0)
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatDecimal(item.line_total, 2)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {editingItemId === item.id ? (
                      <>
                        <Button size="icon" variant="ghost" onClick={handleSaveEdit}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={handleCancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleStartEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onDeleteItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {/* New item row */}
            <TableRow className="bg-muted/50">
              <TableCell>
                <span className="text-muted-foreground">Novo</span>
              </TableCell>
              <TableCell>
                <SearchableArticleSelect
                  articles={articles}
                  value={newItem.article_id || ""}
                  onValueChange={(value) => handleArticleSelect(value, setNewItem)}
                  placeholder="Izaberi artikal..."
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  className="w-16"
                />
              </TableCell>
              <TableCell>
                <LocaleNumberInput
                  value={newItem.quantity}
                  onChange={(value) => setNewItem({ ...newItem, quantity: value })}
                  decimalPlaces={3}
                  className="w-24 text-right"
                />
              </TableCell>
              <TableCell>
                <LocaleNumberInput
                  value={newItem.unit_price}
                  onChange={(value) => setNewItem({ ...newItem, unit_price: value })}
                  decimalPlaces={4}
                  className="w-28 text-right"
                />
              </TableCell>
              <TableCell>
                <LocaleNumberInput
                  value={newItem.discount_percent}
                  onChange={(value) => setNewItem({ ...newItem, discount_percent: value })}
                  decimalPlaces={2}
                  className="w-20 text-right"
                />
              </TableCell>
              <TableCell>
                <LocaleNumberInput
                  value={newItem.vat_rate}
                  onChange={(value) => setNewItem({ ...newItem, vat_rate: value })}
                  decimalPlaces={0}
                  className="w-16 text-right"
                />
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatDecimal(newLineAmounts.lineTotal, 2)}
              </TableCell>
              <TableCell>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleAddItem}
                  disabled={!newItem.item_name}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Osnovica:</span>
            <span className="font-medium">{formatDecimal(totals.subtotal, 2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>PDV:</span>
            <span className="font-medium">{formatDecimal(totals.vatAmount, 2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Ukupno:</span>
            <span>{formatDecimal(totals.total, 2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
