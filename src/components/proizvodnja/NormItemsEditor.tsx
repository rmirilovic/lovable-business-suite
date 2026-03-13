import { useState } from "react";
import { useMaterialNormItems, MaterialNormItem } from "@/hooks/useMaterialNorms";
import { useArticles } from "@/hooks/useArticles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatNumber, parseLocaleNumber } from "@/lib/formatting";
import { Plus, Trash2 } from "lucide-react";

interface NormItemsEditorProps {
  variantId: string;
  companyId: string;
  readOnly?: boolean;
}

/** Format a number showing up to 6 decimal places, but trim trailing zeros */
function formatFlexDecimal(val: number): string {
  if (val === 0) return "0";
  // Use up to 6 decimals, then trim trailing zeros
  const s = val.toFixed(6);
  // Remove trailing zeros after decimal point
  return s.replace(/\.?0+$/, "");
}

export function NormItemsEditor({ variantId, companyId, readOnly = false }: NormItemsEditorProps) {
  const { items, isLoading, invalidate } = useMaterialNormItems(variantId);
  const { articles } = useArticles(companyId);
  const [addingArticleId, setAddingArticleId] = useState("");

  // Only SVK=2 articles (raw materials)
  const rawMaterials = articles.filter((a) => a.svk === "2" && a.is_active);

  const handleAddItem = async () => {
    if (!addingArticleId) return;

    const article = articles.find((a) => a.id === addingArticleId);
    if (!article) return;

    // Check duplicate
    if (items.some((i) => i.article_id === addingArticleId)) {
      toast.error("Ovaj materijal je već dodat");
      return;
    }

    const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.item_order)) + 1 : 1;

    const { error } = await supabase.from("material_norm_items").insert({
      variant_id: variantId,
      company_id: companyId,
      article_id: article.id,
      article_code: article.code,
      article_name: article.name,
      unit: article.unit,
      item_order: nextOrder,
    });

    if (error) {
      toast.error("Greška: " + error.message);
    } else {
      setAddingArticleId("");
      invalidate();
    }
  };

  const handleUpdateQty = async (
    itemId: string,
    field: "qty_per_kg" | "qty_per_m" | "qty_per_pc",
    value: string
  ) => {
    // Parse locale number
    const { parseLocaleNumber } = await import("@/lib/formatting");
    const numVal = parseLocaleNumber(value);

    const { error } = await supabase
      .from("material_norm_items")
      .update({ [field]: numVal })
      .eq("id", itemId);

    if (error) {
      toast.error("Greška: " + error.message);
    } else {
      invalidate();
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase.from("material_norm_items").delete().eq("id", itemId);
    if (error) {
      toast.error("Greška: " + error.message);
    } else {
      invalidate();
    }
  };

  // Totals
  const totalKg = items.reduce((s, i) => s + (i.qty_per_kg ?? 0), 0);
  const totalM = items.reduce((s, i) => s + (i.qty_per_m ?? 0), 0);
  const totalPc = items.reduce((s, i) => s + (i.qty_per_pc ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Add item */}
      {!readOnly && (
        <div className="flex items-end gap-2">
          <div className="w-[400px]">
            <label className="text-sm font-medium mb-1 block">Dodaj materijal (SVK=2)</label>
            <SearchableArticleSelect
              articles={rawMaterials}
              value={addingArticleId}
              onValueChange={(id) => setAddingArticleId(id)}
              placeholder="Izaberite repromaterijal..."
            />
          </div>
          <Button onClick={handleAddItem} disabled={!addingArticleId} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Dodaj
          </Button>
        </div>
      )}

      <TableScrollContainer className="max-h-[calc(100vh-350px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">R.br.</TableHead>
              <TableHead className="w-[100px]">Šifra</TableHead>
              <TableHead>Naziv materijala</TableHead>
              <TableHead className="w-[60px]">JM</TableHead>
              <TableHead className="w-[160px] text-right">Utrošak / kg</TableHead>
              <TableHead className="w-[160px] text-right">Utrošak / m</TableHead>
              <TableHead className="w-[160px] text-right">Utrošak / kom</TableHead>
              {!readOnly && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Učitavanje...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nema stavki. Dodajte repromaterijal.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, idx) => (
                <NormItemRow
                  key={item.id}
                  item={item}
                  index={idx}
                  onUpdateQty={handleUpdateQty}
                  onDelete={handleDeleteItem}
                  readOnly={readOnly}
                />
              ))
            )}
          </TableBody>
          {items.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-medium">
                  Ukupno:
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatFlexDecimal(totalKg)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatFlexDecimal(totalM)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatFlexDecimal(totalPc)}
                </TableCell>
                {!readOnly && <TableCell></TableCell>}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </TableScrollContainer>
    </div>
  );
}

// Extracted row component for inline editing
function NormItemRow({
  item,
  index,
  onUpdateQty,
  onDelete,
  readOnly = false,
}: {
  item: MaterialNormItem;
  index: number;
  onUpdateQty: (id: string, field: "qty_per_kg" | "qty_per_m" | "qty_per_pc", value: string) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
      <TableCell className="font-medium">{item.article_code}</TableCell>
      <TableCell>{item.article_name}</TableCell>
      <TableCell>{item.unit}</TableCell>
      <TableCell>
        {readOnly ? (
          <span className="text-sm text-right block">{formatFlexDecimal(item.qty_per_kg)}</span>
        ) : (
          <LocaleNumberInput
            value={formatNumber(item.qty_per_kg, { minimumFractionDigits: 6, useGrouping: false }).replace('.', ',')}
            onChange={() => {}}
            onBlur={(e) => onUpdateQty(item.id, "qty_per_kg", (e.target as HTMLInputElement).value)}
            decimalPlaces={6}
            allowEmpty
            className="h-7 text-sm text-right w-full"
          />
        )}
      </TableCell>
      <TableCell>
        {readOnly ? (
          <span className="text-sm text-right block">{formatFlexDecimal(item.qty_per_m)}</span>
        ) : (
          <LocaleNumberInput
            value={formatNumber(item.qty_per_m, { minimumFractionDigits: 6, useGrouping: false }).replace('.', ',')}
            onChange={() => {}}
            onBlur={(e) => onUpdateQty(item.id, "qty_per_m", (e.target as HTMLInputElement).value)}
            decimalPlaces={6}
            allowEmpty
            className="h-7 text-sm text-right w-full"
          />
        )}
      </TableCell>
      <TableCell>
        {readOnly ? (
          <span className="text-sm text-right block">{formatFlexDecimal(item.qty_per_pc)}</span>
        ) : (
          <LocaleNumberInput
            value={formatNumber(item.qty_per_pc, { minimumFractionDigits: 6, useGrouping: false }).replace('.', ',')}
            onChange={() => {}}
            onBlur={(e) => onUpdateQty(item.id, "qty_per_pc", (e.target as HTMLInputElement).value)}
            decimalPlaces={6}
            allowEmpty
            className="h-7 text-sm text-right w-full"
          />
        )}
      </TableCell>
      {!readOnly && (
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}
