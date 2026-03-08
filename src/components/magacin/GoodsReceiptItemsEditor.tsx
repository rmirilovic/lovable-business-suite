import { useState } from "react";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, Loader2, MoreHorizontal } from "lucide-react";
import {
  useGoodsReceiptItems,
  GoodsReceiptItemFormData,
} from "@/hooks/useGoodsReceipts";
import { useArticles } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import { SearchableArticleSelect, Article } from "@/components/ui/searchable-article-select";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";
import { ArticleGoodsReceiptsDialog } from "@/components/magacin/ArticleGoodsReceiptsDialog";

interface GoodsReceiptItemsEditorProps {
  receiptId: string;
}

const emptyItem: GoodsReceiptItemFormData = {
  article_id: null,
  item_code: null,
  item_name: "",
  unit: "kom",
  quantity: 1,
  unit_price: 0,
};

export function GoodsReceiptItemsEditor({
  receiptId,
}: GoodsReceiptItemsEditorProps) {
  const { selectedCompany } = useAuth();
  const { items, isLoading, addItem, updateItem, deleteItem } =
    useGoodsReceiptItems(receiptId);
  const { articles } = useArticles(selectedCompany?.id);

  const [newItem, setNewItem] = useState<GoodsReceiptItemFormData>(emptyItem);
  const [newItemQuantity, setNewItemQuantity] = useState("1");
  const [newItemPrice, setNewItemPrice] = useState("0,00");
  const [isAdding, setIsAdding] = useState(false);

  const handleArticleSelect = (articleId: string, article: Article) => {
    if (!articleId) {
      setNewItem({ ...emptyItem });
      setNewItemQuantity("1");
      setNewItemPrice("0,00");
      return;
    }

    const fullArticle = articles.find((a) => a.id === articleId);
    if (fullArticle) {
      setNewItem({
        article_id: fullArticle.id,
        item_code: fullArticle.code,
        item_name: fullArticle.name,
        unit: fullArticle.unit,
        quantity: 1,
        unit_price: fullArticle.purchase_price || 0,
      });
      setNewItemQuantity("1");
      setNewItemPrice(formatDecimal(fullArticle.purchase_price || 0, 2));
    }
  };

  const handleAddItem = async () => {
    const quantity = parseLocaleNumber(newItemQuantity);
    const unitPrice = parseLocaleNumber(newItemPrice);
    
    if (!newItem.item_name || quantity <= 0) return;

    setIsAdding(true);
    try {
      await addItem.mutateAsync({
        ...newItem,
        quantity,
        unit_price: unitPrice,
        goods_receipt_id: receiptId,
      });
      setNewItem(emptyItem);
      setNewItemQuantity("1");
      setNewItemPrice("0,00");
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateItemQuantity = async (id: string, value: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const quantity = parseLocaleNumber(value);
    await updateItem.mutateAsync({
      id,
      article_id: item.article_id,
      item_code: item.item_code,
      item_name: item.item_name,
      unit: item.unit,
      quantity,
      unit_price: item.unit_price,
    });
  };

  const handleUpdateItemPrice = async (id: string, value: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const unitPrice = parseLocaleNumber(value);
    await updateItem.mutateAsync({
      id,
      article_id: item.article_id,
      item_code: item.item_code,
      item_name: item.item_name,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: unitPrice,
    });
  };

  const totalValue = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add new item row */}
      <div className="border rounded-md p-4 bg-muted/30">
        <h4 className="text-sm font-medium mb-3">Dodaj stavku</h4>
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <SearchableArticleSelect
              articles={articles.filter((a) => a.is_active)}
              value={newItem.article_id || ""}
              onValueChange={handleArticleSelect}
              placeholder="Izaberi artikal..."
            />
          </div>
          <div className="col-span-3">
            <Input
              placeholder="Naziv"
              value={newItem.item_name}
              onChange={(e) =>
                setNewItem((prev) => ({ ...prev, item_name: e.target.value }))
              }
            />
          </div>
          <div className="col-span-1">
            <LocaleNumberInput
              value={newItemQuantity}
              onChange={setNewItemQuantity}
              placeholder="Kol."
              decimalPlaces={3}
            />
          </div>
          <div className="col-span-1">
            <Input
              value={newItem.unit}
              onChange={(e) =>
                setNewItem((prev) => ({ ...prev, unit: e.target.value }))
              }
              placeholder="JM"
            />
          </div>
          <div className="col-span-2">
            <LocaleNumberInput
              value={newItemPrice}
              onChange={setNewItemPrice}
              placeholder="Cena"
              decimalPlaces={2}
            />
          </div>
          <div className="col-span-1">
            <Button
              onClick={handleAddItem}
              disabled={!newItem.item_name || parseLocaleNumber(newItemQuantity) <= 0 || isAdding}
              className="w-full"
            >
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Šifra</TableHead>
              <TableHead className="min-w-[200px]">Naziv</TableHead>
              <TableHead className="w-[100px] text-right">Količina</TableHead>
              <TableHead className="w-[80px]">JM</TableHead>
              <TableHead className="w-[120px] text-right">Cena</TableHead>
              <TableHead className="w-[120px] text-right">Vrednost</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  Nema stavki. Dodajte prvu stavku iznad.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    {item.item_code || item.article?.code || "-"}
                  </TableCell>
                  <TableCell>{item.item_name}</TableCell>
                  <TableCell>
                    <LocaleNumberInput
                      value={formatDecimal(item.quantity, 3)}
                      onChange={(val) => handleUpdateItemQuantity(item.id, val)}
                      className="text-right"
                      decimalPlaces={3}
                    />
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>
                    <LocaleNumberInput
                      value={formatDecimal(item.unit_price, 2)}
                      onChange={(val) => handleUpdateItemPrice(item.id, val)}
                      decimalPlaces={2}
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatDecimal(item.quantity * item.unit_price, 2)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteItem.mutateAsync(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
            {items.length > 0 && (
              <TableRow className="bg-muted/50 font-medium">
                <TableCell colSpan={6} className="text-right">
                  Ukupno:
                </TableCell>
                <TableCell className="text-right">
                  {formatDecimal(totalValue, 2)} RSD
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
