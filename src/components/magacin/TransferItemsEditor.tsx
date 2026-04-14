import React, { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, Loader2, MoreHorizontal } from "lucide-react";
import {
  useInterWarehouseTransferItems, TransferItemFormData,
} from "@/hooks/useInterWarehouseTransfers";
import { useArticles } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import { SearchableArticleSelect, Article } from "@/components/ui/searchable-article-select";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";
import { useWarehouseStock } from "@/hooks/useWarehouseStock";
import { ArticleTransfersDialog } from "@/components/magacin/ArticleTransfersDialog";
import { supabase } from "@/integrations/supabase/client";

interface TransferItemsEditorProps {
  transferId: string;
  sourceWarehouseId: string;
  transferDate: string;
}

interface VariantInfo {
  id: string;
  code: string;
  description: string;
}

const emptyItem: TransferItemFormData = {
  article_id: "",
  item_code: null,
  item_name: "",
  unit: "kom",
  quantity: 1,
  unit_price: 0,
  variant_id: null,
};

export function TransferItemsEditor({ transferId, sourceWarehouseId, transferDate }: TransferItemsEditorProps) {
  const { selectedCompany } = useAuth();
  const { items, isLoading, addItem, updateItem, deleteItem } =
    useInterWarehouseTransferItems(transferId);
  const { articles } = useArticles(selectedCompany?.id);
  const { data: warehouseStock } = useWarehouseStock(selectedCompany?.id, sourceWarehouseId, undefined, transferDate);
  const [transfersDialogArticle, setTransfersDialogArticle] = useState<{ id: string; code: string; name: string } | null>(null);

  // Article variants map
  const [articleVariantsMap, setArticleVariantsMap] = useState<Record<string, VariantInfo[]>>({});
  // Variant stock map: "articleId:variantId" -> balance_qty
  const [variantStockMap, setVariantStockMap] = useState<Record<string, number>>({});

  // Fetch article variant assignments
  useEffect(() => {
    if (!selectedCompany?.id) return;
    const fetchVariants = async () => {
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await supabase
          .from("article_variant_assignments")
          .select("article_id, variant:article_variants(id, code, description)")
          .eq("company_id", selectedCompany.id)
          .range(from, from + pageSize - 1);
        if (data) allData = allData.concat(data);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      const map: Record<string, VariantInfo[]> = {};
      for (const row of allData) {
        const variant = row.variant as VariantInfo | null;
        if (!variant) continue;
        if (!map[row.article_id]) map[row.article_id] = [];
        map[row.article_id].push(variant);
      }
      for (const key of Object.keys(map)) {
        map[key].sort((a, b) => a.code.localeCompare(b.code, "sr"));
      }
      setArticleVariantsMap(map);
    };
    fetchVariants();
  }, [selectedCompany?.id]);

  // Fetch variant-level stock
  useEffect(() => {
    if (!selectedCompany?.id || !sourceWarehouseId || !transferDate) return;
    const fetchVariantStock = async () => {
      const { data } = await supabase.rpc("get_warehouse_stock_by_variant", {
        p_company_id: selectedCompany.id,
        p_warehouse_id: sourceWarehouseId,
        p_date_from: null,
        p_date_to: transferDate,
      });
      if (data) {
        const map: Record<string, number> = {};
        (data as any[]).forEach((row) => {
          if (row.variant_id) {
            map[`${row.article_id}:${row.variant_id}`] = row.balance_qty;
          }
        });
        setVariantStockMap(map);
      }
    };
    fetchVariantStock();
  }, [selectedCompany?.id, sourceWarehouseId, transferDate]);

  // Build a map of article_id -> stock info for the source warehouse
  const stockMap = useMemo(() => {
    const map = new Map<string, { balance_qty: number; unit_price: number }>();
    if (warehouseStock) {
      for (const row of warehouseStock) {
        if (row.balance_qty > 0) {
          const unitPrice = row.balance_qty > 0 ? row.balance_value / row.balance_qty : 0;
          map.set(row.article_id, { balance_qty: row.balance_qty, unit_price: unitPrice });
        }
      }
    }
    return map;
  }, [warehouseStock]);

  // Only show articles that have stock > 0 in source warehouse
  const availableArticles = useMemo(() => {
    return articles.filter((a) => a.is_active && stockMap.has(a.id));
  }, [articles, stockMap]);

  const getMaxQuantity = useCallback((articleId: string, variantId: string | null) => {
    if (variantId) {
      return variantStockMap[`${articleId}:${variantId}`] ?? 0;
    }
    const stock = stockMap.get(articleId);
    return stock?.balance_qty ?? 0;
  }, [stockMap, variantStockMap]);

  const [newItem, setNewItem] = useState<TransferItemFormData>(emptyItem);
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
    const stock = stockMap.get(articleId);
    if (fullArticle) {
      const price = stock?.unit_price ?? fullArticle.purchase_price ?? 0;
      setNewItem({
        article_id: fullArticle.id,
        item_code: fullArticle.code,
        item_name: fullArticle.name,
        unit: fullArticle.unit,
        quantity: 1,
        unit_price: price,
        variant_id: null,
      });
      setNewItemQuantity("1");
      setNewItemPrice(formatDecimal(price, 2));
    }
  };

  const handleAddItem = async () => {
    const quantity = parseLocaleNumber(newItemQuantity);
    const unitPrice = parseLocaleNumber(newItemPrice);
    if (!newItem.item_name || !newItem.article_id || quantity <= 0) return;

    // Check for duplicate article+variant combination
    const duplicate = items.find(
      (i) => i.article_id === newItem.article_id && (i.variant_id ?? null) === (newItem.variant_id ?? null)
    );
    if (duplicate) {
      toast.error("Stavka sa istim artiklom i varijantom već postoji");
      return;
    }

    const maxQty = getMaxQuantity(newItem.article_id, newItem.variant_id);
    if (quantity > maxQty) {
      toast.error(`Maksimalna količina je ${formatDecimal(maxQty, 3)} (stanje u magacinu)`);
      return;
    }

    setIsAdding(true);
    try {
      await addItem.mutateAsync({
        ...newItem,
        quantity,
        unit_price: unitPrice,
        transfer_id: transferId,
      });
      setNewItem(emptyItem);
      setNewItemQuantity("1");
      setNewItemPrice("0,00");
    } finally {
      setIsAdding(false);
    }
  };

  // Track pending edits for inline fields (commit on blur)
  const pendingEdits = React.useRef<Record<string, { quantity?: string; price?: string }>>({});

  const handleInlineChange = (id: string, field: "quantity" | "price", value: string) => {
    if (!pendingEdits.current[id]) pendingEdits.current[id] = {};
    if (field === "quantity") pendingEdits.current[id].quantity = value;
    else pendingEdits.current[id].price = value;
  };

  const handleInlineBlur = async (id: string, field: "quantity" | "price") => {
    const pending = pendingEdits.current[id];
    if (!pending) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;

    if (field === "quantity" && pending.quantity !== undefined) {
      const quantity = parseLocaleNumber(pending.quantity);
      const maxQty = getMaxQuantity(item.article_id, item.variant_id);
      if (quantity > maxQty) {
        toast.error(`Maksimalna količina je ${formatDecimal(maxQty, 3)} (stanje u magacinu)`);
        delete pending.quantity;
        return;
      }
      if (Math.abs(quantity - item.quantity) < 0.0005) { delete pending.quantity; return; }
      await updateItem.mutateAsync({
        id, article_id: item.article_id, item_code: item.item_code,
        item_name: item.item_name, unit: item.unit, quantity, unit_price: item.unit_price,
        variant_id: item.variant_id,
      });
      delete pending.quantity;
    }

    if (field === "price" && pending.price !== undefined) {
      const unitPrice = parseLocaleNumber(pending.price);
      if (Math.abs(unitPrice - item.unit_price) < 0.005) { delete pending.price; return; }
      await updateItem.mutateAsync({
        id, article_id: item.article_id, item_code: item.item_code,
        item_name: item.item_name, unit: item.unit, quantity: item.quantity, unit_price: unitPrice,
        variant_id: item.variant_id,
      });
      delete pending.price;
    }
  };

  const handleVariantChange = async (itemId: string, variantId: string | null) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    // Check duplicate
    const duplicate = items.find(
      (i) => i.id !== itemId && i.article_id === item.article_id && (i.variant_id ?? null) === (variantId ?? null)
    );
    if (duplicate) {
      toast.error("Stavka sa istim artiklom i varijantom već postoji");
      return;
    }

    await updateItem.mutateAsync({
      id: itemId, article_id: item.article_id, item_code: item.item_code,
      item_name: item.item_name, unit: item.unit, quantity: item.quantity, unit_price: item.unit_price,
      variant_id: variantId,
    });
  };

  const totalValue = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const newItemVariants = articleVariantsMap[newItem.article_id] || [];
  const newItemHasVariants = newItemVariants.length > 0;

  return (
    <div className="space-y-4">
      {/* Add new item */}
      <div className="border rounded-md p-4 bg-muted/30">
        <h4 className="text-sm font-medium mb-3">Dodaj stavku</h4>
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-3">
            <SearchableArticleSelect
              articles={availableArticles}
              value={newItem.article_id || ""}
              onValueChange={handleArticleSelect}
              placeholder="Izaberi artikal..."
            />
          </div>
          <div className="col-span-2">
            <Input
              placeholder="Naziv"
              value={newItem.item_name}
              onChange={(e) => setNewItem((prev) => ({ ...prev, item_name: e.target.value }))}
              readOnly
            />
          </div>
          <div className="col-span-2">
            {newItemHasVariants ? (
              <Select
                value={newItem.variant_id || "__none__"}
                onValueChange={(val) => setNewItem((prev) => ({ ...prev, variant_id: val === "__none__" ? null : val }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Varijanta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-</SelectItem>
                  {newItemVariants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.code} - {v.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input placeholder="Varijanta" value="-" readOnly />
            )}
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
            <Input value={newItem.unit} readOnly placeholder="JM" />
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
              disabled={!newItem.article_id || parseLocaleNumber(newItemQuantity) <= 0 || isAdding}
              className="w-full"
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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
              <TableHead className="min-w-[180px]">Naziv</TableHead>
              <TableHead className="w-[180px]">Varijanta</TableHead>
              <TableHead className="w-[200px] text-right">Količina</TableHead>
              <TableHead className="w-[80px]">JM</TableHead>
              <TableHead className="w-[250px] text-right">Cena</TableHead>
              <TableHead className="w-[250px] text-right">Vrednost</TableHead>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Nema stavki. Dodajte prvu stavku iznad.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const variants = articleVariantsMap[item.article_id] || [];
                const hasVariants = variants.length > 0;

                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>{item.item_code || item.article?.code || "-"}</TableCell>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell>
                      {hasVariants ? (
                        <Select
                          value={item.variant_id || "__none__"}
                          onValueChange={(val) => handleVariantChange(item.id, val === "__none__" ? null : val)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="-" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">-</SelectItem>
                            {variants.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.code} - {v.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <LocaleNumberInput
                        value={formatDecimal(item.quantity, 3)}
                        onChange={(val) => handleInlineChange(item.id, "quantity", val)}
                        onBlur={() => handleInlineBlur(item.id, "quantity")}
                        className="text-right"
                        decimalPlaces={3}
                      />
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>
                      <LocaleNumberInput
                        value={formatDecimal(item.unit_price, 2)}
                        onChange={(val) => handleInlineChange(item.id, "price", val)}
                        onBlur={() => handleInlineBlur(item.id, "price")}
                        decimalPlaces={2}
                        className="text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatDecimal(item.quantity * item.unit_price, 2)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteItem.mutateAsync(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
                            <DropdownMenuItem onClick={() => setTransfersDialogArticle({ id: item.article_id, code: item.item_code || "", name: item.item_name })}>
                              Na međumagacinskim prenosima
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
              <TableRow className="bg-muted/50 font-medium">
                <TableCell colSpan={7} className="text-right">Ukupno:</TableCell>
                <TableCell className="text-right">{formatDecimal(totalValue, 2)}</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ArticleTransfersDialog
        open={!!transfersDialogArticle}
        onOpenChange={(open) => { if (!open) setTransfersDialogArticle(null); }}
        articleId={transfersDialogArticle?.id ?? null}
        articleCode={transfersDialogArticle?.code ?? ""}
        articleName={transfersDialogArticle?.name ?? ""}
      />
    </div>
  );
}
