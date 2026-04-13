import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Upload, FileSpreadsheet, Save } from "lucide-react";
import { useInventoryCountItems, InventoryCountItem } from "@/hooks/useInventoryCounts";
import { useArticles, Article } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InventoryCountImportDialog } from "./InventoryCountImportDialog";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { SortDirection } from "@/hooks/useTableSort";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Props {
  countId: string;
  warehouseId: string;
  countDate: string;
  warehouseType: string;
  search: string;
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
  onSave?: () => void;
}

interface ArticleVariantOption {
  id: string;
  code: string;
  description: string;
}

function getAllowedSvkForWarehouseType(warehouseType: string): string[] {
  switch (warehouseType) {
    case "1": return ["1"];
    case "2": return ["2"];
    case "6": return ["6"];
    case "9": return ["9"];
    case "12": return ["1", "2"];
    default: return ["0", "1", "2", "6", "8", "9"];
  }
}

export function InventoryCountItemsEditor({ countId, warehouseId, countDate, warehouseType, search, sortColumn, sortDirection, onSort, onSave }: Props) {
  const { selectedCompany, selectedYear } = useAuth();
  const { items, isLoading, refetchItems, addItem, updateItem, deleteItem } = useInventoryCountItems(countId);
  const { articles } = useArticles(selectedCompany?.id);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [articleVariantsMap, setArticleVariantsMap] = useState<Map<string, ArticleVariantOption[]>>(new Map());

  // Fetch variant assignments for articles that have them
  useEffect(() => {
    if (!selectedCompany?.id) return;
    const fetchVariants = async () => {
      const { data, error } = await supabase
        .from("article_variant_assignments")
        .select("article_id, variant:article_variants(id, code, description)")
        .eq("company_id", selectedCompany.id);
      if (error) return;
      const map = new Map<string, ArticleVariantOption[]>();
      for (const row of (data || [])) {
        const v = row.variant as any;
        if (!v) continue;
        const list = map.get(row.article_id) || [];
        if (!list.some(x => x.id === v.id)) {
          list.push({ id: v.id, code: v.code, description: v.description });
        }
        map.set(row.article_id, list);
      }
      setArticleVariantsMap(map);
    };
    fetchVariants();
  }, [selectedCompany?.id]);

  const handleLoadFromWarehouse = async () => {
    if (!selectedCompany?.id || !selectedYear?.id) return;
    setIsLoadingStock(true);
    try {
      const yearStart = `${selectedYear.year}-01-01`;
      const { data: stockData, error } = await supabase.rpc("get_warehouse_stock", {
        p_company_id: selectedCompany.id,
        p_warehouse_id: warehouseId,
        p_date_from: yearStart,
        p_date_to: countDate,
      });
      if (error) throw error;

      const existingArticleIds = new Set(items.map((i) => i.article_id));
      const newItems: Omit<InventoryCountItem, "id" | "created_at">[] = [];
      let order = items.length > 0 ? Math.max(...items.map((i) => i.item_order)) + 1 : 1;

      for (const row of (stockData || [])) {
        if (existingArticleIds.has(row.article_id)) continue;
        const price = row.balance_qty !== 0
          ? Math.round((row.balance_value / row.balance_qty) * 100) / 100
          : 0;

        newItems.push({
          inventory_count_id: countId,
          company_id: selectedCompany.id,
          article_id: row.article_id,
          variant_id: null,
          item_order: order++,
          item_code: row.article_code,
          item_name: row.article_name,
          unit: row.unit,
          book_quantity: row.balance_qty,
          counted_quantity: row.balance_qty,
          surplus_qty: 0,
          deficit_qty: 0,
          price,
          surplus_value: 0,
          deficit_value: 0,
        });
      }

      if (newItems.length === 0) {
        toast.info("Nema novih artikala za učitavanje iz magacina");
        return;
      }

      for (let i = 0; i < newItems.length; i += 50) {
        const batch = newItems.slice(i, i + 50);
        const { error: insErr } = await supabase.from("inventory_count_items").insert(batch);
        if (insErr) throw insErr;
      }

      toast.success(`Učitano ${newItems.length} artikala iz magacina`);
      window.location.reload();
    } catch (e: any) {
      toast.error(`Greška: ${e.message}`);
    } finally {
      setIsLoadingStock(false);
    }
  };

  const handleAddArticle = async (articleId: string) => {
    if (!articleId || !selectedCompany?.id) return;
    const article = articles.find((a) => a.id === articleId);
    if (!article) return;

    const variants = articleVariantsMap.get(articleId) || [];
    const existingVariantIds = items
      .filter((i) => i.article_id === articleId)
      .map((i) => i.variant_id);

    // If article has no variants, only allow one row
    if (variants.length === 0 && existingVariantIds.length > 0) {
      toast.error("Artikal je već u popisnoj listi");
      return;
    }

    // If article has variants and all are already added, show error
    if (variants.length > 0) {
      const unusedVariants = variants.filter((v) => !existingVariantIds.includes(v.id));
      if (unusedVariants.length === 0) {
        toast.error("Sve varijante ovog artikla su već u popisnoj listi");
        return;
      }
    }

    const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.item_order)) + 1 : 1;

    await addItem.mutateAsync({
      inventory_count_id: countId,
      company_id: selectedCompany.id,
      article_id: articleId,
      variant_id: null,
      item_order: nextOrder,
      item_code: article.code,
      item_name: article.name,
      unit: article.unit,
      book_quantity: 0,
      counted_quantity: 0,
      surplus_qty: 0,
      deficit_qty: 0,
      price: article.selling_price || article.purchase_price || 0,
      surplus_value: 0,
      deficit_value: 0,
    });
  };

  const recalcItem = (item: InventoryCountItem, field: string, value: number) => {
    const updated = { ...item, [field]: value };

    if (field === "counted_quantity" || field === "book_quantity") {
      const diff = updated.counted_quantity - updated.book_quantity;
      updated.surplus_qty = diff > 0 ? diff : 0;
      updated.deficit_qty = diff < 0 ? -diff : 0;
    }

    updated.surplus_value = Math.round(updated.surplus_qty * updated.price * 100) / 100;
    updated.deficit_value = Math.round(updated.deficit_qty * updated.price * 100) / 100;
    return updated;
  };

  const handleFieldCommit = async (item: InventoryCountItem, field: string, rawValue: string) => {
    const value = parseLocaleNumber(rawValue);
    const updated = recalcItem(item, field, value);
    await updateItem.mutateAsync({
      id: item.id,
      [field]: value,
      surplus_qty: updated.surplus_qty,
      deficit_qty: updated.deficit_qty,
      surplus_value: updated.surplus_value,
      deficit_value: updated.deficit_value,
    });
  };

  const handleVariantChange = async (item: InventoryCountItem, variantId: string | null) => {
    // Prevent duplicate article+variant combo
    if (variantId && items.some((i) => i.id !== item.id && i.article_id === item.article_id && i.variant_id === variantId)) {
      toast.error("Ova varijanta je već dodata za ovaj artikal");
      return;
    }
    await updateItem.mutateAsync({
      id: item.id,
      variant_id: variantId,
    });
  };

  const getItemValue = useCallback((item: InventoryCountItem, column: string) => {
    switch (column) {
      case "item_code": return item.item_code || "";
      case "item_name": return item.item_name;
      case "variant": return item.variant?.code || "";
      case "unit": return item.unit;
      case "book_quantity": return item.book_quantity;
      case "counted_quantity": return item.counted_quantity;
      case "surplus_qty": return item.surplus_qty;
      case "deficit_qty": return item.deficit_qty;
      case "price": return item.price;
      case "surplus_value": return item.surplus_value;
      case "deficit_value": return item.deficit_value;
      default: return "";
    }
  }, []);

  const filteredSortedItems = useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (i) =>
          (i.item_code || "").toLowerCase().includes(q) ||
          i.item_name.toLowerCase().includes(q) ||
          (i.variant?.code || "").toLowerCase().includes(q)
      );
    }
    if (!sortColumn) return result;
    return [...result].sort((a, b) => {
      const aVal = getItemValue(a, sortColumn);
      const bVal = getItemValue(b, sortColumn);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === "asc" ? -1 : 1;
      if (bVal == null) return sortDirection === "asc" ? 1 : -1;
      let cmp = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        cmp = aVal.localeCompare(bVal, "sr");
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      }
      if (cmp !== 0) return sortDirection === "asc" ? cmp : -cmp;
      // Secondary sort by variant code when primary values are equal
      const aVar = a.variant?.code || "";
      const bVar = b.variant?.code || "";
      return aVar.localeCompare(bVar, "sr");
    });
  }, [items, search, sortColumn, sortDirection, getItemValue]);

  const totals = filteredSortedItems.reduce(
    (acc, item) => ({
      surplusValue: acc.surplusValue + item.surplus_value,
      deficitValue: acc.deficitValue + item.deficit_value,
    }),
    { surplusValue: 0, deficitValue: 0 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSave = async () => {
    await refetchItems();
    onSave?.();
    toast.success("Lista osvežena i sortirana");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-2">
        <Button variant="outline" size="sm" onClick={handleLoadFromWarehouse} disabled={isLoadingStock}>
          {isLoadingStock ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Učitaj iz magacina
        </Button>
        <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Uvezi iz Excela
        </Button>
        <Button variant="default" size="sm" onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Sačuvaj
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-4 text-sm">
          <SearchableArticleSelect
            articles={articles.filter((a) => a.is_active && getAllowedSvkForWarehouseType(warehouseType).includes(a.svk || "1"))}
            value=""
            onValueChange={(id) => handleAddArticle(id)}
            placeholder="Dodaj artikal..."
          />
        </div>
      </div>

      {/* Items table */}
      <TableScrollContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-[80px]"><SortableHeader column="item_code" label="Šifra" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} /></TableHead>
              <TableHead className="min-w-[200px]"><SortableHeader column="item_name" label="Naziv" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} /></TableHead>
              <TableHead className="w-[130px]"><SortableHeader column="variant" label="Varijanta" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} /></TableHead>
              <TableHead className="w-[60px]"><SortableHeader column="unit" label="JM" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} /></TableHead>
              <TableHead className="w-[140px] text-right"><SortableHeader column="book_quantity" label="Knjižna kol." sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="justify-end" /></TableHead>
              <TableHead className="w-[160px] text-right"><SortableHeader column="counted_quantity" label="Popisana kol." sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="justify-end" /></TableHead>
              <TableHead className="w-[120px] text-right"><SortableHeader column="surplus_qty" label="Višak" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="justify-end" /></TableHead>
              <TableHead className="w-[120px] text-right"><SortableHeader column="deficit_qty" label="Manjak" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="justify-end" /></TableHead>
              <TableHead className="w-[140px] text-right"><SortableHeader column="price" label="Cena" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="justify-end" /></TableHead>
              <TableHead className="w-[140px] text-right"><SortableHeader column="surplus_value" label="Vr. viška" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="justify-end" /></TableHead>
              <TableHead className="w-[140px] text-right"><SortableHeader column="deficit_value" label="Vr. manjka" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="justify-end" /></TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSortedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                  {search ? "Nema rezultata pretrage" : "Nema stavki. Učitajte artikle iz magacina ili dodajte ručno."}
                </TableCell>
              </TableRow>
            ) : (
              filteredSortedItems.map((item, index) => (
                <InventoryCountRow
                  key={item.id}
                  item={item}
                  index={index}
                  onFieldCommit={handleFieldCommit}
                  onDelete={() => deleteItem.mutateAsync(item.id)}
                  onVariantChange={handleVariantChange}
                  availableVariants={articleVariantsMap.get(item.article_id) || []}
                />
              ))
            )}
            {filteredSortedItems.length > 0 && (
              <TableRow className="bg-muted/50 font-medium">
                <TableCell colSpan={10} className="text-right">Ukupno:</TableCell>
                <TableCell className="text-right text-green-600">
                  {formatDecimal(totals.surplusValue, 2)}
                </TableCell>
                <TableCell className="text-right text-destructive">
                  {formatDecimal(totals.deficitValue, 2)}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableScrollContainer>

      <InventoryCountImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        countId={countId}
        companyId={selectedCompany?.id || ""}
        warehouseId={warehouseId}
        countDate={countDate}
        yearId={selectedYear?.id || ""}
        yearStart={selectedYear ? `${selectedYear.year}-01-01` : ""}
        warehouseType={warehouseType}
        items={items}
        articles={articles}
      />
    </div>
  );
}

/* ── Row component with local state for commit-on-blur ── */

interface RowProps {
  item: InventoryCountItem;
  index: number;
  onFieldCommit: (item: InventoryCountItem, field: string, rawValue: string) => Promise<void>;
  onDelete: () => void;
  onVariantChange: (item: InventoryCountItem, variantId: string | null) => Promise<void>;
  availableVariants: ArticleVariantOption[];
}

function InventoryCountRow({ item, index, onFieldCommit, onDelete, onVariantChange, availableVariants }: RowProps) {
  const [countedQty, setCountedQty] = useState(formatDecimal(item.counted_quantity, 3));
  const [price, setPrice] = useState(formatDecimal(item.price, 2));

  React.useEffect(() => {
    setCountedQty(formatDecimal(item.counted_quantity, 3));
  }, [item.counted_quantity]);

  React.useEffect(() => {
    setPrice(formatDecimal(item.price, 2));
  }, [item.price]);

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
      <TableCell>{item.item_code || "-"}</TableCell>
      <TableCell>{item.item_name}</TableCell>
      <TableCell>
        {availableVariants.length > 0 ? (
          <Select
            value={item.variant_id || "__none__"}
            onValueChange={(val) => onVariantChange(item, val === "__none__" ? null : val)}
          >
            <SelectTrigger className="h-8 text-xs w-[120px]">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {availableVariants.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          item.variant ? (
            <Badge variant="outline" className="text-xs">{item.variant.code}</Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )
        )}
      </TableCell>
      <TableCell>{item.unit}</TableCell>
      <TableCell className="text-right text-muted-foreground">
        {formatDecimal(item.book_quantity, 3)}
      </TableCell>
      <TableCell>
        <LocaleNumberInput
          value={countedQty}
          onChange={setCountedQty}
          onBlur={() => onFieldCommit(item, "counted_quantity", countedQty)}
          className="text-right text-sm"
          decimalPlaces={3}
        />
      </TableCell>
      <TableCell className="text-right">
        {item.surplus_qty > 0 ? (
          <span className="text-green-600">{formatDecimal(item.surplus_qty, 3)}</span>
        ) : ""}
      </TableCell>
      <TableCell className="text-right">
        {item.deficit_qty > 0 ? (
          <span className="text-destructive">{formatDecimal(item.deficit_qty, 3)}</span>
        ) : ""}
      </TableCell>
      <TableCell>
        <LocaleNumberInput
          value={price}
          onChange={setPrice}
          onBlur={() => onFieldCommit(item, "price", price)}
          className="text-right text-sm"
          decimalPlaces={2}
        />
      </TableCell>
      <TableCell className="text-right">
        {item.surplus_value > 0 ? (
          <span className="text-green-600">{formatDecimal(item.surplus_value, 2)}</span>
        ) : ""}
      </TableCell>
      <TableCell className="text-right">
        {item.deficit_value > 0 ? (
          <span className="text-destructive">{formatDecimal(item.deficit_value, 2)}</span>
        ) : ""}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
