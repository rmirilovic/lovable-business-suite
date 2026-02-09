import { useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import {
  useCalculationDetail,
  useCalculationCosts,
  useCalculationItems,
  distributeAdditionalCosts,
} from "@/hooks/usePurchasePriceCalculations";
import { CalculationCostsEditor } from "@/components/magacin/CalculationCostsEditor";
import { CalculationItemsTable } from "@/components/magacin/CalculationItemsTable";
import { formatDecimal } from "@/lib/formatting";
import { toast } from "sonner";

export default function CalculationEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { calculation, isLoading: calcLoading } = useCalculationDetail(id);
  const { costs, isLoading: costsLoading, addCost, updateCost, deleteCost } = useCalculationCosts(id ?? null);
  const { items, isLoading: itemsLoading, updateItem, batchUpdateItems, updateCalculationTotals } = useCalculationItems(id ?? null);

  const isEditable = calculation?.status === "draft";

  // Recalculate cost distribution and update items + totals
  const recalculate = useCallback(async () => {
    if (!items.length) return;

    const updates = distributeAdditionalCosts(items, costs);

    try {
      await batchUpdateItems.mutateAsync(updates);

      // Calculate and save totals
      const updatedItems = items.map((item) => {
        const update = updates.find((u) => u.id === item.id);
        return update ? { ...item, ...update } : item;
      });

      const totalPurchaseValue = updatedItems.reduce((s, i) => s + i.purchase_value, 0);
      const totalAdditionalCosts = costs.reduce((s, c) => s + c.amount, 0);
      const totalCostValue = updatedItems.reduce((s, i) => s + (i.cost_value ?? 0), 0);
      const totalMarkupValue = updatedItems.reduce((s, i) => s + ((i.markup_amount ?? 0) * i.quantity), 0);
      const totalSellingValue = updatedItems.reduce((s, i) => s + (i.selling_value ?? 0), 0);

      await updateCalculationTotals.mutateAsync({
        total_purchase_value: Math.round(totalPurchaseValue * 100) / 100,
        total_additional_costs: Math.round(totalAdditionalCosts * 100) / 100,
        total_cost_value: Math.round(totalCostValue * 100) / 100,
        total_markup_value: Math.round(totalMarkupValue * 100) / 100,
        total_selling_value: Math.round(totalSellingValue * 100) / 100,
      });

      toast.success("Kalkulacija preračunata");
    } catch (err: any) {
      toast.error(`Greška pri preračunavanju: ${err.message}`);
    }
  }, [items, costs, batchUpdateItems, updateCalculationTotals]);

  // Handle adding a cost and then recalculate
  const handleAddCost = async (cost: { description: string; amount: number; distribution_method: "by_value" | "by_quantity" }) => {
    await addCost.mutateAsync(cost);
  };

  const handleUpdateCost = async (costId: string, data: any) => {
    await updateCost.mutateAsync({ id: costId, ...data });
  };

  const handleDeleteCost = async (costId: string) => {
    await deleteCost.mutateAsync(costId);
  };

  // Handle markup changes for items
  const handleUpdateMarkup = async (itemId: string, markupPercent: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const costPrice = item.cost_price;
    const markupAmount = Math.round(costPrice * markupPercent) / 100;
    const sellingPrice = Math.round((costPrice + markupAmount) * 100) / 100;
    const sellingValue = Math.round(sellingPrice * item.quantity * 100) / 100;

    await updateItem.mutateAsync({
      id: itemId,
      markup_percent: markupPercent,
      markup_amount: Math.round(markupAmount * 100) / 100,
      selling_price: sellingPrice,
      selling_value: sellingValue,
    });
  };

  const handleUpdateSellingPrice = async (itemId: string, sellingPrice: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const costPrice = item.cost_price;
    const markupAmount = Math.round((sellingPrice - costPrice) * 100) / 100;
    const markupPercent = costPrice > 0 ? Math.round((markupAmount / costPrice) * 10000) / 100 : 0;
    const sellingValue = Math.round(sellingPrice * item.quantity * 100) / 100;

    await updateItem.mutateAsync({
      id: itemId,
      markup_percent: markupPercent,
      markup_amount: markupAmount,
      selling_price: sellingPrice,
      selling_value: sellingValue,
    });
  };

  if (calcLoading) {
    return (
      <MainLayout title="Kalkulacija">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!calculation) {
    return (
      <MainLayout title="Kalkulacija">
        <div className="text-center py-16">
          <p className="text-muted-foreground">Kalkulacija nije pronađena.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/magacin/kalkulacije")}>
            Nazad na listu
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={`Kalkulacija ${calculation.calculation_number}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/magacin/kalkulacije")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{calculation.calculation_number}</h2>
                {calculation.status === "posted" ? (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">Proknjiženo</Badge>
                ) : (
                  <Badge variant="outline">Nacrt</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Prijemnica: {(calculation.goods_receipt as any)?.receipt_number || "—"} | 
                Datum: {format(new Date(calculation.calculation_date), "dd.MM.yyyy", { locale: sr })}
                {(calculation.goods_receipt as any)?.partner && (
                  <> | Dobavljač: {(calculation.goods_receipt as any).partner.name}</>
                )}
                {(calculation.goods_receipt as any)?.warehouse && (
                  <> | Magacin: {(calculation.goods_receipt as any).warehouse.code} - {(calculation.goods_receipt as any).warehouse.name}</>
                )}
              </p>
            </div>
          </div>
          {isEditable && (
            <Button onClick={recalculate} disabled={batchUpdateItems.isPending}>
              {batchUpdateItems.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Preračunaj
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Nabavna vrednost</p>
            <p className="text-lg font-semibold">{formatDecimal(calculation.total_purchase_value, 2)}</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Zavisni troškovi</p>
            <p className="text-lg font-semibold">{formatDecimal(calculation.total_additional_costs, 2)}</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Vrednost koštanja</p>
            <p className="text-lg font-semibold">{formatDecimal(calculation.total_cost_value, 2)}</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Razlika u ceni</p>
            <p className="text-lg font-semibold">{formatDecimal(calculation.total_markup_value, 2)}</p>
          </div>
          <div className="border rounded-lg p-3 bg-primary/5">
            <p className="text-xs text-muted-foreground">Prodajna vrednost</p>
            <p className="text-lg font-semibold">{formatDecimal(calculation.total_selling_value, 2)}</p>
          </div>
        </div>

        <Separator />

        {/* Additional Costs */}
        <CalculationCostsEditor
          costs={costs}
          isLoading={costsLoading}
          isEditable={isEditable}
          onAdd={handleAddCost}
          onUpdate={handleUpdateCost}
          onDelete={handleDeleteCost}
        />

        <Separator />

        {/* Items Table */}
        <CalculationItemsTable
          items={items}
          isLoading={itemsLoading}
          isEditable={isEditable}
          onUpdateMarkup={handleUpdateMarkup}
          onUpdateSellingPrice={handleUpdateSellingPrice}
        />
      </div>
    </MainLayout>
  );
}
