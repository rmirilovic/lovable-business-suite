import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { useArticles, Article } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatDecimal } from "@/lib/formatting";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeliveryOrderItemsEditorProps {
  orderId: string;
  companyId: string;
  isReadOnly: boolean;
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

export function DeliveryOrderItemsEditor({ orderId, companyId, isReadOnly, onItemsChanged }: DeliveryOrderItemsEditorProps) {
  const { selectedCompany } = useAuth();
  const { articles } = useArticles(selectedCompany?.id);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  const materialArticles = articles.filter((a) => a.is_active && a.svk && SVK_MATERIAL_GOODS.includes(a.svk));
  const filteredArticles = materialArticles.filter(
    (a) => a.code.toLowerCase().includes(searchTerm.toLowerCase()) || a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Load items from DB
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("delivery_order_items")
        .select("*")
        .eq("delivery_order_id", orderId)
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
  }, [orderId]);

  // Enrich stock info
  useEffect(() => {
    if (!isLoaded || items.length === 0) return;
    const enrichStock = () => {
      setItems((prev) =>
        prev.map((item) => {
          const art = articles.find((a) => a.id === item.article_id);
          return { ...item, available_stock: art?.stock ?? 0 };
        })
      );
    };
    enrichStock();
  }, [isLoaded, articles]);

  const saveItems = useCallback(
    async (newItems: ItemRow[]) => {
      // Delete old items and re-insert
      await supabase.from("delivery_order_items").delete().eq("delivery_order_id", orderId);
      if (newItems.length > 0) {
        const toInsert = newItems.map((item, i) => ({
          delivery_order_id: orderId,
          company_id: companyId,
          article_id: item.article_id,
          item_code: item.item_code,
          item_name: item.item_name,
          description: item.description || null,
          unit: item.unit,
          quantity: item.quantity,
          item_order: i + 1,
        }));
        const { error } = await supabase.from("delivery_order_items").insert(toInsert);
        if (error) {
          toast.error(`Greška: ${error.message}`);
          return;
        }
      }
      onItemsChanged?.();
    },
    [orderId, companyId, onItemsChanged]
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
          available_stock: article.stock,
        },
      ];
    }
    setItems(newItems);
    saveItems(newItems);
    setSearchTerm("");
  };

  const updateQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], quantity };
    setItems(newItems);
  };

  const commitQuantity = (index: number) => {
    saveItems(items);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    saveItems(newItems);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Stavke naloga</h3>
      {!isReadOnly && (
        <div className="relative">
          <Input placeholder="Pretraži artikle..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoComplete="off" />
          {searchTerm && filteredArticles.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredArticles.slice(0, 10).map((article) => (
                <button key={article.id} type="button" className="w-full px-3 py-2 text-left hover:bg-accent flex justify-between" onClick={() => addItem(article)}>
                  <span><span className="font-medium">{article.code}</span> - {article.name}</span>
                  <span className="text-muted-foreground text-sm">Zaliha: {formatDecimal(article.stock)} {article.unit}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Šifra</TableHead>
              <TableHead>Naziv</TableHead>
              <TableHead className="w-[80px]">JM</TableHead>
              <TableHead className="w-[100px] text-right">Zaliha</TableHead>
              <TableHead className="w-[120px] text-right">Količina</TableHead>
              {!isReadOnly && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isReadOnly ? 5 : 6} className="text-center text-muted-foreground py-8">Nema stavki</TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.item_code}</TableCell>
                  <TableCell>{item.item_name}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">{formatDecimal(item.available_stock)}</TableCell>
                  <TableCell className="text-right">
                    {isReadOnly ? formatDecimal(item.quantity) : (
                      <LocaleNumberInput
                        value={String(item.quantity)}
                        onChange={(val) => updateQuantity(index, parseFloat(val.replace(",", ".")) || 0)}
                        onBlur={() => commitQuantity(index)}
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
