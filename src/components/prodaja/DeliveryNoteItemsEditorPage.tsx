import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useArticles, Article } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeliveryNoteItemsEditorPageProps {
  deliveryNoteId: string;
  companyId: string;
  warehouseId: string | null;
  isReadOnly: boolean;
  hideStock?: boolean;
  onItemsChanged?: () => void;
}

interface ItemRow {
  id?: string;
  article_id: string;
  item_code: string;
  item_name: string;
  description: string;
  unit: string;
  quantity: number;
  available_stock: number;
}

const SVK_MATERIAL_GOODS = ["1", "2", "9"];

export function DeliveryNoteItemsEditorPage({
  deliveryNoteId,
  companyId,
  warehouseId,
  isReadOnly,
  hideStock,
  onItemsChanged,
}: DeliveryNoteItemsEditorPageProps) {
  const { selectedCompany } = useAuth();
  const { articles } = useArticles(selectedCompany?.id);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [addingArticleId, setAddingArticleId] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});

  const materialArticles = articles.filter((a) => a.is_active && a.svk && SVK_MATERIAL_GOODS.includes(a.svk));

  // Load items from DB
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("delivery_note_items")
        .select("*")
        .eq("delivery_note_id", deliveryNoteId)
        .order("item_order");
      if (data) {
        setItems(
          data.map((d) => ({
            id: d.id,
            article_id: d.article_id,
            item_code: d.item_code,
            item_name: d.item_name,
            description: d.description || "",
            unit: d.unit,
            quantity: d.quantity,
            available_stock: 0,
          }))
        );
      }
      setIsLoaded(true);
    };
    load();
  }, [deliveryNoteId]);

  // Fetch warehouse-specific stock
  useEffect(() => {
    if (!companyId || !warehouseId) return;
    const fetchStock = async () => {
      const { data } = await supabase.rpc("get_warehouse_stock", {
        p_company_id: companyId,
        p_warehouse_id: warehouseId,
        p_date_from: null,
        p_date_to: new Date().toISOString().split("T")[0],
      });
      if (data) {
        const map: Record<string, number> = {};
        (data as any[]).forEach((row) => {
          map[row.article_id] = row.balance_qty;
        });
        setStockMap(map);
      }
    };
    fetchStock();
  }, [companyId, warehouseId]);

  // Enrich stock info
  useEffect(() => {
    if (!isLoaded || items.length === 0) return;
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        available_stock: stockMap[item.article_id] ?? 0,
      }))
    );
  }, [isLoaded, stockMap]);

  const saveItems = useCallback(
    async (newItems: ItemRow[]) => {
      await supabase.from("delivery_note_items").delete().eq("delivery_note_id", deliveryNoteId);
      if (newItems.length > 0) {
        const toInsert = newItems.map((item, i) => ({
          delivery_note_id: deliveryNoteId,
          company_id: companyId,
          article_id: item.article_id,
          item_code: item.item_code,
          item_name: item.item_name,
          description: item.description || null,
          unit: item.unit,
          quantity: item.quantity,
          item_order: i + 1,
        }));
        const { error } = await supabase.from("delivery_note_items").insert(toInsert);
        if (error) {
          toast.error(`Greška: ${error.message}`);
          return;
        }
      }
      onItemsChanged?.();
    },
    [deliveryNoteId, companyId, onItemsChanged]
  );

  const addItem = (article: Article) => {
    const existing = items.findIndex((i) => i.article_id === article.id);
    let newItems: ItemRow[];
    if (existing >= 0) {
      newItems = [...items];
      newItems[existing].quantity += 1;
    } else {
      newItems = [
        ...items,
        {
          article_id: article.id,
          item_code: article.code,
          item_name: article.name,
          description: "",
          unit: article.unit,
          quantity: 1,
          available_stock: stockMap[article.id] ?? article.stock ?? 0,
        },
      ];
    }
    setItems(newItems);
    saveItems(newItems);
    setAddingArticleId("");
  };

  const handleAddItem = () => {
    const article = materialArticles.find((a) => a.id === addingArticleId);
    if (article) addItem(article);
  };

  const updateQuantity = (index: number, value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], quantity: value };
    setItems(newItems);
  };

  const commitChange = () => {
    saveItems(items);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    saveItems(newItems);
  };

  const stockVisible = !hideStock;
  const colCount = (isReadOnly ? 4 : 5) + (stockVisible ? 1 : 0);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Stavke otpremnice</h3>
      {!isReadOnly && (
        <div className="flex items-end gap-2">
          <div className="w-[400px]">
            <label className="text-sm font-medium mb-1 block">Izaberite artikal</label>
            <SearchableArticleSelect
              articles={materialArticles}
              value={addingArticleId}
              onValueChange={(id) => setAddingArticleId(id)}
              placeholder="Pretraži artikle..."
            />
          </div>
          <Button onClick={handleAddItem} disabled={!addingArticleId} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Dodaj
          </Button>
        </div>
      )}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Šifra</TableHead>
              <TableHead>Naziv</TableHead>
              <TableHead className="w-[80px]">JM</TableHead>
              {stockVisible && <TableHead className="w-[100px] text-right">Zaliha</TableHead>}
              <TableHead className="w-[120px] text-right">Količina</TableHead>
              {!isReadOnly && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-muted-foreground py-8">
                  Nema stavki
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.item_code}</TableCell>
                  <TableCell>{item.item_name}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  {stockVisible && <TableCell className="text-right">{formatDecimal(item.available_stock)}</TableCell>}
                  <TableCell className="text-right">
                    {isReadOnly ? (
                      formatDecimal(item.quantity)
                    ) : (
                      <LocaleNumberInput
                        value={String(item.quantity)}
                        onChange={(val) =>
                          updateQuantity(index, parseLocaleNumber(val))
                        }
                        onBlur={commitChange}
                        className="w-full text-right"
                      />
                    )}
                  </TableCell>
                  {!isReadOnly && (
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
