import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Upload, FileSpreadsheet } from "lucide-react";
import { useInventoryCountItems, InventoryCountItem } from "@/hooks/useInventoryCounts";
import { useArticles, Article } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Props {
  countId: string;
  warehouseId: string;
  countDate: string;
  warehouseType: string;
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

export function InventoryCountItemsEditor({ countId, warehouseId, countDate, warehouseType }: Props) {
  const { selectedCompany, selectedYear } = useAuth();
  const { items, isLoading, addItem, updateItem, deleteItem } = useInventoryCountItems(countId);
  const { articles } = useArticles(selectedCompany?.id);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

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

    if (items.some((i) => i.article_id === articleId)) {
      toast.error("Artikal je već u popisnoj listi");
      return;
    }

    const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.item_order)) + 1 : 1;

    await addItem.mutateAsync({
      inventory_count_id: countId,
      company_id: selectedCompany.id,
      article_id: articleId,
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

  // Excel import
  const handleExcelImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompany?.id) return;
    e.target.value = "";

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      if (rows.length === 0) {
        toast.error("Excel fajl je prazan");
        return;
      }

      const headers = Object.keys(rows[0]);
      const codeCol = headers.find((h) => /šifra|sifra|code/i.test(h));
      const qtyCol = headers.find((h) => /popisana|količina|kolicina|qty|counted/i.test(h));
      const priceCol = headers.find((h) => /cena|price/i.test(h));

      if (!codeCol) {
        toast.error("Nije pronađena kolona za šifru artikla");
        return;
      }

      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        const code = String(row[codeCol] || "").trim();
        if (!code) continue;

        const article = articles.find((a) => a.code === code);
        if (!article) { skipped++; continue; }

        const existingItem = items.find((i) => i.article_id === article.id);
        const countedQty = qtyCol ? Number(row[qtyCol]) || 0 : 0;
        const price = priceCol ? Number(row[priceCol]) || 0 : undefined;

        if (existingItem) {
          const updated = recalcItem(existingItem, "counted_quantity", countedQty);
          if (price !== undefined) {
            updated.price = price;
            updated.surplus_value = Math.round(updated.surplus_qty * price * 100) / 100;
            updated.deficit_value = Math.round(updated.deficit_qty * price * 100) / 100;
          }
          await updateItem.mutateAsync({
            id: existingItem.id,
            counted_quantity: countedQty,
            surplus_qty: updated.surplus_qty,
            deficit_qty: updated.deficit_qty,
            ...(price !== undefined ? { price } : {}),
            surplus_value: updated.surplus_value,
            deficit_value: updated.deficit_value,
          });
          imported++;
        } else {
          const nextOrder = items.length + imported + 1;
          const bookQty = 0;
          const itemPrice = price ?? article.selling_price ?? article.purchase_price ?? 0;
          const surplusQty = countedQty > bookQty ? countedQty - bookQty : 0;
          const deficitQty = bookQty > countedQty ? bookQty - countedQty : 0;

          await addItem.mutateAsync({
            inventory_count_id: countId,
            company_id: selectedCompany.id,
            article_id: article.id,
            item_order: nextOrder,
            item_code: article.code,
            item_name: article.name,
            unit: article.unit,
            book_quantity: bookQty,
            counted_quantity: countedQty,
            surplus_qty: surplusQty,
            deficit_qty: deficitQty,
            price: itemPrice,
            surplus_value: Math.round(surplusQty * itemPrice * 100) / 100,
            deficit_value: Math.round(deficitQty * itemPrice * 100) / 100,
          });
          imported++;
        }
      }

      toast.success(`Uvezeno: ${imported}, preskočeno: ${skipped}`);
    } catch (err: any) {
      toast.error(`Greška pri uvozu: ${err.message}`);
    }
  }, [items, articles, selectedCompany, countId, addItem, updateItem]);

  const totals = items.reduce(
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

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleLoadFromWarehouse} disabled={isLoadingStock}>
          {isLoadingStock ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Učitaj iz magacina
        </Button>
        <Button variant="outline" size="sm" asChild>
          <label className="cursor-pointer">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Uvezi iz Excela
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
          </label>
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
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-[80px]">Šifra</TableHead>
              <TableHead className="min-w-[200px]">Naziv</TableHead>
              <TableHead className="w-[60px]">JM</TableHead>
              <TableHead className="w-[140px] text-right">Knjižna kol.</TableHead>
              <TableHead className="w-[160px] text-right">Popisana kol.</TableHead>
              <TableHead className="w-[120px] text-right">Višak</TableHead>
              <TableHead className="w-[120px] text-right">Manjak</TableHead>
              <TableHead className="w-[140px] text-right">Cena</TableHead>
              <TableHead className="w-[140px] text-right">Vr. viška</TableHead>
              <TableHead className="w-[140px] text-right">Vr. manjka</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  Nema stavki. Učitajte artikle iz magacina ili dodajte ručno.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <InventoryCountRow
                  key={item.id}
                  item={item}
                  index={index}
                  onFieldCommit={handleFieldCommit}
                  onDelete={() => deleteItem.mutateAsync(item.id)}
                />
              ))
            )}
            {items.length > 0 && (
              <TableRow className="bg-muted/50 font-medium">
                <TableCell colSpan={9} className="text-right">Ukupno:</TableCell>
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
      </div>
    </div>
  );
}

/* ── Row component with local state for commit-on-blur ── */

interface RowProps {
  item: InventoryCountItem;
  index: number;
  onFieldCommit: (item: InventoryCountItem, field: string, rawValue: string) => Promise<void>;
  onDelete: () => void;
}

function InventoryCountRow({ item, index, onFieldCommit, onDelete }: RowProps) {
  const [countedQty, setCountedQty] = useState(formatDecimal(item.counted_quantity, 3));
  const [price, setPrice] = useState(formatDecimal(item.price, 2));

  // Sync from external changes (e.g. after mutation settles)
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
