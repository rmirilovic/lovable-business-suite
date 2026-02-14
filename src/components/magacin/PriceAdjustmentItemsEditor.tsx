import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Trash2, Loader2, Upload } from "lucide-react";
import { usePriceAdjustmentItems, PriceAdjustmentItem } from "@/hooks/usePriceAdjustments";
import { useArticles } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  adjustmentId: string;
  warehouseId: string;
  adjustmentDate: string;
}

export function PriceAdjustmentItemsEditor({ adjustmentId, warehouseId, adjustmentDate }: Props) {
  const { selectedCompany, selectedYear } = useAuth();
  const { items, isLoading, addItem, updateItem, deleteItem } = usePriceAdjustmentItems(adjustmentId);
  const { articles } = useArticles(selectedCompany?.id);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  // Only SVK=1 articles
  const eligibleArticles = articles.filter((a) => a.is_active && (a.svk === "1" || (!a.svk && true)));

  const handleLoadFromWarehouse = async () => {
    if (!selectedCompany?.id || !selectedYear?.id) return;
    setIsLoadingStock(true);
    try {
      const yearStart = `${selectedYear.year}-01-01`;
      const { data: stockData, error } = await supabase.rpc("get_warehouse_stock", {
        p_company_id: selectedCompany.id,
        p_warehouse_id: warehouseId,
        p_date_from: yearStart,
        p_date_to: adjustmentDate,
      });
      if (error) throw error;

      const existingArticleIds = new Set(items.map((i) => i.article_id));
      const newItems: Omit<PriceAdjustmentItem, "id" | "created_at">[] = [];
      let order = items.length > 0 ? Math.max(...items.map((i) => i.item_order)) + 1 : 1;

      for (const row of (stockData || [])) {
        if (existingArticleIds.has(row.article_id)) continue;
        if (row.balance_qty <= 0) continue;

        const article = articles.find((a) => a.id === row.article_id);
        const sellingPrice = article?.selling_price ?? 0;

        newItems.push({
          price_adjustment_id: adjustmentId,
          company_id: selectedCompany.id,
          article_id: row.article_id,
          item_order: order++,
          item_code: row.article_code,
          item_name: row.article_name,
          unit: row.unit,
          quantity: row.balance_qty,
          old_price: sellingPrice,
          new_price: sellingPrice,
          price_difference: 0,
          value_difference: 0,
        });
      }

      if (newItems.length === 0) {
        toast.info("Nema novih artikala za učitavanje");
        return;
      }

      for (let i = 0; i < newItems.length; i += 50) {
        const batch = newItems.slice(i, i + 50);
        const { error: insErr } = await supabase.from("price_adjustment_items").insert(batch);
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
      toast.error("Artikal je već u nivelaciji");
      return;
    }

    const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.item_order)) + 1 : 1;
    const sellingPrice = article.selling_price ?? 0;

    await addItem.mutateAsync({
      price_adjustment_id: adjustmentId,
      company_id: selectedCompany.id,
      article_id: articleId,
      item_order: nextOrder,
      item_code: article.code,
      item_name: article.name,
      unit: article.unit,
      quantity: 0,
      old_price: sellingPrice,
      new_price: sellingPrice,
      price_difference: 0,
      value_difference: 0,
    });
  };

  const handleFieldCommit = async (item: PriceAdjustmentItem, field: string, rawValue: string) => {
    const value = parseLocaleNumber(rawValue);
    const updated = { ...item, [field]: value };

    // Recalculate
    updated.price_difference = updated.new_price - updated.old_price;
    updated.value_difference = Math.round(updated.price_difference * updated.quantity * 100) / 100;

    await updateItem.mutateAsync({
      id: item.id,
      [field]: value,
      price_difference: updated.price_difference,
      value_difference: updated.value_difference,
    });
  };

  const totals = items.reduce(
    (acc, item) => ({
      increase: acc.increase + (item.value_difference > 0 ? item.value_difference : 0),
      decrease: acc.decrease + (item.value_difference < 0 ? Math.abs(item.value_difference) : 0),
    }),
    { increase: 0, decrease: 0 }
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
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleLoadFromWarehouse} disabled={isLoadingStock}>
          {isLoadingStock ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Učitaj iz magacina
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-4 text-sm">
          <SearchableArticleSelect
            articles={eligibleArticles}
            value=""
            onValueChange={(id) => handleAddArticle(id)}
            placeholder="Dodaj artikal..."
          />
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-[80px]">Šifra</TableHead>
              <TableHead className="min-w-[200px]">Naziv</TableHead>
              <TableHead className="w-[60px]">JM</TableHead>
              <TableHead className="w-[140px] text-right">Količina</TableHead>
              <TableHead className="w-[160px] text-right">Stara cena</TableHead>
              <TableHead className="w-[160px] text-right">Nova cena</TableHead>
              <TableHead className="w-[140px] text-right">Razlika/jed.</TableHead>
              <TableHead className="w-[160px] text-right">Razlika ukupno</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Nema stavki. Učitajte artikle iz magacina ili dodajte ručno.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <PriceAdjustmentRow
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
                <TableCell colSpan={8} className="text-right">Ukupno:</TableCell>
                <TableCell className="text-right">
                  {totals.increase > 0 && <span className="text-green-600">+{formatDecimal(totals.increase, 2)}</span>}
                  {totals.increase > 0 && totals.decrease > 0 && " / "}
                  {totals.decrease > 0 && <span className="text-destructive">-{formatDecimal(totals.decrease, 2)}</span>}
                  {totals.increase === 0 && totals.decrease === 0 && formatDecimal(0, 2)}
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

/* ── Row component with commit-on-blur ── */

interface RowProps {
  item: PriceAdjustmentItem;
  index: number;
  onFieldCommit: (item: PriceAdjustmentItem, field: string, rawValue: string) => Promise<void>;
  onDelete: () => void;
}

function PriceAdjustmentRow({ item, index, onFieldCommit, onDelete }: RowProps) {
  const [quantity, setQuantity] = useState(formatDecimal(item.quantity, 2));
  const [newPrice, setNewPrice] = useState(formatDecimal(item.new_price, 2));

  React.useEffect(() => {
    setQuantity(formatDecimal(item.quantity, 2));
  }, [item.quantity]);

  React.useEffect(() => {
    setNewPrice(formatDecimal(item.new_price, 2));
  }, [item.new_price]);

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
      <TableCell>{item.item_code || "-"}</TableCell>
      <TableCell>{item.item_name}</TableCell>
      <TableCell>{item.unit}</TableCell>
      <TableCell>
        <LocaleNumberInput
          value={quantity}
          onChange={setQuantity}
          onBlur={() => onFieldCommit(item, "quantity", quantity)}
          className="text-right text-sm"
          decimalPlaces={2}
        />
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {formatDecimal(item.old_price, 2)}
      </TableCell>
      <TableCell>
        <LocaleNumberInput
          value={newPrice}
          onChange={setNewPrice}
          onBlur={() => onFieldCommit(item, "new_price", newPrice)}
          className="text-right text-sm"
          decimalPlaces={2}
        />
      </TableCell>
      <TableCell className="text-right">
        <span className={item.price_difference > 0 ? "text-green-600" : item.price_difference < 0 ? "text-destructive" : ""}>
          {formatDecimal(item.price_difference, 2)}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <span className={item.value_difference > 0 ? "text-green-600" : item.value_difference < 0 ? "text-destructive" : ""}>
          {formatDecimal(item.value_difference, 2)}
        </span>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
