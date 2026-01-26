import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Package, Briefcase, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { useQuoteItems, QuoteItem, QuoteItemFormData } from "@/hooks/useQuotes";
import { useArticles, Article } from "@/hooks/useArticles";
import { useAuth } from "@/contexts/AuthContext";
import { formatDecimal, formatNumber } from "@/lib/formatting";

interface QuoteItemsEditorProps {
  quoteId: string;
  isReadOnly: boolean;
  onTotalsChange: (subtotal: number, vatAmount: number, totalAmount: number) => void;
}

const VAT_RATES = [0, 10, 20];

export function QuoteItemsEditor({ quoteId, isReadOnly, onTotalsChange }: QuoteItemsEditorProps) {
  const { selectedCompany } = useAuth();
  const { items, isLoading, addItem, updateItem, deleteItem } = useQuoteItems(quoteId);
  const { articles } = useArticles(selectedCompany?.id);

  const [editingItem, setEditingItem] = useState<Partial<QuoteItemFormData> & { id?: string; isService?: boolean }>({});
  const [isAdding, setIsAdding] = useState(false);
  const [itemType, setItemType] = useState<'article' | 'service'>('article');

  // Calculate totals
  useEffect(() => {
    const subtotal = items.reduce((sum, item) => sum + item.line_subtotal, 0);
    const vatAmount = items.reduce((sum, item) => sum + item.line_vat, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);
    onTotalsChange(subtotal, vatAmount, totalAmount);
  }, [items, onTotalsChange]);

  const resetEditingItem = () => {
    setEditingItem({});
    setIsAdding(false);
    setItemType('article');
  };

  const handleAddNew = (type: 'article' | 'service') => {
    setItemType(type);
    setIsAdding(true);
    setEditingItem({
      article_id: null,
      item_code: "",
      item_name: "",
      unit: type === 'service' ? 'usluga' : 'kom',
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      vat_rate: 20,
      description: null,
      isService: type === 'service',
    });
  };

  const handleArticleSelect = (articleId: string) => {
    const article = articles.find(a => a.id === articleId);
    if (article) {
      setEditingItem({
        ...editingItem,
        article_id: article.id,
        item_code: article.code,
        item_name: article.name,
        unit: article.unit,
        unit_price: article.selling_price || 0,
        vat_rate: 20, // Default PDV rate
      });
    }
  };

  const handleSaveItem = async () => {
    if (!editingItem.item_name) return;

    const itemData: QuoteItemFormData = {
      article_id: editingItem.article_id || null,
      item_code: editingItem.item_code || null,
      item_name: editingItem.item_name!,
      unit: editingItem.unit || 'kom',
      quantity: editingItem.quantity || 1,
      unit_price: editingItem.unit_price || 0,
      discount_percent: editingItem.discount_percent || 0,
      vat_rate: editingItem.vat_rate || 20,
      description: editingItem.description || null,
    };

    if (editingItem.id) {
      await updateItem.mutateAsync({ id: editingItem.id, ...itemData });
    } else {
      await addItem.mutateAsync({ quote_id: quoteId, ...itemData });
    }
    resetEditingItem();
  };

  const handleEditItem = (item: QuoteItem) => {
    setEditingItem({
      id: item.id,
      article_id: item.article_id,
      item_code: item.item_code,
      item_name: item.item_name,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent,
      vat_rate: item.vat_rate,
      description: item.description,
      isService: !item.article_id,
    });
    setIsAdding(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm("Da li ste sigurni da želite da obrišete ovu stavku?")) {
      await deleteItem.mutateAsync(id);
    }
  };

  const calculateLineTotal = () => {
    const quantity = editingItem.quantity || 0;
    const unitPrice = editingItem.unit_price || 0;
    const discountPercent = editingItem.discount_percent || 0;
    const vatRate = editingItem.vat_rate || 0;

    const subtotal = quantity * unitPrice * (1 - discountPercent / 100);
    const vat = subtotal * (vatRate / 100);
    return subtotal + vat;
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Učitavanje stavki...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Stavke ponude</h3>
        {!isReadOnly && !isAdding && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleAddNew('article')}>
              <Package className="w-4 h-4 mr-2" />
              Dodaj artikal
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleAddNew('service')}>
              <Briefcase className="w-4 h-4 mr-2" />
              Dodaj uslugu
            </Button>
          </div>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-24">Šifra</TableHead>
              <TableHead className="min-w-[200px]">Naziv</TableHead>
              <TableHead className="text-right w-32">Količina</TableHead>
              <TableHead className="w-16">JM</TableHead>
              <TableHead className="text-right w-36">Cena</TableHead>
              <TableHead className="text-right w-20">Rabat %</TableHead>
              <TableHead className="text-right w-20">PDV %</TableHead>
              <TableHead className="text-right w-36">Ukupno</TableHead>
              {!isReadOnly && <TableHead className="w-20"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.id} className={editingItem.id === item.id ? "bg-muted" : ""}>
                {editingItem.id === item.id ? (
                  <EditingRow
                    editingItem={editingItem}
                    setEditingItem={setEditingItem}
                    articles={articles}
                    onSave={handleSaveItem}
                    onCancel={resetEditingItem}
                    isService={!item.article_id}
                    index={index + 1}
                    calculateLineTotal={calculateLineTotal}
                  />
                ) : (
                  <>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.item_code || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.article_id ? (
                          <Package className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Briefcase className="w-4 h-4 text-muted-foreground" />
                        )}
                        {item.item_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{formatDecimal(item.unit_price)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.discount_percent)}%</TableCell>
                    <TableCell className="text-right">{formatNumber(item.vat_rate)}%</TableCell>
                    <TableCell className="text-right font-medium">{formatDecimal(item.line_total)}</TableCell>
                    {!isReadOnly && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditItem(item)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </>
                )}
              </TableRow>
            ))}

            {isAdding && !editingItem.id && (
              <TableRow className="bg-muted">
                <EditingRow
                  editingItem={editingItem}
                  setEditingItem={setEditingItem}
                  articles={articles}
                  onSave={handleSaveItem}
                  onCancel={resetEditingItem}
                  isService={itemType === 'service'}
                  index={items.length + 1}
                  calculateLineTotal={calculateLineTotal}
                />
              </TableRow>
            )}

            {items.length === 0 && !isAdding && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  Nema stavki. Dodajte artikal ili uslugu.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Osnovica:</span>
            <span>{formatDecimal(items.reduce((s, i) => s + i.line_subtotal, 0))} RSD</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>PDV:</span>
            <span>{formatDecimal(items.reduce((s, i) => s + i.line_vat, 0))} RSD</span>
          </div>
          <div className="flex justify-between font-semibold text-lg border-t pt-2">
            <span>Ukupno:</span>
            <span>{formatDecimal(items.reduce((s, i) => s + i.line_total, 0))} RSD</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EditingRowProps {
  editingItem: Partial<QuoteItemFormData> & { id?: string; isService?: boolean };
  setEditingItem: (item: Partial<QuoteItemFormData> & { id?: string; isService?: boolean }) => void;
  articles: Article[];
  onSave: () => void;
  onCancel: () => void;
  isService: boolean;
  index: number;
  calculateLineTotal: () => number;
}

function EditingRow({
  editingItem,
  setEditingItem,
  articles,
  onSave,
  onCancel,
  isService,
  index,
  calculateLineTotal,
}: EditingRowProps) {
  const handleArticleChange = (articleId: string, article: Article) => {
    setEditingItem({
      ...editingItem,
      article_id: article.id,
      item_code: article.code,
      item_name: article.name,
      unit: article.unit,
      unit_price: article.selling_price || 0,
      vat_rate: 20,
    });
  };

  return (
    <>
      <TableCell>{index}</TableCell>
      <TableCell>
        {isService ? (
          <Input
            value={editingItem.item_code || ""}
            onChange={(e) => setEditingItem({ ...editingItem, item_code: e.target.value })}
            placeholder="Šifra"
            className="h-8"
          />
        ) : (
          <span className="text-muted-foreground">{editingItem.item_code || "-"}</span>
        )}
      </TableCell>
      <TableCell className="min-w-[200px]">
        {isService ? (
          <Input
            value={editingItem.item_name || ""}
            onChange={(e) => setEditingItem({ ...editingItem, item_name: e.target.value })}
            placeholder="Naziv usluge"
            className="h-8"
            autoComplete="off"
          />
        ) : (
          <SearchableArticleSelect
            articles={articles}
            value={editingItem.article_id || ""}
            onValueChange={handleArticleChange}
            placeholder="Pretraži artikal..."
          />
        )}
      </TableCell>
      <TableCell>
        <Input
          type="text"
          inputMode="decimal"
          value={editingItem.quantity || ""}
          onChange={(e) => {
            const val = e.target.value.replace(',', '.');
            if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
              setEditingItem({ ...editingItem, quantity: val === '' ? 0 : parseFloat(val) || 0 });
            }
          }}
          className="h-8 text-right w-28"
          autoComplete="off"
        />
      </TableCell>
      <TableCell>
        <Input
          value={editingItem.unit || ""}
          onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
          className="h-8 w-16"
          autoComplete="off"
        />
      </TableCell>
      <TableCell>
        <Input
          type="text"
          inputMode="decimal"
          value={editingItem.unit_price || ""}
          onChange={(e) => {
            const val = e.target.value.replace(',', '.');
            if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
              setEditingItem({ ...editingItem, unit_price: val === '' ? 0 : parseFloat(val) || 0 });
            }
          }}
          className="h-8 text-right w-32"
          autoComplete="off"
        />
      </TableCell>
      <TableCell>
        <Input
          type="text"
          inputMode="decimal"
          value={editingItem.discount_percent || ""}
          onChange={(e) => {
            const val = e.target.value.replace(',', '.');
            if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
              const num = parseFloat(val) || 0;
              setEditingItem({ ...editingItem, discount_percent: Math.min(100, Math.max(0, num)) });
            }
          }}
          className="h-8 text-right w-16"
          autoComplete="off"
        />
      </TableCell>
      <TableCell>
        <Select
          value={String(editingItem.vat_rate || 20)}
          onValueChange={(v) => setEditingItem({ ...editingItem, vat_rate: parseInt(v) })}
        >
          <SelectTrigger className="h-8 w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VAT_RATES.map((rate) => (
              <SelectItem key={rate} value={String(rate)}>
                {rate}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right font-medium w-36">
        {formatDecimal(calculateLineTotal())}
      </TableCell>
      <TableCell className="w-24">
        <div className="flex gap-1 flex-nowrap">
          <Button size="sm" onClick={onSave} disabled={!editingItem.item_name}>
            OK
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            X
          </Button>
        </div>
      </TableCell>
    </>
  );
}
