import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { useArticles } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import {
  PurchaseInvoiceItem,
  PurchaseInvoiceItemFormData,
} from "@/hooks/usePurchaseInvoices";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";

interface PurchaseInvoiceItemsEditorProps {
  invoiceId: string;
  items: PurchaseInvoiceItem[];
  onAddItem: (item: PurchaseInvoiceItemFormData & { purchase_invoice_id: string }) => Promise<any>;
  onUpdateItem: (item: PurchaseInvoiceItemFormData & { id: string }) => Promise<any>;
  onDeleteItem: (id: string) => Promise<void>;
  onTotalsChange: (subtotal: number, vatAmount: number, total: number) => void;
  isReadOnly?: boolean;
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

const VAT_RATES = [0, 10, 20];

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
    quantity: formatDecimal(data.quantity, 3),
    unit_price: formatDecimal(data.unit_price, 4),
    discount_percent: formatDecimal(data.discount_percent, 2),
    vat_rate: String(data.vat_rate),
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
  isReadOnly = false,
}: PurchaseInvoiceItemsEditorProps) {
  const { selectedCompany } = useAuth();
  const { articles } = useArticles(selectedCompany?.id);
  const [editingItem, setEditingItem] = useState<
    (ItemFormState & { id?: string }) | null
  >(null);
  const [isAdding, setIsAdding] = useState(false);

  // Store callback ref to prevent infinite loops
  const onTotalsChangeRef = useRef(onTotalsChange);
  onTotalsChangeRef.current = onTotalsChange;

  // Calculate totals - only depend on items
  useEffect(() => {
    const subtotal = items.reduce((sum, item) => sum + item.line_subtotal, 0);
    const vatAmount = items.reduce((sum, item) => sum + item.line_vat, 0);
    const total = items.reduce((sum, item) => sum + item.line_total, 0);
    onTotalsChangeRef.current(subtotal, vatAmount, total);
  }, [items]);

  const resetEditingItem = () => {
    setEditingItem(null);
    setIsAdding(false);
  };

  const handleAddNew = () => {
    setIsAdding(true);
    setEditingItem({ ...emptyItemForm });
  };

  const handleArticleSelect = (articleId: string) => {
    const article = articles.find((a) => a.id === articleId);
    if (article && editingItem) {
      setEditingItem({
        ...editingItem,
        article_id: article.id,
        item_code: article.code,
        item_name: article.name,
        unit: article.unit,
        unit_price: formatDecimal(article.purchase_price || 0, 4),
        vat_rate: "20", // Default VAT rate
      });
    }
  };

  const handleSaveItem = async () => {
    if (!editingItem || !editingItem.item_name) return;

    if (editingItem.id) {
      await onUpdateItem({ id: editingItem.id, ...formToData(editingItem) });
    } else {
      await onAddItem({ ...formToData(editingItem), purchase_invoice_id: invoiceId });
    }
    resetEditingItem();
  };

  const handleEditItem = (item: PurchaseInvoiceItem) => {
    setEditingItem({ ...dataToForm(item), id: item.id });
    setIsAdding(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm("Da li ste sigurni da želite da obrišete ovu stavku?")) {
      await onDeleteItem(id);
    }
  };

  const calculateLineTotal = () => {
    if (!editingItem) return 0;
    const qty = parseLocaleNumber(editingItem.quantity);
    const price = parseLocaleNumber(editingItem.unit_price);
    const discount = parseLocaleNumber(editingItem.discount_percent);
    const vat = parseLocaleNumber(editingItem.vat_rate);

    const subtotal = qty * price * (1 - discount / 100);
    const vatAmount = subtotal * (vat / 100);
    return subtotal + vatAmount;
  };

  const totals = {
    subtotal: items.reduce((sum, item) => sum + item.line_subtotal, 0),
    vatAmount: items.reduce((sum, item) => sum + item.line_vat, 0),
    total: items.reduce((sum, item) => sum + item.line_total, 0),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Stavke</h3>
        {!isReadOnly && !isAdding && (
          <Button type="button" size="sm" variant="outline" onClick={handleAddNew}>
            <Plus className="w-4 h-4 mr-2" />
            Dodaj stavku
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-24">Šifra</TableHead>
              <TableHead className="min-w-[200px]">Naziv</TableHead>
              <TableHead className="text-right w-28">Količina</TableHead>
              <TableHead className="w-16">JM</TableHead>
              <TableHead className="text-right w-32">Cena</TableHead>
              <TableHead className="text-right w-20">Rabat %</TableHead>
              <TableHead className="text-right w-20">PDV %</TableHead>
              <TableHead className="text-right w-32">Ukupno</TableHead>
              {!isReadOnly && <TableHead className="w-24"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow
                key={item.id}
                className={editingItem?.id === item.id ? "bg-muted" : ""}
              >
                {editingItem?.id === item.id ? (
                  <EditingRow
                    editingItem={editingItem}
                    setEditingItem={setEditingItem}
                    articles={articles}
                    onArticleSelect={handleArticleSelect}
                    onSave={handleSaveItem}
                    onCancel={resetEditingItem}
                    index={index + 1}
                    calculateLineTotal={calculateLineTotal}
                  />
                ) : (
                  <>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.item_code || "-"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{item.item_name}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDecimal(item.quantity, 3)}
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
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
                    {!isReadOnly && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditItem(item)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </>
                )}
              </TableRow>
            ))}

            {isAdding && !editingItem?.id && editingItem && (
              <TableRow className="bg-muted">
                <EditingRow
                  editingItem={editingItem}
                  setEditingItem={setEditingItem}
                  articles={articles}
                  onArticleSelect={handleArticleSelect}
                  onSave={handleSaveItem}
                  onCancel={resetEditingItem}
                  index={items.length + 1}
                  calculateLineTotal={calculateLineTotal}
                />
              </TableRow>
            )}

            {items.length === 0 && !isAdding && (
              <TableRow>
                <TableCell
                  colSpan={isReadOnly ? 9 : 10}
                  className="text-center text-muted-foreground py-8"
                >
                  Nema stavki. {!isReadOnly && "Kliknite 'Dodaj stavku' za unos."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Osnovica:</span>
            <span>{formatDecimal(totals.subtotal, 2)} RSD</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>PDV:</span>
            <span>{formatDecimal(totals.vatAmount, 2)} RSD</span>
          </div>
          <div className="flex justify-between font-semibold text-lg border-t pt-2">
            <span>Ukupno:</span>
            <span>{formatDecimal(totals.total, 2)} RSD</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EditingRowProps {
  editingItem: ItemFormState & { id?: string };
  setEditingItem: React.Dispatch<
    React.SetStateAction<(ItemFormState & { id?: string }) | null>
  >;
  articles: any[];
  onArticleSelect: (articleId: string) => void;
  onSave: () => void;
  onCancel: () => void;
  index: number;
  calculateLineTotal: () => number;
}

function EditingRow({
  editingItem,
  setEditingItem,
  articles,
  onArticleSelect,
  onSave,
  onCancel,
  index,
  calculateLineTotal,
}: EditingRowProps) {
  const [qtyStr, setQtyStr] = useState(editingItem.quantity);
  const [unitPriceStr, setUnitPriceStr] = useState(editingItem.unit_price);
  const [discountStr, setDiscountStr] = useState(editingItem.discount_percent);

  useEffect(() => {
    setQtyStr(editingItem.quantity);
    setUnitPriceStr(editingItem.unit_price);
    setDiscountStr(editingItem.discount_percent);
  }, [editingItem.id]);

  const handleArticleChange = (articleId: string) => {
    onArticleSelect(articleId);
  };

  return (
    <>
      <TableCell>{index}</TableCell>
      <TableCell>
        <span className="text-muted-foreground">{editingItem.item_code || "-"}</span>
      </TableCell>
      <TableCell className="min-w-[200px]">
        <SearchableArticleSelect
          articles={articles}
          value={editingItem.article_id || ""}
          onValueChange={handleArticleChange}
          placeholder="Pretraži artikal..."
        />
      </TableCell>
      <TableCell>
        <LocaleNumberInput
          value={qtyStr}
          onChange={setQtyStr}
          decimalPlaces={3}
          allowEmpty
          className="h-8 text-right w-24"
          onBlur={() => {
            const num = parseLocaleNumber(qtyStr);
            setEditingItem((prev) =>
              prev ? { ...prev, quantity: isNaN(num) ? "0" : formatDecimal(num, 3) } : null
            );
          }}
        />
      </TableCell>
      <TableCell>
        <Input
          value={editingItem.unit}
          onChange={(e) =>
            setEditingItem((prev) => (prev ? { ...prev, unit: e.target.value } : null))
          }
          className="h-8 w-16"
          autoComplete="off"
        />
      </TableCell>
      <TableCell>
        <LocaleNumberInput
          value={unitPriceStr}
          onChange={setUnitPriceStr}
          decimalPlaces={4}
          allowEmpty
          className="h-8 text-right w-28"
          onBlur={() => {
            const num = parseLocaleNumber(unitPriceStr);
            setEditingItem((prev) =>
              prev
                ? { ...prev, unit_price: isNaN(num) ? "0" : formatDecimal(num, 4) }
                : null
            );
          }}
        />
      </TableCell>
      <TableCell>
        <LocaleNumberInput
          value={discountStr}
          onChange={setDiscountStr}
          decimalPlaces={2}
          allowEmpty
          className="h-8 text-right w-16"
          onBlur={() => {
            const num = parseLocaleNumber(discountStr);
            setEditingItem((prev) =>
              prev
                ? {
                    ...prev,
                    discount_percent: formatDecimal(
                      Math.min(100, Math.max(0, isNaN(num) ? 0 : num)),
                      2
                    ),
                  }
                : null
            );
          }}
        />
      </TableCell>
      <TableCell>
        <Select
          value={editingItem.vat_rate}
          onValueChange={(v) =>
            setEditingItem((prev) => (prev ? { ...prev, vat_rate: v } : null))
          }
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
      <TableCell className="text-right font-medium w-32">
        {formatDecimal(calculateLineTotal(), 2)}
      </TableCell>
      <TableCell className="w-24">
        <div className="flex gap-1 flex-nowrap">
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={!editingItem.item_name}
          >
            OK
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            X
          </Button>
        </div>
      </TableCell>
    </>
  );
}
