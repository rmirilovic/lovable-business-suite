import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { isForeignCurrency } from "@/lib/currencies";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Trash2 } from "lucide-react";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { useInputCosts } from "@/hooks/useInputCosts";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useAuth } from "@/contexts/AuthContext";
import { ReceivedCreditNoteItem, ReceivedCreditNoteItemFormData } from "@/hooks/useReceivedCreditNotes";
import { formatNumber, formatPrice, parseLocaleNumber } from "@/lib/formatting";
import { UseMutationResult } from "@tanstack/react-query";

interface Props {
  docId: string;
  items: ReceivedCreditNoteItem[];
  isLoading: boolean;
  isEditable: boolean;
  supplierIsInPdv: boolean;
  currency: string;
  exchangeRate: number;
  addItem: UseMutationResult<ReceivedCreditNoteItem, Error, ReceivedCreditNoteItemFormData & { received_credit_note_id: string }>;
  updateItem: UseMutationResult<ReceivedCreditNoteItem, Error, ReceivedCreditNoteItemFormData & { id: string }>;
  deleteItem: UseMutationResult<void, Error, string>;
}

interface ItemFormState {
  input_cost_id: string | null;
  item_code: string | null;
  item_name: string;
  description: string | null;
  org_unit_id: string | null;
  quantity: string;
  unit: string;
  unit_price: string;
  foreign_unit_price: string;
  discount_percent: number;
  vat_rate: string;
  is_vat_deductible: boolean;
}

const fmt = (n: number) => n.toFixed(2).replace(".", ",");

const emptyForm: ItemFormState = {
  input_cost_id: null, item_code: null, item_name: "", description: null,
  org_unit_id: null, quantity: "1,00", unit: "kom", unit_price: "0,00",
  foreign_unit_price: "0,00", discount_percent: 0, vat_rate: "20,00", is_vat_deductible: true,
};

const toFormData = (s: ItemFormState): ReceivedCreditNoteItemFormData => ({
  input_cost_id: s.input_cost_id, item_code: s.item_code, item_name: s.item_name,
  description: s.description, org_unit_id: s.org_unit_id,
  quantity: parseLocaleNumber(s.quantity) || 0, unit: s.unit,
  unit_price: parseLocaleNumber(s.unit_price) || 0,
  foreign_unit_price: parseLocaleNumber(s.foreign_unit_price ?? "0") || 0,
  discount_percent: s.discount_percent,
  vat_rate: parseLocaleNumber(s.vat_rate) || 0, is_vat_deductible: s.is_vat_deductible,
});

export function ReceivedCreditNoteItemsEditor({ docId, items, isLoading, isEditable, supplierIsInPdv, currency, exchangeRate, addItem, updateItem, deleteItem }: Props) {
  const { selectedCompany } = useAuth();
  const { data: inputCosts = [] } = useInputCosts();
  const { units: orgUnits } = useOrganizationalUnits(selectedCompany?.id);
  const isForeign = isForeignCurrency(currency);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<ItemFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<ItemFormState>(emptyForm);
  const activeInputCosts = inputCosts.filter((ic) => ic.is_active);
  const activeOrgUnits = orgUnits.filter((ou) => ou.is_active);

  const handleInputCostSelect = (costId: string, isNew: boolean) => {
    const cost = inputCosts.find((c) => c.id === costId);
    if (!cost) return;
    const data = { input_cost_id: cost.id, item_code: cost.code, item_name: cost.name, vat_rate: fmt(cost.vat_rate), is_vat_deductible: cost.is_vat_deductible };
    if (isNew) setNewItem((p) => ({ ...p, ...data }));
    else setEditItem((p) => ({ ...p, ...data }));
  };

  const handleAddSubmit = async () => {
    if (!newItem.item_name) return;
    await addItem.mutateAsync({ received_credit_note_id: docId, ...toFormData(newItem) });
    setNewItem(emptyForm); setIsAdding(false);
  };

  const handleEditStart = (item: ReceivedCreditNoteItem) => {
    setEditingId(item.id);
    setEditItem({
      input_cost_id: item.input_cost_id, item_code: item.item_code, item_name: item.item_name,
      description: item.description, org_unit_id: item.org_unit_id,
      quantity: fmt(item.quantity), unit: item.unit, unit_price: fmt(item.unit_price),
      foreign_unit_price: fmt(item.foreign_unit_price ?? 0), discount_percent: item.discount_percent,
      vat_rate: fmt(item.vat_rate), is_vat_deductible: item.is_vat_deductible,
    });
  };

  const handleEditSubmit = async () => {
    if (!editingId || !editItem.item_name) return;
    await updateItem.mutateAsync({ id: editingId, ...toFormData(editItem) });
    setEditingId(null);
  };

  const handleForeignPriceBlur = (item: ItemFormState, setItem: (s: ItemFormState) => void) => {
    if (!isForeign) return;
    const rsd = (parseLocaleNumber(item.foreign_unit_price) || 0) * exchangeRate;
    setItem({ ...item, unit_price: fmt(rsd) });
  };

  const handleRsdPriceBlur = (item: ItemFormState, setItem: (s: ItemFormState) => void) => {
    if (!isForeign) return;
    const foreign = exchangeRate > 0 ? (parseLocaleNumber(item.unit_price) || 0) / exchangeRate : 0;
    setItem({ ...item, foreign_unit_price: fmt(foreign) });
  };

  const renderNumericInputs = (item: ItemFormState, setItem: (s: ItemFormState) => void) => (
    <>
      <TableCell><LocaleNumberInput value={item.quantity} onChange={(v) => setItem({ ...item, quantity: v })} decimalPlaces={2} allowEmpty className="h-8 text-xs text-right" /></TableCell>
      {isForeign && <TableCell><LocaleNumberInput value={item.foreign_unit_price} onChange={(v) => setItem({ ...item, foreign_unit_price: v })} onBlur={() => handleForeignPriceBlur(item, setItem)} decimalPlaces={2} allowEmpty className="h-8 text-xs text-right" /></TableCell>}
      <TableCell><LocaleNumberInput value={item.unit_price} onChange={(v) => setItem({ ...item, unit_price: v })} onBlur={() => isForeign && handleRsdPriceBlur(item, setItem)} decimalPlaces={2} allowEmpty className="h-8 text-xs text-right" /></TableCell>
      <TableCell><LocaleNumberInput value={item.vat_rate} onChange={(v) => setItem({ ...item, vat_rate: v })} decimalPlaces={2} allowEmpty className="h-8 text-xs text-right" /></TableCell>
    </>
  );

  const renderEditRow = (item: ItemFormState, setItem: (s: ItemFormState) => void, onSubmit: () => void, onCancel: () => void, isPending: boolean) => (
    <>
      <TableCell>
        <Select value={item.input_cost_id || "none"} onValueChange={(v) => v !== "none" && handleInputCostSelect(v, item === newItem)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Izaberi" /></SelectTrigger>
          <SelectContent><SelectItem value="none">--</SelectItem>{activeInputCosts.map((ic) => <SelectItem key={ic.id} value={ic.id}>{ic.code}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{inputCosts.find((ic) => ic.id === item.input_cost_id)?.account_code || "-"}</TableCell>
      <TableCell><Input value={item.item_name} onChange={(e) => setItem({ ...item, item_name: e.target.value })} className="h-8 text-xs" autoComplete="off" /></TableCell>
      <TableCell>
        <Select value={item.org_unit_id || "none"} onValueChange={(v) => setItem({ ...item, org_unit_id: v === "none" ? null : v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="OJ" /></SelectTrigger>
          <SelectContent><SelectItem value="none">-- Bez OJ --</SelectItem>{activeOrgUnits.map((ou) => <SelectItem key={ou.id} value={ou.id}>{ou.code}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      {renderNumericInputs(item, setItem)}
      <TableCell className="text-center"><Checkbox checked={item.is_vat_deductible} onCheckedChange={(c) => setItem({ ...item, is_vat_deductible: c as boolean })} /></TableCell>
      <TableCell>
        <div className="flex gap-1 flex-nowrap">
          <Button size="sm" type="button" onClick={onSubmit} disabled={!item.item_name || isPending} className="h-7 px-2 text-xs">Zapamti</Button>
          <Button size="icon" variant="ghost" type="button" className="h-7 w-7" onClick={onCancel}><X className="h-4 w-4 text-destructive" /></Button>
        </div>
      </TableCell>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Stavke dokumenta</h3>
        {isEditable && !isAdding && <Button size="sm" onClick={() => setIsAdding(true)}><Plus className="h-4 w-4 mr-1" />Dodaj stavku</Button>}
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[350px]">Trošak</TableHead>
              <TableHead className="w-[100px]">Konto</TableHead>
              <TableHead className="min-w-[200px]">Naziv</TableHead>
              <TableHead className="w-[120px]">Mesto troška</TableHead>
              <TableHead className="w-[200px] text-right">Kol.</TableHead>
              {isForeign && <TableHead className="w-[140px] text-right">Cena ({currency})</TableHead>}
              <TableHead className="w-[250px] text-right">{isForeign ? "Cena (RSD)" : "Cena sa PDV"}</TableHead>
              <TableHead className="w-[80px] text-right">PDV%</TableHead>
              <TableHead className="w-[50px] text-center">Odb.</TableHead>
              <TableHead className="w-[100px] text-right">Ukupno</TableHead>
              {isEditable && <TableHead className="w-[130px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={isEditable ? 11 : 10} className="text-center py-4">Učitavanje...</TableCell></TableRow>
            ) : (
              <>
                {items.map((item) =>
                  editingId === item.id ? (
                    <TableRow key={item.id}>{renderEditRow(editItem, setEditItem, handleEditSubmit, () => setEditingId(null), updateItem.isPending)}</TableRow>
                  ) : (
                    <TableRow key={item.id} className={isEditable ? "cursor-pointer hover:bg-muted/50" : ""} onClick={() => isEditable && handleEditStart(item)}>
                      <TableCell><div><div>{item.item_code || "-"}</div><div className="text-xs text-muted-foreground">{inputCosts.find((ic) => ic.id === item.input_cost_id)?.name || ""}</div></div></TableCell>
                      <TableCell className="text-muted-foreground">{inputCosts.find((ic) => ic.id === item.input_cost_id)?.account_code || "-"}</TableCell>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell>{item.org_unit?.code || "-"}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                      {isForeign && <TableCell className="text-right">{formatNumber(item.foreign_unit_price ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>}
                      <TableCell className="text-right">{formatPrice(item.unit_price)}</TableCell>
                      <TableCell className="text-right">{item.vat_rate}%</TableCell>
                      <TableCell className="text-center"><Checkbox checked={item.is_vat_deductible} disabled /></TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(item.line_total)}</TableCell>
                      {isEditable && <TableCell onClick={(e) => e.stopPropagation()}><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteItem.mutateAsync(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>}
                    </TableRow>
                  )
                )}
                {isAdding && <TableRow>{renderEditRow(newItem, setNewItem, handleAddSubmit, () => { setNewItem(emptyForm); setIsAdding(false); }, addItem.isPending)}</TableRow>}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
