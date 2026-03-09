import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, X, Trash2 } from "lucide-react";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import {
  AdvancePurchaseInvoiceItem,
  AdvancePurchaseInvoiceItemFormData,
} from "@/hooks/useAdvancePurchaseInvoices";
import { formatPrice, parseLocaleNumber } from "@/lib/formatting";
import { UseMutationResult } from "@tanstack/react-query";

interface Props {
  invoiceId: string;
  items: AdvancePurchaseInvoiceItem[];
  isLoading: boolean;
  isEditable: boolean;
  supplierIsInPdv: boolean;
  addItem: UseMutationResult<any, Error, AdvancePurchaseInvoiceItemFormData & { advance_purchase_invoice_id: string }>;
  updateItem: UseMutationResult<any, Error, AdvancePurchaseInvoiceItemFormData & { id: string }>;
  deleteItem: UseMutationResult<void, Error, string>;
}

interface ItemForm {
  description: string;
  vat_rate: string;
  line_total: string;
  tax_category_code: string;
  tax_exemption_reason: string;
}

const fmt = (n: number) => n.toFixed(2).replace('.', ',');

const emptyForm: ItemForm = {
  description: "",
  vat_rate: "20,00",
  line_total: "0,00",
  tax_category_code: "S",
  tax_exemption_reason: "",
};

export function AdvancePurchaseInvoiceItemsEditor({
  invoiceId, items, isLoading, isEditable, supplierIsInPdv,
  addItem, updateItem, deleteItem,
}: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<ItemForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<ItemForm>(emptyForm);

  const calcLine = (form: ItemForm) => {
    const total = parseLocaleNumber(form.line_total) || 0;
    const vatRate = parseLocaleNumber(form.vat_rate) || 0;
    if (!supplierIsInPdv || vatRate <= 0) return { subtotal: total, vat: 0, total };
    const subtotal = total / (1 + vatRate / 100);
    return { subtotal, vat: total - subtotal, total };
  };

  const toFormData = (form: ItemForm): AdvancePurchaseInvoiceItemFormData => {
    const total = parseLocaleNumber(form.line_total) || 0;
    return {
      description: form.description,
      unit: "kom",
      quantity: 1,
      unit_price: total,
      vat_rate: parseLocaleNumber(form.vat_rate) || 0,
      line_total: total,
      tax_category_code: form.tax_category_code,
      tax_exemption_reason: form.tax_exemption_reason || null,
    };
  };

  const handleAddSubmit = async () => {
    if (!newItem.description) return;
    await addItem.mutateAsync({ advance_purchase_invoice_id: invoiceId, ...toFormData(newItem) });
    setNewItem(emptyForm);
    setIsAdding(false);
  };

  const handleEditStart = (item: AdvancePurchaseInvoiceItem) => {
    setEditingId(item.id);
    setEditItem({
      description: item.description,
      vat_rate: fmt(item.vat_rate),
      line_total: fmt(item.line_total),
      tax_category_code: item.tax_category_code,
      tax_exemption_reason: item.tax_exemption_reason || "",
    });
  };

  const handleEditSubmit = async () => {
    if (!editingId || !editItem.description) return;
    await updateItem.mutateAsync({ id: editingId, ...toFormData(editItem) });
    setEditingId(null);
  };

  const renderInputRow = (form: ItemForm, setForm: (f: ItemForm) => void, onSubmit: () => void, onCancel: () => void, isPending: boolean) => {
    const line = calcLine(form);
    return (
      <TableRow>
        <TableCell>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-8 text-xs" placeholder="Opis stavke avansa" autoComplete="off" />
        </TableCell>
        <TableCell>
          <Select value={form.tax_category_code} onValueChange={(v) => setForm({ ...form, tax_category_code: v, vat_rate: v === "S" ? "20,00" : v === "AA" ? "10,00" : "0,00" })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="S">S - Standardna</SelectItem>
              <SelectItem value="AA">AA - Niža stopa</SelectItem>
              <SelectItem value="E">E - Oslobođeno</SelectItem>
              <SelectItem value="O">O - Nije predmet</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <LocaleNumberInput value={form.vat_rate} onChange={(v) => setForm({ ...form, vat_rate: v })} decimalPlaces={2} allowEmpty className="h-8 text-xs text-right" />
        </TableCell>
        <TableCell>
          <LocaleNumberInput value={form.line_total} onChange={(v) => setForm({ ...form, line_total: v })} decimalPlaces={2} allowEmpty className="h-8 text-xs text-right" />
        </TableCell>
        <TableCell className="text-right text-xs">{formatPrice(line.subtotal)}</TableCell>
        <TableCell className="text-right text-xs">{formatPrice(line.vat)}</TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button size="sm" type="button" onClick={onSubmit} disabled={!form.description || isPending} className="h-7 px-2 text-xs">Zapamti</Button>
            <Button size="icon" variant="ghost" type="button" className="h-7 w-7" onClick={onCancel}><X className="h-4 w-4 text-destructive" /></Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Stavke avansa</h3>
        {isEditable && !isAdding && (
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />Dodaj stavku
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[250px]">Opis</TableHead>
              <TableHead className="w-[140px]">PDV kategorija</TableHead>
              <TableHead className="w-[100px] text-right">PDV %</TableHead>
              <TableHead className="w-[140px] text-right">Ukupno (bruto)</TableHead>
              <TableHead className="w-[120px] text-right">Osnovica</TableHead>
              <TableHead className="w-[120px] text-right">PDV</TableHead>
              {isEditable && <TableHead className="w-[120px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-4">Učitavanje...</TableCell></TableRow>
            ) : (
              <>
                {items.map((item) =>
                  editingId === item.id ? (
                    renderInputRow(editItem, setEditItem, handleEditSubmit, () => setEditingId(null), updateItem.isPending)
                  ) : (
                    <TableRow key={item.id} className={isEditable ? "cursor-pointer hover:bg-muted/50" : ""} onClick={() => isEditable && handleEditStart(item)}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.tax_category_code}</TableCell>
                      <TableCell className="text-right">{item.vat_rate}%</TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(item.line_total)}</TableCell>
                      <TableCell className="text-right">{formatPrice(item.line_subtotal)}</TableCell>
                      <TableCell className="text-right">{formatPrice(item.line_vat)}</TableCell>
                      {isEditable && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteItem.mutateAsync(item.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                )}
                {isAdding && renderInputRow(newItem, setNewItem, handleAddSubmit, () => setIsAdding(false), addItem.isPending)}
                {!isLoading && items.length === 0 && !isAdding && (
                  <TableRow><TableCell colSpan={7} className="text-center py-4 text-muted-foreground">Nema stavki</TableCell></TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
