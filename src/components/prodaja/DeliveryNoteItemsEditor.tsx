import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { useArticles, Article } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";
import { DeliveryNoteItemData } from "@/hooks/useDeliveryNotes";

interface DeliveryNoteItemsEditorProps {
  items: DeliveryNoteItemData[];
  onChange: (items: DeliveryNoteItemData[]) => void;
  disabled?: boolean;
}

const SVK_MATERIAL_GOODS = ["1", "2", "9"];

export function DeliveryNoteItemsEditor({ items, onChange, disabled }: DeliveryNoteItemsEditorProps) {
  const { selectedCompany } = useAuth();
  const { articles } = useArticles(selectedCompany?.id);
  const [searchTerm, setSearchTerm] = useState("");

  const materialArticles = articles.filter((a) => a.is_active && a.svk && SVK_MATERIAL_GOODS.includes(a.svk));
  const filteredArticles = materialArticles.filter(
    (a) => a.code.toLowerCase().includes(searchTerm.toLowerCase()) || a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addItem = (article: Article) => {
    const existing = items.findIndex((i) => i.article_id === article.id);
    if (existing >= 0) {
      const newItems = [...items];
      newItems[existing].quantity += 1;
      onChange(newItems);
    } else {
      onChange([
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
      ]);
    }
    setSearchTerm("");
  };

  const updateItem = (index: number, updates: Partial<DeliveryNoteItemData>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange(newItems);
  };

  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="space-y-4">
      {!disabled && (
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
              {!disabled && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={disabled ? 5 : 6} className="text-center text-muted-foreground py-8">Nema stavki</TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.item_code}</TableCell>
                  <TableCell>{item.item_name}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">{formatDecimal(item.available_stock)}</TableCell>
                  <TableCell className="text-right">
                    {disabled ? formatDecimal(item.quantity) : (
                      <LocaleNumberInput 
                        value={String(item.quantity)} 
                        onChange={(val) => updateItem(index, { quantity: parseFloat(val.replace(',', '.')) || 0 })} 
                        className="w-full text-right" 
                      />
                    )}
                  </TableCell>
                  {!disabled && (
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
