import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Check, X, Trash2 } from "lucide-react";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { useInputCosts } from "@/hooks/useInputCosts";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useAuth } from "@/contexts/AuthContext";
import {
  ServicePurchaseInvoiceItem,
  ServicePurchaseInvoiceItemFormData,
} from "@/hooks/useServicePurchaseInvoices";
import { formatNumber } from "@/lib/formatting";
import { UseMutationResult } from "@tanstack/react-query";

interface ServicePurchaseInvoiceItemsEditorProps {
  invoiceId: string;
  items: ServicePurchaseInvoiceItem[];
  isLoading: boolean;
  isEditable: boolean;
  addItem: UseMutationResult<ServicePurchaseInvoiceItem, Error, ServicePurchaseInvoiceItemFormData & { service_purchase_invoice_id: string }>;
  updateItem: UseMutationResult<ServicePurchaseInvoiceItem, Error, ServicePurchaseInvoiceItemFormData & { id: string }>;
  deleteItem: UseMutationResult<void, Error, string>;
}

const emptyItem: ServicePurchaseInvoiceItemFormData = {
  input_cost_id: null,
  item_code: null,
  item_name: "",
  description: null,
  org_unit_id: null,
  quantity: 1,
  unit: "kom",
  unit_price: 0,
  discount_percent: 0,
  vat_rate: 20,
  is_vat_deductible: true,
};

export function ServicePurchaseInvoiceItemsEditor({
  invoiceId,
  items,
  isLoading,
  isEditable,
  addItem,
  updateItem,
  deleteItem,
}: ServicePurchaseInvoiceItemsEditorProps) {
  const { selectedCompany } = useAuth();
  const { data: inputCosts = [] } = useInputCosts();
  const { units: orgUnits } = useOrganizationalUnits(selectedCompany?.id);

  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<ServicePurchaseInvoiceItemFormData>(emptyItem);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<ServicePurchaseInvoiceItemFormData>(emptyItem);

  const activeInputCosts = inputCosts.filter((ic) => ic.is_active);
  const activeOrgUnits = orgUnits.filter((ou) => ou.is_active);

  const handleInputCostSelect = (costId: string, isNew: boolean) => {
    const cost = inputCosts.find((c) => c.id === costId);
    if (!cost) return;

    const itemData = {
      input_cost_id: cost.id,
      item_code: cost.code,
      item_name: cost.name,
      vat_rate: cost.vat_rate,
      is_vat_deductible: cost.is_vat_deductible,
    };

    if (isNew) {
      setNewItem((prev) => ({ ...prev, ...itemData }));
    } else {
      setEditItem((prev) => ({ ...prev, ...itemData }));
    }
  };

  const calculateLineTotal = (item: ServicePurchaseInvoiceItemFormData) => {
    const subtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
    const vat = subtotal * (item.vat_rate / 100);
    return { subtotal, vat, total: subtotal + vat };
  };

  const handleAddSubmit = async () => {
    if (!newItem.item_name) return;
    await addItem.mutateAsync({
      service_purchase_invoice_id: invoiceId,
      ...newItem,
    });
    setNewItem(emptyItem);
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
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent,
      vat_rate: item.vat_rate,
      is_vat_deductible: item.is_vat_deductible,
    });
  };

  const handleEditSubmit = async () => {
    if (!editingId || !editItem.item_name) return;
    await updateItem.mutateAsync({ id: editingId, ...editItem });
    setEditingId(null);
    setEditItem(emptyItem);
  };

  const handleDelete = async (id: string) => {
    await deleteItem.mutateAsync(id);
  };

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
              <TableHead className="w-[115px]">Trošak</TableHead>
              <TableHead className="min-w-[320px]">Naziv</TableHead>
              <TableHead className="w-[120px]">Mesto troška</TableHead>
              <TableHead className="w-[100px] text-right">Kol.</TableHead>
              <TableHead className="w-[120px] text-right">Cena</TableHead>
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
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={editItem.quantity}
                          onChange={(e) => setEditItem({ ...editItem, quantity: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs text-right"
                          autoComplete="off"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={editItem.unit_price}
                          onChange={(e) => setEditItem({ ...editItem, unit_price: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs text-right"
                          autoComplete="off"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={editItem.vat_rate}
                          onChange={(e) => setEditItem({ ...editItem, vat_rate: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs text-right"
                          autoComplete="off"
                        />
                      </TableCell>
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
                      <TableCell className="text-xs">{item.item_code || "-"}</TableCell>
                      <TableCell className="text-xs font-medium">{item.item_name}</TableCell>
                      <TableCell className="text-xs">{item.org_unit?.code || "-"}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(item.quantity)}</TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(item.unit_price)}</TableCell>
                      <TableCell className="text-xs text-right">{item.vat_rate}%</TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={item.is_vat_deductible} disabled />
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {formatNumber(item.line_total)}
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
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs text-right"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={newItem.unit_price}
                        onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs text-right"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={newItem.vat_rate}
                        onChange={(e) => setNewItem({ ...newItem, vat_rate: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs text-right"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={newItem.is_vat_deductible}
                        onCheckedChange={(c) =>
                          setNewItem({ ...newItem, is_vat_deductible: c as boolean })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {formatNumber(calculateLineTotal(newItem).total)}
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
                            setNewItem(emptyItem);
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
