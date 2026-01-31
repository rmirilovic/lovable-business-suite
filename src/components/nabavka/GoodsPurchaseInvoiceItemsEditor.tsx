import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Check, X, Trash2 } from "lucide-react";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { useArticles } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import {
  GoodsPurchaseInvoiceItem,
  GoodsPurchaseInvoiceItemFormData,
} from "@/hooks/useGoodsPurchaseInvoices";
import { formatNumber } from "@/lib/formatting";
import { UseMutationResult } from "@tanstack/react-query";

interface GoodsPurchaseInvoiceItemsEditorProps {
  invoiceId: string;
  items: GoodsPurchaseInvoiceItem[];
  isLoading: boolean;
  isEditable: boolean;
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

export function GoodsPurchaseInvoiceItemsEditor({
  invoiceId,
  items,
  isLoading,
  isEditable,
  addItem,
  updateItem,
  deleteItem,
}: GoodsPurchaseInvoiceItemsEditorProps) {
  const { selectedCompany } = useAuth();
  const { articles } = useArticles(selectedCompany?.id);

  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<GoodsPurchaseInvoiceItemFormData>(emptyItem);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<GoodsPurchaseInvoiceItemFormData>(emptyItem);

  const activeArticles = articles.filter((a) => a.is_active);

  const handleArticleSelect = (articleId: string, isNew: boolean) => {
    const article = articles.find((a) => a.id === articleId);
    if (!article) return;

    const itemData = {
      article_id: article.id,
      item_code: article.code,
      item_name: article.name,
      unit: article.unit,
      vat_rate: 20, // Default VAT rate
      unit_price: article.purchase_price || 0,
    };

    if (isNew) {
      setNewItem((prev) => ({ ...prev, ...itemData }));
    } else {
      setEditItem((prev) => ({ ...prev, ...itemData }));
    }
  };

  const calculateLineTotal = (item: GoodsPurchaseInvoiceItemFormData) => {
    const subtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
    const vat = subtotal * (item.vat_rate / 100);
    return { subtotal, vat, total: subtotal + vat };
  };

  const handleAddSubmit = async () => {
    if (!newItem.item_name) return;
    await addItem.mutateAsync({
      goods_purchase_invoice_id: invoiceId,
      ...newItem,
    });
    setNewItem(emptyItem);
    setIsAdding(false);
  };

  const handleEditStart = (item: GoodsPurchaseInvoiceItem) => {
    setEditingId(item.id);
    setEditItem({
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
    });
  };

  const handleEditSubmit = async () => {
    if (!editingId || !editItem.item_name) return;
    await updateItem.mutateAsync({ id: editingId, ...editItem });
    setEditingId(null);
    setEditItem(emptyItem);
  };

  const handleDelete = async (id: string) => {
    await deleteItem.mutateAsync(id);
  };

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Šifra</TableHead>
              <TableHead>Naziv artikla</TableHead>
              <TableHead className="w-[60px]">JM</TableHead>
              <TableHead className="w-[100px] text-right">Količina</TableHead>
              <TableHead className="w-[120px] text-right">Cena</TableHead>
              <TableHead className="w-[80px] text-right">Rabat%</TableHead>
              <TableHead className="w-[70px] text-right">PDV%</TableHead>
              <TableHead className="w-[50px] text-center">Odb.</TableHead>
              <TableHead className="w-[110px] text-right">Ukupno</TableHead>
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
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={editItem.quantity}
                          onChange={(e) => setEditItem({ ...editItem, quantity: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs text-right"
                          autoComplete="off"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={editItem.unit_price}
                          onChange={(e) => setEditItem({ ...editItem, unit_price: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs text-right"
                          autoComplete="off"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={editItem.discount_percent}
                          onChange={(e) => setEditItem({ ...editItem, discount_percent: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs text-right"
                          autoComplete="off"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={editItem.vat_rate}
                          onChange={(e) => setEditItem({ ...editItem, vat_rate: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs text-right"
                          autoComplete="off"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={editItem.is_vat_deductible}
                          onCheckedChange={(c) =>
                            setEditItem({ ...editItem, is_vat_deductible: c as boolean })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {formatNumber(calculateLineTotal(editItem).total)}
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
                      <TableCell className="text-xs text-right">{formatNumber(item.unit_price)}</TableCell>
                      <TableCell className="text-xs text-right">{item.discount_percent > 0 ? `${formatNumber(item.discount_percent)}%` : "-"}</TableCell>
                      <TableCell className="text-xs text-right">{item.vat_rate}%</TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={item.is_vat_deductible} disabled />
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {formatNumber(item.line_total)}
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
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs text-right"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={newItem.unit_price}
                        onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs text-right"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={newItem.discount_percent}
                        onChange={(e) => setNewItem({ ...newItem, discount_percent: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs text-right"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={newItem.vat_rate}
                        onChange={(e) => setNewItem({ ...newItem, vat_rate: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs text-right"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={newItem.is_vat_deductible}
                        onCheckedChange={(c) =>
                          setNewItem({ ...newItem, is_vat_deductible: c as boolean })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {formatNumber(calculateLineTotal(newItem).total)}
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
  );
}
