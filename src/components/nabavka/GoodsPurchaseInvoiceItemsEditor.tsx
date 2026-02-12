import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, X, Trash2 } from "lucide-react";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { useArticles } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import {
  GoodsPurchaseInvoiceItem,
  GoodsPurchaseInvoiceItemFormData,
} from "@/hooks/useGoodsPurchaseInvoices";
import { formatNumber, parseLocaleNumber } from "@/lib/formatting";
import { UseMutationResult } from "@tanstack/react-query";

interface GoodsPurchaseInvoiceItemsEditorProps {
  invoiceId: string;
  items: GoodsPurchaseInvoiceItem[];
  isLoading: boolean;
  isEditable: boolean;
  supplierIsInPdv: boolean;
  addItem: UseMutationResult<GoodsPurchaseInvoiceItem, Error, GoodsPurchaseInvoiceItemFormData & { goods_purchase_invoice_id: string }>;
  updateItem: UseMutationResult<GoodsPurchaseInvoiceItem, Error, GoodsPurchaseInvoiceItemFormData & { id: string }>;
  deleteItem: UseMutationResult<void, Error, string>;
}

const emptyItem: GoodsPurchaseInvoiceItemFormData = {
  article_id: null,
  item_code: null,
  item_name: "",
  description: null,
  quantity: 1,
  unit: "kom",
  unit_price: 0,
  discount_percent: 0,
  vat_rate: 20,
  is_vat_deductible: true,
};

interface TextState {
  quantity: string;
  unit_price: string;
  discount_percent: string;
  vat_rate: string;
}

const numToStr = (n: number): string => String(n ?? 0);

const toTextState = (item: GoodsPurchaseInvoiceItemFormData): TextState => ({
  quantity: numToStr(item.quantity),
  unit_price: numToStr(item.unit_price),
  discount_percent: numToStr(item.discount_percent),
  vat_rate: numToStr(item.vat_rate),
});

const parseNum = (s: string): number => {
  const n = parseLocaleNumber(s);
  return isNaN(n) ? 0 : n;
};

export function GoodsPurchaseInvoiceItemsEditor({
  invoiceId,
  items,
  isLoading,
  isEditable,
  supplierIsInPdv,
  addItem,
  updateItem,
  deleteItem,
}: GoodsPurchaseInvoiceItemsEditorProps) {
  const { selectedCompany } = useAuth();
  const { articles } = useArticles(selectedCompany?.id);

  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<GoodsPurchaseInvoiceItemFormData>(emptyItem);
  const [newText, setNewText] = useState<TextState>(toTextState(emptyItem));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<GoodsPurchaseInvoiceItemFormData>(emptyItem);
  const [editText, setEditText] = useState<TextState>(toTextState(emptyItem));

  const activeArticles = articles.filter((a) => a.is_active);

  const handleArticleSelect = (articleId: string, isNew: boolean) => {
    const article = articles.find((a) => a.id === articleId);
    if (!article) return;

    const itemData = {
      article_id: article.id,
      item_code: article.code,
      item_name: article.name,
      unit: article.unit,
      vat_rate: 20,
      unit_price: article.purchase_price ?? 0,
    };

    if (isNew) {
      setNewItem((prev) => ({ ...prev, ...itemData }));
      setNewText((prev) => ({
        ...prev,
        unit_price: numToStr(itemData.unit_price),
        vat_rate: numToStr(itemData.vat_rate),
      }));
    } else {
      setEditItem((prev) => ({ ...prev, ...itemData }));
      setEditText((prev) => ({
        ...prev,
        unit_price: numToStr(itemData.unit_price),
        vat_rate: numToStr(itemData.vat_rate),
      }));
    }
  };

  const calculateNetPrice = (unitPrice: number, discountPercent: number) => {
    return unitPrice * (1 - discountPercent / 100);
  };

  const calculateLineTotal = (item: GoodsPurchaseInvoiceItemFormData) => {
    const netPrice = calculateNetPrice(item.unit_price, item.discount_percent);
    const subtotal = item.quantity * netPrice;
    const vat = supplierIsInPdv ? subtotal * (item.vat_rate / 100) : 0;
    return { netPrice, subtotal, vat, total: subtotal + vat };
  };

  // Derived totals for display using current text states
  const getNewTotals = () => {
    const q = parseNum(newText.quantity);
    const p = parseNum(newText.unit_price);
    const d = parseNum(newText.discount_percent);
    const v = parseNum(newText.vat_rate);
    const net = p * (1 - d / 100);
    const sub = q * net;
    const vat = supplierIsInPdv ? sub * (v / 100) : 0;
    return { netPrice: net, total: sub + vat };
  };

  const getEditTotals = () => {
    const q = parseNum(editText.quantity);
    const p = parseNum(editText.unit_price);
    const d = parseNum(editText.discount_percent);
    const v = parseNum(editText.vat_rate);
    const net = p * (1 - d / 100);
    const sub = q * net;
    const vat = supplierIsInPdv ? sub * (v / 100) : 0;
    return { netPrice: net, total: sub + vat };
  };

  const commitNewField = (field: keyof TextState) => {
    const val = parseNum(newText[field]);
    setNewItem((prev) => ({ ...prev, [field]: val }));
  };

  const commitEditField = (field: keyof TextState) => {
    const val = parseNum(editText[field]);
    setEditItem((prev) => ({ ...prev, [field]: val }));
  };

  const handleAddSubmit = async () => {
    if (!newItem.item_name) return;
    // Commit all text fields before submit
    const committed = {
      ...newItem,
      quantity: parseNum(newText.quantity),
      unit_price: parseNum(newText.unit_price),
      discount_percent: parseNum(newText.discount_percent),
      vat_rate: parseNum(newText.vat_rate),
    };
    await addItem.mutateAsync({
      goods_purchase_invoice_id: invoiceId,
      ...committed,
    });
    setNewItem(emptyItem);
    setNewText(toTextState(emptyItem));
    setIsAdding(false);
  };

  const handleEditStart = (item: GoodsPurchaseInvoiceItem) => {
    setEditingId(item.id);
    const data: GoodsPurchaseInvoiceItemFormData = {
      article_id: item.article_id,
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent,
      vat_rate: item.vat_rate,
      is_vat_deductible: item.is_vat_deductible,
    };
    setEditItem(data);
    setEditText(toTextState(data));
  };

  const handleEditSubmit = async () => {
    if (!editingId || !editItem.item_name) return;
    const committed = {
      ...editItem,
      quantity: parseNum(editText.quantity),
      unit_price: parseNum(editText.unit_price),
      discount_percent: parseNum(editText.discount_percent),
      vat_rate: parseNum(editText.vat_rate),
    };
    await updateItem.mutateAsync({ id: editingId, ...committed });
    setEditingId(null);
    setEditItem(emptyItem);
    setEditText(toTextState(emptyItem));
  };

  const handleDelete = async (id: string) => {
    await deleteItem.mutateAsync(id);
  };

  const renderNumericInput = (
    value: string,
    onChange: (v: string) => void,
    onBlurCommit: () => void,
    widthClass: string
  ) => (
    <LocaleNumberInput
      value={value}
      onChange={onChange}
      onBlur={onBlurCommit}
      className={`h-8 text-xs text-right ${widthClass}`}
      allowEmpty
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Stavke fakture</h3>
        {isEditable && !isAdding && (
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Dodaj stavku
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[100px]">Šifra</TableHead>
                <TableHead>Naziv artikla</TableHead>
                <TableHead className="w-[60px]">JM</TableHead>
                <TableHead className="w-[200px] text-right">Količina</TableHead>
                <TableHead className="w-[140px] text-right">Cena</TableHead>
                <TableHead className="w-[80px] text-right">Rabat%</TableHead>
                <TableHead className="w-[140px] text-right">Cena neto</TableHead>
                <TableHead className="w-[90px] text-right">PDV%</TableHead>
                <TableHead className="w-[140px] text-right">Ukupno</TableHead>
                {isEditable && <TableHead className="w-[80px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isEditable ? 10 : 9} className="text-center py-4">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : (
              <>
                {items.map((item) =>
                  editingId === item.id ? (
                    <TableRow key={item.id}>
                      <TableCell colSpan={2}>
                        <SearchableArticleSelect
                          articles={activeArticles}
                          value={editItem.article_id || ""}
                          onValueChange={(v) => handleArticleSelect(v, false)}
                          placeholder="Izaberi artikal"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editItem.unit}
                          onChange={(e) => setEditItem({ ...editItem, unit: e.target.value })}
                          className="h-8 text-xs w-14"
                          autoComplete="off"
                        />
                      </TableCell>
                      <TableCell>
                        {renderNumericInput(
                          editText.quantity,
                          (v) => setEditText((p) => ({ ...p, quantity: v })),
                          () => commitEditField("quantity"),
                          "w-[180px]"
                        )}
                      </TableCell>
                      <TableCell>
                        {renderNumericInput(
                          editText.unit_price,
                          (v) => setEditText((p) => ({ ...p, unit_price: v })),
                          () => commitEditField("unit_price"),
                          "w-[120px]"
                        )}
                      </TableCell>
                      <TableCell>
                        {renderNumericInput(
                          editText.discount_percent,
                          (v) => setEditText((p) => ({ ...p, discount_percent: v })),
                          () => commitEditField("discount_percent"),
                          "w-[60px]"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {formatNumber(getEditTotals().netPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {renderNumericInput(
                          editText.vat_rate,
                          (v) => setEditText((p) => ({ ...p, vat_rate: v })),
                          () => commitEditField("vat_rate"),
                          "w-[70px]"
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {formatNumber(getEditTotals().total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-nowrap">
                          <Button
                            size="sm"
                            type="button"
                            onClick={handleEditSubmit}
                            disabled={!editItem.item_name || updateItem.isPending}
                            className="h-7 px-2 text-xs"
                          >
                            Zapamti
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            type="button"
                            className="h-7 w-7"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow
                      key={item.id}
                      className={isEditable ? "cursor-pointer hover:bg-muted/50" : ""}
                      onClick={() => isEditable && handleEditStart(item)}
                    >
                      <TableCell className="text-xs font-mono">{item.item_code || "-"}</TableCell>
                      <TableCell className="text-xs font-medium">{item.item_name}</TableCell>
                      <TableCell className="text-xs">{item.unit}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(item.quantity)}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(item.unit_price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-xs text-right">{item.discount_percent > 0 ? `${formatNumber(item.discount_percent)}%` : "-"}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(calculateNetPrice(item.unit_price, item.discount_percent), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-xs text-right">{item.vat_rate}%</TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {formatNumber(item.line_total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      {isEditable && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                )}

                {/* Add new row */}
                {isAdding && (
                  <TableRow>
                    <TableCell colSpan={2}>
                      <SearchableArticleSelect
                        articles={activeArticles}
                        value={newItem.article_id || ""}
                        onValueChange={(v) => handleArticleSelect(v, true)}
                        placeholder="Izaberi artikal"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={newItem.unit}
                        onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                        className="h-8 text-xs w-14"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell>
                      {renderNumericInput(
                        newText.quantity,
                        (v) => setNewText((p) => ({ ...p, quantity: v })),
                        () => commitNewField("quantity"),
                        "w-[180px]"
                      )}
                    </TableCell>
                    <TableCell>
                      {renderNumericInput(
                        newText.unit_price,
                        (v) => setNewText((p) => ({ ...p, unit_price: v })),
                        () => commitNewField("unit_price"),
                        "w-[120px]"
                      )}
                    </TableCell>
                    <TableCell>
                      {renderNumericInput(
                        newText.discount_percent,
                        (v) => setNewText((p) => ({ ...p, discount_percent: v })),
                        () => commitNewField("discount_percent"),
                        "w-[60px]"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {formatNumber(getNewTotals().netPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {renderNumericInput(
                        newText.vat_rate,
                        (v) => setNewText((p) => ({ ...p, vat_rate: v })),
                        () => commitNewField("vat_rate"),
                        "w-[70px]"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {formatNumber(getNewTotals().total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-nowrap">
                        <Button
                          size="sm"
                          type="button"
                          onClick={handleAddSubmit}
                          disabled={!newItem.item_name || addItem.isPending}
                          className="h-7 px-2 text-xs"
                        >
                          Zapamti
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          type="button"
                          className="h-7 w-7"
                          onClick={() => {
                            setIsAdding(false);
                            setNewItem(emptyItem);
                            setNewText(toTextState(emptyItem));
                          }}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {items.length === 0 && !isAdding && (
                  <TableRow>
                    <TableCell colSpan={isEditable ? 10 : 9} className="text-center py-4 text-muted-foreground">
                      Nema stavki. {isEditable && "Kliknite 'Dodaj stavku' za dodavanje."}
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}