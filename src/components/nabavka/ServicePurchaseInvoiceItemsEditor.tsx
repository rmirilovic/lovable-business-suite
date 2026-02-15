import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { isForeignCurrency } from "@/lib/currencies";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Trash2 } from "lucide-react";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { useInputCosts } from "@/hooks/useInputCosts";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useAuth } from "@/contexts/AuthContext";
import {
  ServicePurchaseInvoiceItem,
  ServicePurchaseInvoiceItemFormData,
} from "@/hooks/useServicePurchaseInvoices";
import { formatNumber, formatPrice, parseLocaleNumber } from "@/lib/formatting";
import { UseMutationResult } from "@tanstack/react-query";

interface ServicePurchaseInvoiceItemsEditorProps {
  invoiceId: string;
  items: ServicePurchaseInvoiceItem[];
  isLoading: boolean;
  isEditable: boolean;
  supplierIsInPdv: boolean;
  currency: string;
  exchangeRate: number;
  addItem: UseMutationResult<ServicePurchaseInvoiceItem, Error, ServicePurchaseInvoiceItemFormData & { service_purchase_invoice_id: string }>;
  updateItem: UseMutationResult<ServicePurchaseInvoiceItem, Error, ServicePurchaseInvoiceItemFormData & { id: string }>;
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

const fmt = (n: number) => n.toFixed(2).replace('.', ',');

const emptyFormState: ItemFormState = {
  input_cost_id: null,
  item_code: null,
  item_name: "",
  description: null,
  org_unit_id: null,
  quantity: "1,00",
  unit: "kom",
  unit_price: "0,00",
  foreign_unit_price: "0,00",
  discount_percent: 0,
  vat_rate: "20,00",
  is_vat_deductible: true,
};

const toFormData = (s: ItemFormState): ServicePurchaseInvoiceItemFormData => ({
  input_cost_id: s.input_cost_id,
  item_code: s.item_code,
  item_name: s.item_name,
  description: s.description,
  org_unit_id: s.org_unit_id,
  quantity: parseLocaleNumber(s.quantity) || 0,
  unit: s.unit,
  unit_price: parseLocaleNumber(s.unit_price) || 0,
  foreign_unit_price: parseLocaleNumber(s.foreign_unit_price ?? "0") || 0,
  discount_percent: s.discount_percent,
  vat_rate: parseLocaleNumber(s.vat_rate) || 0,
  is_vat_deductible: s.is_vat_deductible,
});

export function ServicePurchaseInvoiceItemsEditor({
  invoiceId,
  items,
  isLoading,
  isEditable,
  supplierIsInPdv,
  currency,
  exchangeRate,
  addItem,
  updateItem,
  deleteItem,
}: ServicePurchaseInvoiceItemsEditorProps) {
  const { selectedCompany } = useAuth();
  const { data: inputCosts = [] } = useInputCosts();
  const { units: orgUnits } = useOrganizationalUnits(selectedCompany?.id);

  const isForeign = isForeignCurrency(currency);

  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<ItemFormState>(emptyFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<ItemFormState>(emptyFormState);

  const activeInputCosts = inputCosts.filter((ic) => ic.is_active);
  const activeOrgUnits = orgUnits.filter((ou) => ou.is_active);

  const handleInputCostSelect = (costId: string, isNew: boolean) => {
    const cost = inputCosts.find((c) => c.id === costId);
    if (!cost) return;

    const itemData = {
      input_cost_id: cost.id,
      item_code: cost.code,
      item_name: cost.name,
      vat_rate: fmt(cost.vat_rate),
      is_vat_deductible: cost.is_vat_deductible,
    };

    if (isNew) {
      setNewItem((prev) => ({ ...prev, ...itemData }));
    } else {
      setEditItem((prev) => ({ ...prev, ...itemData }));
    }
  };

  const calculateLineTotal = (item: ItemFormState) => {
    const fd = toFormData(item);
    const grossAmount = fd.quantity * fd.unit_price * (1 - fd.discount_percent / 100);
    if (!supplierIsInPdv) {
      return { subtotal: grossAmount, vat: 0, total: grossAmount };
    }
    const subtotal = grossAmount / (1 + fd.vat_rate / 100);
    const vat = grossAmount - subtotal;
    return { subtotal, vat, total: grossAmount };
  };

  const handleAddSubmit = async () => {
    if (!newItem.item_name) return;
    await addItem.mutateAsync({
      service_purchase_invoice_id: invoiceId,
      ...toFormData(newItem),
    });
    setNewItem(emptyFormState);
    setIsAdding(false);
  };

  const handleEditStart = (item: ServicePurchaseInvoiceItem) => {
    setEditingId(item.id);
    setEditItem({
      input_cost_id: item.input_cost_id,
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description,
      org_unit_id: item.org_unit_id,
      quantity: fmt(item.quantity),
      unit: item.unit,
      unit_price: fmt(item.unit_price),
      foreign_unit_price: fmt(item.foreign_unit_price ?? 0),
      discount_percent: item.discount_percent,
      vat_rate: fmt(item.vat_rate),
      is_vat_deductible: item.is_vat_deductible,
    });
  };

  const handleEditSubmit = async () => {
    if (!editingId || !editItem.item_name) return;
    await updateItem.mutateAsync({ id: editingId, ...toFormData(editItem) });
    setEditingId(null);
    setEditItem(emptyFormState);
  };

  const handleDelete = async (id: string) => {
    await deleteItem.mutateAsync(id);
  };

  const handleForeignPriceBlur = (
    item: ItemFormState,
    setItem: (s: ItemFormState) => void,
  ) => {
    if (!isForeign) return;
    const foreignPrice = parseLocaleNumber(item.foreign_unit_price) || 0;
    const rsdPrice = foreignPrice * exchangeRate;
    setItem({ ...item, unit_price: fmt(rsdPrice) });
  };

  const handleRsdPriceBlur = (
    item: ItemFormState,
    setItem: (s: ItemFormState) => void,
  ) => {
    if (!isForeign) return;
    const rsdPrice = parseLocaleNumber(item.unit_price) || 0;
    const foreignPrice = exchangeRate > 0 ? rsdPrice / exchangeRate : 0;
    setItem({ ...item, foreign_unit_price: fmt(foreignPrice) });
  };

  const renderNumericInputs = (
    item: ItemFormState,
    setItem: (s: ItemFormState) => void,
  ) => (
    <>
      <TableCell>
        <LocaleNumberInput
          value={item.quantity}
          onChange={(v) => setItem({ ...item, quantity: v })}
          decimalPlaces={2}
          allowEmpty
          className="h-8 text-xs text-right"
        />
      </TableCell>
      {isForeign && (
        <TableCell>
          <LocaleNumberInput
            value={item.foreign_unit_price}
            onChange={(v) => setItem({ ...item, foreign_unit_price: v })}
            onBlur={() => handleForeignPriceBlur(item, setItem)}
            decimalPlaces={2}
            allowEmpty
            className="h-8 text-xs text-right"
          />
        </TableCell>
      )}
      <TableCell>
        <LocaleNumberInput
          value={item.unit_price}
          onChange={(v) => setItem({ ...item, unit_price: v })}
          onBlur={() => isForeign && handleRsdPriceBlur(item, setItem)}
          decimalPlaces={2}
          allowEmpty
          className="h-8 text-xs text-right"
        />
      </TableCell>
      <TableCell>
        <LocaleNumberInput
          value={item.vat_rate}
          onChange={(v) => setItem({ ...item, vat_rate: v })}
          decimalPlaces={2}
          allowEmpty
          className="h-8 text-xs text-right"
        />
      </TableCell>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Stavke fakture</h3>
        {isEditable && !isAdding && (
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Dodaj stavku
          </Button>
        )}
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
              {isForeign && (
                <TableHead className="w-[140px] text-right">Cena ({currency})</TableHead>
              )}
              <TableHead className="w-[250px] text-right">{isForeign ? "Cena (RSD)" : "Cena sa PDV"}</TableHead>
              <TableHead className="w-[80px] text-right">PDV%</TableHead>
              <TableHead className="w-[50px] text-center">Odb.</TableHead>
              <TableHead className="w-[100px] text-right">Ukupno</TableHead>
              {isEditable && <TableHead className="w-[130px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isEditable ? 9 : 8} className="text-center py-4">
                  Učitavanje...
                </TableCell>
              </TableRow>
            ) : (
              <>
                {items.map((item) =>
                  editingId === item.id ? (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Select
                          value={editItem.input_cost_id || "none"}
                          onValueChange={(v) => v !== "none" && handleInputCostSelect(v, false)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Izaberi" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">--</SelectItem>
                            {activeInputCosts.map((ic) => (
                              <SelectItem key={ic.id} value={ic.id}>
                                {ic.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inputCosts.find((ic) => ic.id === editItem.input_cost_id)?.account_code || "-"}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editItem.item_name}
                          onChange={(e) => setEditItem({ ...editItem, item_name: e.target.value })}
                          className="h-8 text-xs"
                          autoComplete="off"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={editItem.org_unit_id || "none"}
                          onValueChange={(v) =>
                            setEditItem({ ...editItem, org_unit_id: v === "none" ? null : v })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="OJ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Bez OJ --</SelectItem>
                            {activeOrgUnits.map((ou) => (
                              <SelectItem key={ou.id} value={ou.id}>
                                {ou.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {renderNumericInputs(editItem, setEditItem)}
                      <TableCell className="text-center">
                        <Checkbox
                          checked={editItem.is_vat_deductible}
                          onCheckedChange={(c) =>
                            setEditItem({ ...editItem, is_vat_deductible: c as boolean })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-nowrap">
                          <Button
                            size="sm"
                            type="button"
                            onClick={handleEditSubmit}
                            disabled={!editItem.item_name || updateItem.isPending}
                            className="h-7 px-2 text-xs"
                          >
                            Zapamti
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            type="button"
                            className="h-7 w-7"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow
                      key={item.id}
                      className={isEditable ? "cursor-pointer hover:bg-muted/50" : ""}
                      onClick={() => isEditable && handleEditStart(item)}
                    >
                      <TableCell>
                        <div>
                          <div>{item.item_code || "-"}</div>
                          <div className="text-xs text-muted-foreground">{inputCosts.find((ic) => ic.id === item.input_cost_id)?.name || ""}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {(() => {
                          const ic = inputCosts.find((ic) => ic.id === item.input_cost_id);
                          return ic ? (
                            <div>
                              <div>{ic.account_code}</div>
                              <div className="text-[10px]">{/* account name shown via item_name */}</div>
                            </div>
                          ) : "-";
                        })()}
                      </TableCell>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell>{item.org_unit?.code || "-"}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                      {isForeign && (
                        <TableCell className="text-right">
                          {formatNumber(item.foreign_unit_price ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      )}
                      <TableCell className="text-right">{formatPrice(item.unit_price)}</TableCell>
                      <TableCell className="text-right">{item.vat_rate}%</TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={item.is_vat_deductible} disabled />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(item.line_total)}
                      </TableCell>
                      {isEditable && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                )}

                {/* Add new row */}
                {isAdding && (
                  <TableRow>
                    <TableCell>
                      <Select
                        value={newItem.input_cost_id || "none"}
                        onValueChange={(v) => v !== "none" && handleInputCostSelect(v, true)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Izaberi trošak" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">--</SelectItem>
                          {activeInputCosts.map((ic) => (
                            <SelectItem key={ic.id} value={ic.id}>
                              {ic.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inputCosts.find((ic) => ic.id === newItem.input_cost_id)?.account_code || "-"}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={newItem.item_name}
                        onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                        className="h-8 text-xs"
                        placeholder="Naziv stavke"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={newItem.org_unit_id || "none"}
                        onValueChange={(v) =>
                          setNewItem({ ...newItem, org_unit_id: v === "none" ? null : v })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="OJ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Bez OJ --</SelectItem>
                          {activeOrgUnits.map((ou) => (
                            <SelectItem key={ou.id} value={ou.id}>
                              {ou.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {renderNumericInputs(newItem, setNewItem)}
                    <TableCell className="text-center">
                      <Checkbox
                        checked={newItem.is_vat_deductible}
                        onCheckedChange={(c) =>
                          setNewItem({ ...newItem, is_vat_deductible: c as boolean })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {formatPrice(calculateLineTotal(newItem).total)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-nowrap">
                        <Button
                          size="sm"
                          type="button"
                          onClick={handleAddSubmit}
                          disabled={!newItem.item_name || addItem.isPending}
                          className="h-7 px-2 text-xs"
                        >
                          Zapamti
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          type="button"
                          className="h-7 w-7"
                          onClick={() => {
                            setIsAdding(false);
                            setNewItem(emptyFormState);
                          }}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {items.length === 0 && !isAdding && (
                  <TableRow>
                    <TableCell colSpan={isEditable ? 9 : 8} className="text-center py-4 text-muted-foreground">
                      Nema stavki. {isEditable && "Kliknite 'Dodaj stavku' za dodavanje."}
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
