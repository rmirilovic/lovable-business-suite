import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, ArrowLeft, RefreshCw, Save } from "lucide-react";
import {
  CustomsClearance,
  CustomsClearanceItem,
  CustomsClearanceCost,
  useCustomsClearances,
} from "@/hooks/useCustomsClearances";
import { CustomsClearanceItemsEditor } from "@/components/nabavka/CustomsClearanceItemsEditor";
import { CustomsClearanceCostsEditor } from "@/components/nabavka/CustomsClearanceCostsEditor";
import { CustomsClearanceHeaderDialog } from "@/components/nabavka/CustomsClearanceHeaderDialog";
import { formatDate, formatNumber, formatPrice } from "@/lib/formatting";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { parseLocaleNumber } from "@/lib/formatting";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjiženo",
};
const statusVariants: Record<string, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  posted: "default",
};

export default function CustomsClearanceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();

  const {
    fetchItems,
    saveItems,
    fetchCosts,
    saveCosts,
    saveTotals,
    fetchSourceInvoiceItems,
    fetchClearedQuantities,
    updateClearance,
  } = useCustomsClearances();

  const [clearance, setClearance] = useState<CustomsClearance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<CustomsClearanceItem[]>([]);
  const [costs, setCosts] = useState<CustomsClearanceCost[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [costsLoading, setCostsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Editable header fields
  const [customsDutyAmount, setCustomsDutyAmount] = useState("0,00");
  const [exciseAmount, setExciseAmount] = useState("0,00");
  const [vatRate, setVatRate] = useState("20");

  // Account codes
  const [customsDutyAccount, setCustomsDutyAccount] = useState("");
  const [exciseAccount, setExciseAccount] = useState("");
  const [vatAccount, setVatAccount] = useState("2700");
  const [customsObligationAccount, setCustomsObligationAccount] = useState("");
  const [sourceWarehouseAccount, setSourceWarehouseAccount] = useState("");
  const [destinationWarehouseAccount, setDestinationWarehouseAccount] = useState("");

  const isEditable = clearance?.status === "draft";

  // Fetch clearance header
  const fetchClearance = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from("customs_clearances")
      .select(`
        *,
        source_invoice:goods_purchase_invoices(id, internal_number, supplier_invoice_number, partner_id, supplier_name),
        source_warehouse:warehouses!customs_clearances_source_warehouse_id_fkey(id, code, name),
        destination_warehouse:warehouses!customs_clearances_destination_warehouse_id_fkey(id, code, name)
      `)
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Greška pri učitavanju dokumenta");
      navigate("/nabavka/carinski-obracun");
      return;
    }

    setClearance(data as CustomsClearance);
    setCustomsDutyAmount(formatPrice(data.customs_duty_amount) || "0,00");
    setExciseAmount(formatPrice(data.excise_amount) || "0,00");
    setVatRate(String(data.vat_rate ?? 20));
    setCustomsDutyAccount(data.customs_duty_account || "");
    setExciseAccount(data.excise_account || "");
    setVatAccount(data.vat_account || "2700");
    setCustomsObligationAccount(data.customs_obligation_account || "");
    setSourceWarehouseAccount(data.source_warehouse_account || "");
    setDestinationWarehouseAccount(data.destination_warehouse_account || "");
    setIsLoading(false);
  }, [id]);

  // Fetch items and costs
  const loadItemsAndCosts = useCallback(async () => {
    if (!id) return;
    setItemsLoading(true);
    setCostsLoading(true);
    try {
      const [fetchedItems, fetchedCosts] = await Promise.all([
        fetchItems(id),
        fetchCosts(id),
      ]);
      setItems(fetchedItems);
      setCosts(fetchedCosts);
    } catch (e) {
      toast.error("Greška pri učitavanju stavki");
    }
    setItemsLoading(false);
    setCostsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchClearance();
    loadItemsAndCosts();
  }, [id]);

  // Import items from source invoice
  const handleImportItems = useCallback(async () => {
    if (!clearance) return;
    try {
      const sourceItems = await fetchSourceInvoiceItems(clearance.source_invoice_id);
      const clearedMap = await fetchClearedQuantities(clearance.source_invoice_id, clearance.id);

      const newItems: Omit<CustomsClearanceItem, "id" | "created_at">[] = sourceItems
        .map((si: any, idx: number) => {
          const clearedQty = clearedMap.get(si.id) || 0;
          const availableQty = si.quantity - clearedQty;
          if (availableQty <= 0) return null;

          const invoicePrice = si.unit_price || 0;
          const exchangeRate = clearance.exchange_rate || 1;
          const invoicePriceRsd = invoicePrice * exchangeRate;
          const invoiceValueRsd = availableQty * invoicePriceRsd;

          return {
            customs_clearance_id: clearance.id,
            company_id: clearance.company_id,
            article_id: si.article_id || null,
            item_code: si.article?.code || si.item_code || null,
            item_name: si.article?.name || si.item_name || "",
            unit: si.article?.unit || si.unit || "kom",
            source_item_id: si.id,
            available_quantity: si.quantity - clearedQty,
            quantity: availableQty,
            invoice_price: invoicePrice,
            invoice_price_rsd: invoicePriceRsd,
            invoice_value_rsd: invoiceValueRsd,
            allocated_costs: 0,
            allocated_customs_duty: 0,
            allocated_excise: 0,
            customs_base: 0,
            vat_base: 0,
            vat_amount: 0,
            cost_price: 0,
            cost_value: 0,
            item_order: idx + 1,
          } as Omit<CustomsClearanceItem, "id" | "created_at">;
        })
        .filter(Boolean) as Omit<CustomsClearanceItem, "id" | "created_at">[];

      if (newItems.length === 0) {
        toast.info("Sve stavke iz izvorne fakture su već carinjene");
        return;
      }

      await saveItems(clearance.id, newItems);
      const refreshed = await fetchItems(clearance.id);
      setItems(refreshed);
      toast.success(`Preuzeto ${newItems.length} stavki`);
    } catch (e) {
      toast.error("Greška pri preuzimanju stavki");
    }
  }, [clearance]);

  // Recalculate distribution whenever items, costs, duty, excise, or vatRate change
  const recalculatedItems = useMemo(() => {
    if (items.length === 0) return items;

    const dutyTotal = parseLocaleNumber(customsDutyAmount);
    const exciseTotal = parseLocaleNumber(exciseAmount);
    const vat = parseFloat(vatRate) || 0;
    const costsTotal = costs.reduce((s, c) => s + c.amount, 0);

    // Total invoice value for proportional distribution
    const totalInvoiceValue = items.reduce((s, i) => s + i.invoice_value_rsd, 0);

    return items.map((item) => {
      const ratio = totalInvoiceValue > 0 ? item.invoice_value_rsd / totalInvoiceValue : 0;

      const allocatedCosts = costsTotal * ratio;
      const allocatedDuty = dutyTotal * ratio;
      const allocatedExcise = exciseTotal * ratio;

      const customsBase = item.invoice_value_rsd + allocatedCosts;
      const vatBase = customsBase + allocatedDuty + allocatedExcise;
      const vatAmount = vatBase * (vat / 100);

      // Cost price = everything except VAT, per unit
      const costValue = item.invoice_value_rsd + allocatedCosts + allocatedDuty + allocatedExcise;
      const costPrice = item.quantity > 0 ? costValue / item.quantity : 0;

      return {
        ...item,
        allocated_costs: Math.round(allocatedCosts * 100) / 100,
        allocated_customs_duty: Math.round(allocatedDuty * 100) / 100,
        allocated_excise: Math.round(allocatedExcise * 100) / 100,
        customs_base: Math.round(customsBase * 100) / 100,
        vat_base: Math.round(vatBase * 100) / 100,
        vat_amount: Math.round(vatAmount * 100) / 100,
        cost_price: Math.round(costPrice * 100) / 100,
        cost_value: Math.round(costValue * 100) / 100,
      };
    });
  }, [items, costs, customsDutyAmount, exciseAmount, vatRate]);

  // Totals
  const totals = useMemo(() => {
    const invoiceValueRsd = recalculatedItems.reduce((s, i) => s + i.invoice_value_rsd, 0);
    const additionalCostsTotal = costs.reduce((s, c) => s + c.amount, 0);
    const customsBase = recalculatedItems.reduce((s, i) => s + i.customs_base, 0);
    const vatBase = recalculatedItems.reduce((s, i) => s + i.vat_base, 0);
    const vatAmount = recalculatedItems.reduce((s, i) => s + i.vat_amount, 0);
    const totalCostValue = recalculatedItems.reduce((s, i) => s + i.cost_value, 0);

    return { invoiceValueRsd, additionalCostsTotal, customsBase, vatBase, vatAmount, totalCostValue };
  }, [recalculatedItems, costs]);

  // Save everything
  const handleSave = async () => {
    if (!clearance || !id) return;
    setIsSaving(true);
    try {
      // Save header fields
      await updateClearance({
        id: clearance.id,
        clearance_date: clearance.clearance_date,
        source_invoice_id: clearance.source_invoice_id,
        jci_number: clearance.jci_number,
        jci_date: clearance.jci_date,
        customs_office_code: clearance.customs_office_code,
        source_warehouse_id: clearance.source_warehouse_id,
        destination_warehouse_id: clearance.destination_warehouse_id,
        exchange_rate: clearance.exchange_rate,
        currency: clearance.currency,
        customs_duty_amount: parseLocaleNumber(customsDutyAmount),
        excise_amount: parseLocaleNumber(exciseAmount),
        vat_rate: parseFloat(vatRate) || 20,
        customs_duty_account: customsDutyAccount || null,
        excise_account: exciseAccount || null,
        vat_account: vatAccount || null,
        customs_obligation_account: customsObligationAccount || null,
        source_warehouse_account: sourceWarehouseAccount || null,
        destination_warehouse_account: destinationWarehouseAccount || null,
        note: clearance.note,
      });

      // Save items with recalculated values
      const itemsToSave = recalculatedItems.map(({ id: _id, created_at, ...rest }) => rest);
      await saveItems(clearance.id, itemsToSave as any);

      // Save costs
      const costsToSave = costs.map(({ id: _id, created_at, partner, ...rest }) => rest);
      await saveCosts(clearance.id, costsToSave as any);

      // Save totals
      await saveTotals(clearance.id, {
        invoice_value_rsd: totals.invoiceValueRsd,
        additional_costs_total: totals.additionalCostsTotal,
        customs_base: totals.customsBase,
        vat_base: totals.vatBase,
        vat_amount: totals.vatAmount,
        total_cost_value: totals.totalCostValue,
      });

      toast.success("Carinski obračun sačuvan");
      // Refresh
      await fetchClearance();
      await loadItemsAndCosts();
    } catch (e) {
      toast.error("Greška pri čuvanju");
    }
    setIsSaving(false);
  };

  // Update item quantity
  const handleUpdateItemQuantity = (itemId: string, newQty: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const qty = Math.min(Math.max(0, newQty), item.available_quantity);
        return {
          ...item,
          quantity: qty,
          invoice_value_rsd: qty * item.invoice_price_rsd,
        };
      })
    );
  };

  // Remove item
  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  // Add cost
  const handleAddCost = (cost: Omit<CustomsClearanceCost, "id" | "created_at" | "partner">) => {
    const tempId = crypto.randomUUID();
    setCosts((prev) => [
      ...prev,
      { ...cost, id: tempId, created_at: new Date().toISOString(), partner: null },
    ]);
  };

  // Remove cost
  const handleRemoveCost = (costId: string) => {
    setCosts((prev) => prev.filter((c) => c.id !== costId));
  };

  if (isLoading) {
    return (
      <MainLayout title="Carinski obračun">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!clearance) return null;

  return (
    <MainLayout title={`Carinski obračun ${clearance.clearance_number}`}>
      <div className="flex-1 min-h-0 overflow-auto space-y-6 pb-6">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link to="/nabavka/carinski-obracun">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-lg sm:text-2xl font-bold truncate">CO {clearance.clearance_number}</h1>
            <Badge variant={statusVariants[clearance.status] || "secondary"} className="shrink-0">
              {statusLabels[clearance.status] || clearance.status}
            </Badge>
          </div>
          <div className="flex gap-2">
            {isEditable && (
              <>
                <Button variant="outline" onClick={() => { fetchClearance(); loadItemsAndCosts(); }}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Osveži
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Sačuvaj
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Header info */}
        <div className="border rounded-lg p-4 bg-card">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Datum:</span>{" "}
              <span className="font-medium">{formatDate(clearance.clearance_date)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Izvorna UFR:</span>{" "}
              <span className="font-medium">{clearance.source_invoice?.internal_number || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Dobavljač:</span>{" "}
              <span className="font-medium">{clearance.source_invoice?.supplier_name || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Valuta / Kurs:</span>{" "}
              <span className="font-medium">{clearance.currency} / {formatNumber(clearance.exchange_rate)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">JCI broj:</span>{" "}
              <span className="font-medium">{clearance.jci_number || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">JCI datum:</span>{" "}
              <span className="font-medium">{clearance.jci_date ? formatDate(clearance.jci_date) : "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Izvorni mag.:</span>{" "}
              <span className="font-medium">{clearance.source_warehouse?.code} - {clearance.source_warehouse?.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Odredišni mag.:</span>{" "}
              <span className="font-medium">{clearance.destination_warehouse?.code} - {clearance.destination_warehouse?.name}</span>
            </div>
          </div>
        </div>

        {/* Duty, Excise, VAT inputs */}
        <div className="border rounded-lg p-4 bg-card space-y-4">
          <h3 className="text-sm font-semibold">Carinske dažbine i PDV</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Iznos carine (RSD)</Label>
              <LocaleNumberInput
                value={customsDutyAmount}
                onChange={setCustomsDutyAmount}
                disabled={!isEditable}
                decimalPlaces={2}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Iznos akcize (RSD)</Label>
              <LocaleNumberInput
                value={exciseAmount}
                onChange={setExciseAmount}
                disabled={!isEditable}
                decimalPlaces={2}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Stopa PDV (%)</Label>
              <Input
                type="number"
                step="1"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                disabled={!isEditable}
              />
            </div>
          </div>
        </div>

        {/* Account codes */}
        <div className="border rounded-lg p-4 bg-card space-y-4">
          <h3 className="text-sm font-semibold">Konta za knjiženje</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Carina</Label>
              <Input value={customsDutyAccount} onChange={(e) => setCustomsDutyAccount(e.target.value)} disabled={!isEditable} placeholder="npr. 1329" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Akciza</Label>
              <Input value={exciseAccount} onChange={(e) => setExciseAccount(e.target.value)} disabled={!isEditable} placeholder="npr. 1329" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">PDV</Label>
              <Input value={vatAccount} onChange={(e) => setVatAccount(e.target.value)} disabled={!isEditable} placeholder="npr. 2700" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Obaveza prema carini</Label>
              <Input value={customsObligationAccount} onChange={(e) => setCustomsObligationAccount(e.target.value)} disabled={!isEditable} placeholder="npr. 4390" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Izvorni magacin</Label>
              <Input value={sourceWarehouseAccount} onChange={(e) => setSourceWarehouseAccount(e.target.value)} disabled={!isEditable} placeholder="npr. 1310" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Odredišni magacin</Label>
              <Input value={destinationWarehouseAccount} onChange={(e) => setDestinationWarehouseAccount(e.target.value)} disabled={!isEditable} placeholder="npr. 1320" />
            </div>
          </div>
        </div>

        <Separator />

        {/* Items */}
        <CustomsClearanceItemsEditor
          items={recalculatedItems}
          isLoading={itemsLoading}
          isEditable={isEditable}
          onImport={handleImportItems}
          onUpdateQuantity={handleUpdateItemQuantity}
          onRemoveItem={handleRemoveItem}
        />

        <Separator />

        {/* Costs */}
        <CustomsClearanceCostsEditor
          costs={costs}
          isLoading={costsLoading}
          isEditable={isEditable}
          clearanceId={clearance.id}
          companyId={clearance.company_id}
          onAdd={handleAddCost}
          onRemove={handleRemoveCost}
        />

        <Separator />

        {/* Summary */}
        <div className="border rounded-lg p-4 bg-card">
          <h3 className="text-sm font-semibold mb-3">Rekapitulacija</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-8 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fakturna vrednost (RSD):</span>
              <span className="font-medium">{formatPrice(totals.invoiceValueRsd)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Zavisni troškovi:</span>
              <span className="font-medium">{formatPrice(totals.additionalCostsTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Carinska osnovica:</span>
              <span className="font-medium">{formatPrice(totals.customsBase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Carina:</span>
              <span className="font-medium">{formatPrice(parseLocaleNumber(customsDutyAmount))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Akciza:</span>
              <span className="font-medium">{formatPrice(parseLocaleNumber(exciseAmount))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Osnovica za PDV:</span>
              <span className="font-medium">{formatPrice(totals.vatBase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PDV ({vatRate}%):</span>
              <span className="font-medium">{formatPrice(totals.vatAmount)}</span>
            </div>
            <div className="flex justify-between sm:col-span-2 md:col-span-3 border-t pt-2 mt-1">
              <span className="font-semibold">Nabavna vrednost:</span>
              <span className="font-bold text-primary">{formatPrice(totals.totalCostValue)}</span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
