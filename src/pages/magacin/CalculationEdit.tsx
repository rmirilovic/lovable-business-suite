import { useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, RefreshCw, Loader2, CheckCircle, Undo2, Link, Unlink, FileText, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import {
  useCalculationDetail,
  useCalculationCosts,
  useCalculationItems,
  usePurchasePriceCalculations,
  useCalculationUfrLink,
  useCalculationUfuLinks,
  distributeAdditionalCosts,
} from "@/hooks/usePurchasePriceCalculations";
import { usePartners } from "@/hooks/usePartners";
import { useAuth } from "@/contexts/AuthContext";
import { CalculationCostsEditor } from "@/components/magacin/CalculationCostsEditor";
import { CalculationItemsTable } from "@/components/magacin/CalculationItemsTable";
import { formatDecimal } from "@/lib/formatting";
import { toast } from "sonner";

export default function CalculationEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();

  const { calculation, isLoading: calcLoading } = useCalculationDetail(id);
  const { costs, isLoading: costsLoading, addCost, updateCost, deleteCost } = useCalculationCosts(id ?? null);
  const { items, isLoading: itemsLoading, updateItem, batchUpdateItems, updateCalculationTotals } = useCalculationItems(id ?? null);
  const { postCalculation, unpostCalculation, deleteCalculation } = usePurchasePriceCalculations();
  const { partners } = usePartners();
  const { availableUfr, linkUfr, unlinkUfr } = useCalculationUfrLink(id ?? null);
  const { linkedUfu, availableUfu, linkUfu, unlinkUfu } = useCalculationUfuLinks(id ?? null);

  const isEditable = calculation?.status === "draft";

  const handlePost = async () => {
    if (!id) return;
    await postCalculation.mutateAsync(id);
  };

  const handleUnpost = async () => {
    if (!id) return;
    await unpostCalculation.mutateAsync(id);
  };

  // Recalculate cost distribution and update items + totals
  const recalculate = useCallback(async () => {
    if (!items.length) return;

    const updates = distributeAdditionalCosts(items, costs);

    try {
      await batchUpdateItems.mutateAsync(updates);

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

  const handleAddCost = async (cost: { description: string; amount: number; distribution_method: "by_value" | "by_quantity"; partner_id: string | null }) => {
    await addCost.mutateAsync(cost);
  };

  const handleUpdateCost = async (costId: string, data: any) => {
    await updateCost.mutateAsync({ id: costId, ...data });
  };

  const handleDeleteCost = async (costId: string) => {
    await deleteCost.mutateAsync(costId);
  };

  const handleUpdateMarkup = async (itemId: string, markupPercent: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const costPrice = item.cost_price;
    const markupAmount = Math.round(costPrice * markupPercent * 100) / 10000;
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

  const handleUpdateMarkupAmount = async (itemId: string, markupAmount: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const costPrice = item.cost_price;
    // Store percent with 6 decimal precision to avoid rounding drift on recalculate
    const markupPercent = costPrice > 0 ? Math.round((markupAmount / costPrice) * 100000000) / 1000000 : 0;
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
    // Store percent with 6 decimal precision to avoid rounding drift on recalculate
    const markupPercent = costPrice > 0 ? Math.round((markupAmount / costPrice) * 100000000) / 1000000 : 0;
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
                  <Badge variant="default">Proknjiženo</Badge>
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
          <div className="flex items-center gap-2">
            {isEditable && (
              <>
                <Button variant="outline" onClick={recalculate} disabled={batchUpdateItems.isPending}>
                  {batchUpdateItems.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Preračunaj
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={postCalculation.isPending || items.length === 0}>
                      {postCalculation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Proknjiži
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Proknjižiti kalkulaciju?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Knjiženje kalkulacije će:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Proknjižiti zavisne troškove nabavke u glavnu knjigu</li>
                          <li>Proknjižiti razliku u ceni robe (RUC) na konto 1329</li>
                          <li>Ažurirati prodajne cene artikala (SVK=1) u šifarniku</li>
                        </ul>
                        <span className="block mt-2">Nakon knjiženja dokument postaje zaključan.</span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Otkaži</AlertDialogCancel>
                      <AlertDialogAction onClick={handlePost}>Proknjiži</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {isEditable && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive" disabled={deleteCalculation.isPending}>
                    {deleteCalculation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Obriši
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Obrisati kalkulaciju?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Da li ste sigurni da želite da obrišete kalkulaciju <strong>{calculation.calculation_number}</strong>? Ova akcija se ne može poništiti.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Odustani</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        await deleteCalculation.mutateAsync(id!);
                        navigate("/magacin/kalkulacije");
                      }}
                    >
                      Obriši
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {calculation.status === "posted" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={unpostCalculation.isPending}>
                    {unpostCalculation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Undo2 className="h-4 w-4 mr-2" />
                    )}
                    Poništi knjiženje
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Poništiti knjiženje kalkulacije?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ova akcija će obrisati nalog za knjiženje iz glavne knjige i vratiti prodajne cene artikala na prethodno stanje.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Otkaži</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUnpost}>Poništi</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* UFR Link Section */}
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Ulazna faktura za robu (UFR)
          </h3>
          {calculation.source_goods_invoice_id ? (
            <div className="flex items-center justify-between bg-muted/30 rounded-md p-3">
              <div className="text-sm">
                <span className="font-medium">
                  UFR-{(calculation as any).source_goods_invoice?.internal_number || calculation.source_goods_invoice_id}
                </span>
                {(calculation as any).source_goods_invoice?.supplier_invoice_number && (
                  <span className="text-muted-foreground ml-2">
                    (Faktura dobavljača: {(calculation as any).source_goods_invoice.supplier_invoice_number})
                  </span>
                )}
              </div>
              {isEditable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unlinkUfr.mutateAsync(calculation.source_goods_invoice_id!)}
                  disabled={unlinkUfr.isPending}
                >
                  <Unlink className="h-4 w-4 mr-1" />
                  Odvezi
                </Button>
              )}
            </div>
          ) : isEditable ? (
            <div className="flex items-center gap-2">
              <Select onValueChange={(ufrId) => linkUfr.mutateAsync(ufrId)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Izaberite UFR (isti dobavljač i magacin)..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUfr.length === 0 ? (
                    <SelectItem value="none" disabled>Nema dostupnih UFR</SelectItem>
                  ) : (
                    availableUfr.map((ufr) => (
                      <SelectItem key={ufr.id} value={ufr.id}>
                        UFR-{ufr.internal_number} | Faktura: {ufr.supplier_invoice_number} | Neto: {formatDecimal(ufr.subtotal, 2)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {linkUfr.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nije povezana UFR.</p>
          )}
        </div>

        {/* UFU Links Section */}
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Ulazne fakture za troškove nabavke (UFU)
          </h3>
          
          {linkedUfu.length > 0 && (
            <div className="space-y-2">
              {linkedUfu.map((link) => (
                <div key={link.id} className="flex items-center justify-between bg-muted/30 rounded-md p-3">
                  <div className="text-sm">
                    <span className="font-medium">
                      UFU-{link.service_invoice?.internal_number}
                    </span>
                    {link.service_invoice?.supplier_invoice_number && (
                      <span className="text-muted-foreground ml-2">
                        (Faktura: {link.service_invoice.supplier_invoice_number})
                      </span>
                    )}
                    {link.service_invoice?.partner && (
                      <span className="text-muted-foreground ml-2">
                        | {link.service_invoice.partner.name}
                      </span>
                    )}
                    <span className="ml-2 font-medium">
                      {formatDecimal(link.service_invoice?.total_amount || 0, 2)}
                    </span>
                  </div>
                  {isEditable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unlinkUfu.mutateAsync(link.service_invoice_id)}
                      disabled={unlinkUfu.isPending}
                    >
                      <Unlink className="h-4 w-4 mr-1" />
                      Ukloni
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isEditable && (
            <div className="flex items-center gap-2">
              <Select onValueChange={(ufuId) => linkUfu.mutateAsync(ufuId)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Dodajte UFU sa zavisnim troškovima nabavke..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUfu.length === 0 ? (
                    <SelectItem value="none" disabled>Nema dostupnih UFU (proverite flag "Zavisni trošak nabavke" na kontnom planu)</SelectItem>
                  ) : (
                    availableUfu.map((ufu) => (
                      <SelectItem key={ufu.id} value={ufu.id}>
                        UFU-{ufu.internal_number} | {ufu.partner?.name || "—"} | {formatDecimal(ufu.total_amount, 2)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {linkUfu.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          )}

          {linkedUfu.length === 0 && !isEditable && (
            <p className="text-sm text-muted-foreground">Nema povezanih UFU troškova.</p>
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

        {/* Additional Costs (from UFU - read-only display) */}
        <CalculationCostsEditor
          costs={costs}
          partners={partners}
          isLoading={costsLoading}
          isEditable={false}
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
          onUpdateMarkupAmount={handleUpdateMarkupAmount}
          onUpdateSellingPrice={handleUpdateSellingPrice}
        />
      </div>
    </MainLayout>
  );
}
