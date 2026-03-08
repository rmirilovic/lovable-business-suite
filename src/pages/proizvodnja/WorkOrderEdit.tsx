import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { ArrowLeft, Plus, Trash2, Rocket, Lock, Save, FileDown, Printer, FileSpreadsheet, History, Download, Undo2, RefreshCw, MoreHorizontal, ClipboardList } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArticleWorkOrdersDialog } from "@/components/proizvodnja/ArticleWorkOrdersDialog";
import { DateActionDialog } from "@/components/shared/DateActionDialog";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import {
  useWorkOrder, useWorkOrderItems, useWorkOrderMaterials,
  useWorkOrders, WorkOrderItem, WorkOrderMaterial,
  STATUS_LABELS, STATUS_COLORS,
} from "@/hooks/useWorkOrders";
import { useArticles } from "@/hooks/useArticles";
import { useWarehouses } from "@/hooks/useWarehouses";
import {
  useMaterialNorms, useMaterialNormVariants, useMaterialNormItems,
} from "@/hooks/useMaterialNorms";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatNumber } from "@/lib/formatting";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useIssuedMaterials } from "@/hooks/useIssuedMaterials";
import { exportIssuedMaterialsPdf, printIssuedMaterials, exportIssuedMaterialsExcel } from "@/lib/issuedMaterialsPdfGenerator";
import { useWorkOrderRequisitions } from "@/hooks/useWorkOrderRequisitions";
import { useWorkOrderDeliveryNotes } from "@/hooks/useWorkOrderDeliveryNotes";
import {
  exportRequisitionsToExcel, exportRequisitionsToPdf, printRequisitions,
  exportDeliveryNotesToExcel, exportDeliveryNotesToPdf, printDeliveryNotes,
} from "@/lib/workOrderTabsExportUtils";
import { exportWOToExcel, exportWOToPdf, printWO } from "@/lib/workOrderDocExport";

export default function WorkOrderEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, user } = useAuth();
  const companyId = selectedCompany?.id;

  const { data: order, isLoading: orderLoading } = useWorkOrder(id);
  const { items, isLoading: itemsLoading, invalidate: invalidateItems } = useWorkOrderItems(id);
  const { materials, isLoading: materialsLoading, invalidate: invalidateMaterials } = useWorkOrderMaterials(id);
  const { data: issuedMaterials = [], isLoading: issuedLoading } = useIssuedMaterials(id);
  const { data: requisitions = [] } = useWorkOrderRequisitions(id);
  const { data: deliveryNotes = [], isLoading: deliveriesLoading } = useWorkOrderDeliveryNotes(id);
  const { updateOrder, launchOrder, closeOrder, reopenOrder, unlaunchOrder } = useWorkOrders();
  const { articles } = useArticles(companyId);
  const { warehouses } = useWarehouses(companyId);
  const { norms } = useMaterialNorms(companyId);

  const gpArticles = useMemo(() => articles.filter((a) => a.svk === "9" && a.is_active), [articles]);
  const gpWarehouses = useMemo(() => warehouses.filter((w) => w.warehouse_type === "9" && w.is_active), [warehouses]);
  const rmWarehouses = useMemo(() => warehouses.filter((w) => w.warehouse_type === "2" && w.is_active), [warehouses]);

  // Active tab persistence
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem("wo_edit_tab") || "materials");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [woDialogArticle, setWoDialogArticle] = useState<{ id: string; code: string; name: string } | null>(null);
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const isClosed = order?.status === "closed";

  // Header form state
  const [headerForm, setHeaderForm] = useState({
    order_date: "",
    deadline_date: "",
    warehouse_id: "",
    issued_by: "",
    production_note: "",
    plant_note: "",
  });
  const [headerDirty, setHeaderDirty] = useState(false);

  // Material warehouse
  const [materialWarehouseId, setMaterialWarehouseId] = useState("");

  // Item being added
  const [newArticleId, setNewArticleId] = useState("");

  useEffect(() => {
    if (order) {
      setHeaderForm({
        order_date: order.order_date,
        deadline_date: order.deadline_date || "",
        warehouse_id: order.warehouse_id,
        issued_by: order.issued_by,
        production_note: order.production_note || "",
        plant_note: order.plant_note || "",
      });
    }
  }, [order]);

  // Restore material warehouse from saved materials
  useEffect(() => {
    if (materials.length > 0 && !materialWarehouseId) {
      const savedWh = materials.find((m) => m.warehouse_id)?.warehouse_id;
      if (savedWh) setMaterialWarehouseId(savedWh);
    }
  }, [materials]);

  const isDraft = order?.status === "draft";
  const isLaunched = order?.status === "launched";

  const handleSaveHeader = async () => {
    if (!id) return;
    await updateOrder.mutateAsync({
      id,
      order_date: headerForm.order_date,
      deadline_date: headerForm.deadline_date || null,
      warehouse_id: headerForm.warehouse_id,
      issued_by: headerForm.issued_by,
      production_note: headerForm.production_note || null,
      plant_note: headerForm.plant_note || null,
    } as any);
    setHeaderDirty(false);
  };

  const updateHeaderField = (field: string, value: string) => {
    setHeaderForm((prev) => ({ ...prev, [field]: value }));
    setHeaderDirty(true);
  };

  // Add item
  const handleAddItem = async () => {
    if (!newArticleId || !id || !companyId) return;
    const article = gpArticles.find((a) => a.id === newArticleId);
    if (!article) return;

    // Find norm and approved variant for this article
    const norm = norms.find((n) => n.article_id === newArticleId);
    let variantId: string | null = null;
    let variantName: string | null = null;

    if (norm) {
      // Fetch approved variants for this norm
      const { data: variants } = await supabase
        .from("material_norm_variants")
        .select("id, variant_name, is_default")
        .eq("norm_id", norm.id)
        .eq("status", "approved")
        .order("is_default", { ascending: false });

      if (variants && variants.length > 0) {
        variantId = variants[0].id;
        variantName = variants[0].variant_name;
      }
    }

    const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.item_order)) + 1 : 1;

    const { error } = await supabase.from("work_order_items").insert({
      work_order_id: id,
      company_id: companyId,
      article_id: newArticleId,
      article_code: article.code,
      article_name: article.name,
      unit: article.unit,
      variant_id: variantId,
      variant_name: variantName,
      launched_qty: 0,
      kg_per_unit: article.kg_po_jm ?? 0,
      launched_kg: 0,
      launched_m: 0,
      launched_pcs: 0,
      unit_price: article.purchase_price ?? 0,
      launched_value: 0,
      item_order: nextOrder,
    });

    if (error) {
      toast.error("Greška pri dodavanju stavke");
      return;
    }
    setNewArticleId("");
    invalidateItems();
  };

  // Update item inline
  const handleUpdateItem = async (item: WorkOrderItem, field: string, value: number) => {
    const updates: any = { [field]: value };

    if (field === "launched_qty") {
      updates.launched_kg = value * (item.kg_per_unit || 0);
      updates.launched_pcs = value;
      updates.launched_value = value * item.unit_price;
    }
    if (field === "unit_price") {
      updates.launched_value = item.launched_qty * value;
    }

    const { error } = await supabase
      .from("work_order_items")
      .update(updates)
      .eq("id", item.id);

    if (error) toast.error("Greška pri ažuriranju stavke");
    invalidateItems();
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase.from("work_order_items").delete().eq("id", itemId);
    if (error) toast.error("Greška pri brisanju stavke");
    invalidateItems();
  };

  // Recalculate materials from norm items
  const handleRecalcMaterials = async () => {
    if (!id || !companyId) return;

    // Delete existing materials
    await supabase.from("work_order_materials").delete().eq("work_order_id", id);

    // For each work order item with a variant, fetch norm items and aggregate
    const materialMap: Record<string, {
      article_id: string; article_code: string; article_name: string;
      unit: string; norm_qty: number;
    }> = {};

    for (const woItem of items) {
      if (!woItem.variant_id || woItem.launched_qty <= 0) continue;

      const { data: normItems } = await supabase
        .from("material_norm_items")
        .select("*")
        .eq("variant_id", woItem.variant_id);

      if (!normItems) continue;

      for (const ni of normItems) {
        const key = ni.article_id;
        const qtyNeeded =
          ni.qty_per_kg * (woItem.launched_kg || 0) +
          ni.qty_per_m * (woItem.launched_m || 0) +
          ni.qty_per_pc * (woItem.launched_pcs || 0);

        if (!materialMap[key]) {
          materialMap[key] = {
            article_id: ni.article_id,
            article_code: ni.article_code,
            article_name: ni.article_name,
            unit: ni.unit,
            norm_qty: 0,
          };
        }
        materialMap[key].norm_qty += qtyNeeded;
      }
    }

    // Insert aggregated materials
    const matEntries = Object.values(materialMap);
    if (matEntries.length > 0) {
      const rows = matEntries.map((m, idx) => ({
        work_order_id: id,
        company_id: companyId,
        article_id: m.article_id,
        article_code: m.article_code,
        article_name: m.article_name,
        unit: m.unit,
        norm_qty: Math.round(m.norm_qty * 1000) / 1000,
        approved_qty: Math.round(m.norm_qty * 1000) / 1000,
        warehouse_id: materialWarehouseId || null,
        unit_price: 0,
        material_value: 0,
        item_order: idx + 1,
      }));
      const { error } = await supabase.from("work_order_materials").insert(rows);
      if (error) {
        toast.error("Greška pri kreiranju liste materijala");
        return;
      }
    }

    invalidateMaterials();
    toast.success("Lista materijala preračunata");
  };

  // Update material approved qty
  const handleUpdateMaterial = async (mat: WorkOrderMaterial, field: string, value: number) => {
    const updates: any = { [field]: value };
    if (field === "approved_qty") {
      updates.material_value = value * mat.unit_price;
    }
    if (field === "unit_price") {
      updates.material_value = mat.approved_qty * value;
    }
    const { error } = await supabase.from("work_order_materials").update(updates).eq("id", mat.id);
    if (error) toast.error("Greška");
    invalidateMaterials();
  };

  // Totals
  const totalKg = items.reduce((s, i) => s + (i.launched_kg || 0), 0);
  const totalValue = items.reduce((s, i) => s + (i.launched_value || 0), 0);
  const totalMaterialValue = materials.reduce((s, m) => s + (m.material_value || 0), 0);

  if (orderLoading) return <MainLayout title="Radni nalog"><p>Učitavanje...</p></MainLayout>;
  if (!order) return <MainLayout title="Radni nalog"><p>Nalog nije pronađen.</p></MainLayout>;

  return (
    <MainLayout title={`Radni nalog ${order.order_number}`}>
      <div className="flex flex-col gap-4 h-full min-h-0">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/proizvodnja/nalozi")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold">RN {order.order_number}</h2>
            <Badge className={cn("text-xs", STATUS_COLORS[order.status])}>
              {STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            {items.length > 0 && order && (
              <>
                <Button variant="outline" size="sm" onClick={() => exportWOToExcel({ companyName: selectedCompany?.name || "", order, items })}>
                  <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportWOToPdf({ companyName: selectedCompany?.name || "", order, items })}>
                  <FileDown className="w-4 h-4 mr-1" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => printWO({ companyName: selectedCompany?.name || "", order, items })}>
                  <Printer className="w-4 h-4 mr-1" /> Štampa
                </Button>
              </>
            )}
            {isDraft && headerDirty && (
              <Button onClick={handleSaveHeader} disabled={updateOrder.isPending}>
                <Save className="w-4 h-4 mr-2" /> Sačuvaj
              </Button>
            )}
            {isDraft && (
              <Button variant="outline" onClick={() => setShowLaunchDialog(true)}>
                <Rocket className="w-4 h-4 mr-2" /> Lansiraj
              </Button>
            )}
            {isLaunched && (
              <>
                <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => unlaunchOrder.mutate(order!.id)}>
                  <Undo2 className="w-4 h-4 mr-2" /> Vrati u Nacrt
                </Button>
                <Button variant="outline" onClick={() => setShowCloseDialog(true)}>
                  <Lock className="w-4 h-4 mr-2" /> Zaključi
                </Button>
              </>
            )}
            {isClosed && (
              <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => reopenOrder.mutate(order!.id)}>
                <Undo2 className="w-4 h-4 mr-2" /> Vrati u Lansiran
              </Button>
            )}
          </div>
        </div>

        {/* Header fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
          <div className="space-y-1">
            <Label className="text-xs">Datum RN</Label>
            <LocaleDateInput
              value={headerForm.order_date}
              onChange={(v) => updateHeaderField("order_date", v)}
              disabled={!isDraft}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rok završetka</Label>
            <LocaleDateInput
              value={headerForm.deadline_date}
              onChange={(v) => updateHeaderField("deadline_date", v)}
              disabled={!isDraft}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Magacin GP</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              value={headerForm.warehouse_id}
              onChange={(e) => updateHeaderField("warehouse_id", e.target.value)}
              disabled={!isDraft}
            >
              <option value="">--</option>
              {gpWarehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nalog izdao</Label>
            <Input
              value={headerForm.issued_by}
              onChange={(e) => updateHeaderField("issued_by", e.target.value)}
              disabled={!isDraft}
            />
          </div>
          {order.launched_at && (
            <div className="space-y-1">
              <Label className="text-xs">Datum lansiranja</Label>
              <Input value={format(new Date(order.launched_at), "dd.MM.yyyy")} disabled />
            </div>
          )}
          {order.closed_at && (
            <div className="space-y-1">
              <Label className="text-xs">Datum zaključenja</Label>
              <Input value={format(new Date(order.closed_at), "dd.MM.yyyy")} disabled />
            </div>
          )}
        </div>


        {/* Items table */}
        <div className="border rounded-lg flex flex-col">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold text-sm">Stavke - Gotovi proizvodi</h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Ukupno kg: <strong>{formatNumber(totalKg, { minimumFractionDigits: 2 })}</strong></span>
              <span>Ukupna vrednost: <strong>{formatNumber(totalValue, { minimumFractionDigits: 2 })}</strong></span>
            </div>
          </div>
          {isDraft && (
            <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
              <div className="flex-1 max-w-md">
                <SearchableArticleSelect
                  articles={gpArticles}
                  value={newArticleId}
                  onValueChange={(id) => setNewArticleId(id)}
                  placeholder="Izaberite gotov proizvod..."
                />
              </div>
              <Button size="sm" onClick={handleAddItem} disabled={!newArticleId}>
                <Plus className="w-4 h-4 mr-1" /> Dodaj
              </Button>
            </div>
          )}
          <TableScrollContainer className="max-h-[250px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">R.br.</TableHead>
                  <TableHead className="w-[80px]">Šifra</TableHead>
                  <TableHead>Naziv GP</TableHead>
                  <TableHead className="w-[50px]">JM</TableHead>
                  <TableHead>Varijanta</TableHead>
                  <TableHead className="w-[100px] text-right">Lans. kol.</TableHead>
                  <TableHead className="w-[80px] text-right">kg/JM</TableHead>
                  <TableHead className="w-[100px] text-right">Lans. kg</TableHead>
                  <TableHead className="w-[100px] text-right">Cena</TableHead>
                  <TableHead className="w-[120px] text-right">Vrednost</TableHead>
                  <TableHead className="w-[50px]" />
                  {isDraft && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isDraft ? 12 : 11} className="text-center py-6 text-muted-foreground">
                      Nema stavki. Dodajte gotove proizvode.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{item.article_code}</TableCell>
                      <TableCell>{item.article_name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.variant_name || "-"}</TableCell>
                      <TableCell className="text-right">
                        {isDraft ? (
                          <Input
                            type="number"
                            className="w-20 text-right h-8 text-sm ml-auto"
                            value={item.launched_qty || ""}
                            onChange={(e) => handleUpdateItem(item, "launched_qty", parseFloat(e.target.value) || 0)}
                          />
                        ) : (
                          formatNumber(item.launched_qty, { minimumFractionDigits: 0 })
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatNumber(item.kg_per_unit, { minimumFractionDigits: 3 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(item.launched_kg, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {isDraft ? (
                          <Input
                            type="number"
                            className="w-24 text-right h-8 text-sm ml-auto"
                            value={item.unit_price || ""}
                            onChange={(e) => handleUpdateItem(item, "unit_price", parseFloat(e.target.value) || 0)}
                          />
                        ) : (
                          formatNumber(item.unit_price, { minimumFractionDigits: 2 })
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatNumber(item.launched_value, { minimumFractionDigits: 2 })}
                      </TableCell>
                      {isDraft && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableScrollContainer>
        </div>

        {/* Bottom tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); sessionStorage.setItem("wo_edit_tab", v); }} className="border rounded-lg">
          <TabsList className="w-full justify-start border-b rounded-none bg-muted/30 h-auto p-0">
            <TabsTrigger value="materials" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Potreban materijal
            </TabsTrigger>
            <TabsTrigger value="issued" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Istrebovani materijal
            </TabsTrigger>
            <TabsTrigger value="requisitions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Pregled trebovanja
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Pregled predajnica
            </TabsTrigger>
            <TabsTrigger value="production_note" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Napomena - proizvodnja
            </TabsTrigger>
            <TabsTrigger value="plant_note" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Napomena - pogon
            </TabsTrigger>
          </TabsList>

          {/* Materials tab */}
          <TabsContent value="materials" className="p-0 m-0">
            <div className="flex items-center gap-3 p-3 border-b bg-muted/20">
              <Label className="text-xs whitespace-nowrap">Magacin materijala:</Label>
              <select
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={materialWarehouseId}
                onChange={(e) => setMaterialWarehouseId(e.target.value)}
              >
                <option value="">-- Izaberite --</option>
                {rmWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                ))}
              </select>
              {isDraft && (
                <Button size="sm" variant="outline" onClick={handleRecalcMaterials}>
                  Preračunaj iz normativa
                </Button>
              )}
              <span className="ml-auto text-sm text-muted-foreground">
                Zbir vrednosti: <strong>{formatNumber(totalMaterialValue, { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>
            <TableScrollContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Šifra</TableHead>
                    <TableHead>Naziv</TableHead>
                    <TableHead className="w-[50px]">JM</TableHead>
                    <TableHead className="w-[100px] text-right">Kol. normativ</TableHead>
                    <TableHead className="w-[100px] text-right">Kol. odobrena</TableHead>
                    <TableHead className="w-[100px] text-right">Kol. u mag.</TableHead>
                    <TableHead className="w-[100px] text-right">Cena</TableHead>
                    <TableHead className="w-[120px] text-right">Vrednost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                        Nema materijala. Kliknite "Preračunaj iz normativa".
                      </TableCell>
                    </TableRow>
                  ) : (
                    materials.map((mat) => (
                      <TableRow key={mat.id}>
                        <TableCell className="font-mono text-xs">{mat.article_code}</TableCell>
                        <TableCell>{mat.article_name}</TableCell>
                        <TableCell>{mat.unit}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(mat.norm_qty, { minimumFractionDigits: 3 })}
                        </TableCell>
                        <TableCell className="text-right">
                          {isDraft ? (
                            <Input
                              type="number"
                              className="w-24 text-right h-8 text-sm ml-auto"
                              value={mat.approved_qty || ""}
                              onChange={(e) => handleUpdateMaterial(mat, "approved_qty", parseFloat(e.target.value) || 0)}
                            />
                          ) : (
                            formatNumber(mat.approved_qty, { minimumFractionDigits: 3 })
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">-</TableCell>
                        <TableCell className="text-right">
                          {isDraft ? (
                            <Input
                              type="number"
                              className="w-24 text-right h-8 text-sm ml-auto"
                              value={mat.unit_price || ""}
                              onChange={(e) => handleUpdateMaterial(mat, "unit_price", parseFloat(e.target.value) || 0)}
                            />
                          ) : (
                            formatNumber(mat.unit_price, { minimumFractionDigits: 2 })
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatNumber(mat.material_value, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableScrollContainer>
          </TabsContent>

          {/* Issued materials tab */}
          <TabsContent value="issued" className="p-0 m-0">
            <div className="flex items-center justify-between p-3 border-b bg-muted/20">
              {issuedMaterials.length > 0 && order ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportIssuedMaterialsExcel(order, issuedMaterials)}>
                    <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportIssuedMaterialsPdf(order, issuedMaterials, selectedCompany?.name || "")}>
                    <FileDown className="w-4 h-4 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => printIssuedMaterials(order, issuedMaterials, selectedCompany?.name || "")}>
                    <Printer className="w-4 h-4 mr-1" /> Štampa
                  </Button>
                </div>
              ) : <div />}
              <span className="text-sm text-muted-foreground">
                Zbir vrednosti: <strong>{formatNumber(issuedMaterials.reduce((s, r) => s + r.total_value, 0), { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>
            <TableScrollContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Šifra</TableHead>
                    <TableHead>Naziv materijala</TableHead>
                    <TableHead className="w-[50px]">JM</TableHead>
                    <TableHead className="w-[120px] text-right">Prosečna cena</TableHead>
                    <TableHead className="w-[100px] text-right">Količina</TableHead>
                    <TableHead className="w-[120px] text-right">Vrednost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issuedMaterials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        Nema istrebovanog materijala po proknjiženim trebovanjima.
                      </TableCell>
                    </TableRow>
                  ) : (
                    issuedMaterials.map((row) => (
                      <TableRow key={row.article_code}>
                        <TableCell className="font-mono text-xs">{row.article_code}</TableCell>
                        <TableCell>{row.article_name}</TableCell>
                        <TableCell>{row.unit}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(row.avg_price, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(row.total_qty, { minimumFractionDigits: 3 })}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatNumber(row.total_value, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableScrollContainer>
          </TabsContent>

          {/* Requisitions tab */}
          <TabsContent value="requisitions" className="p-0 m-0">
            <div className="flex items-center justify-between p-3 border-b bg-muted/20">
              {requisitions.length > 0 && order ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportRequisitionsToExcel(requisitions, { companyName: selectedCompany?.name || "", orderNumber: order.order_number })}>
                    <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportRequisitionsToPdf(requisitions, { companyName: selectedCompany?.name || "", orderNumber: order.order_number })}>
                    <FileDown className="w-4 h-4 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => printRequisitions(requisitions, { companyName: selectedCompany?.name || "", orderNumber: order.order_number })}>
                    <Printer className="w-4 h-4 mr-1" /> Štampa
                  </Button>
                </div>
              ) : <div />}
              <span className="text-sm text-muted-foreground">
                Zbir vrednosti: <strong>{formatNumber(requisitions.reduce((s, r) => s + r.total_value, 0), { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>
            <TableScrollContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Datum</TableHead>
                    <TableHead className="w-[120px]">Broj trebovanja</TableHead>
                    <TableHead>Magacin</TableHead>
                    <TableHead className="w-[140px] text-right">Vrednost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requisitions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        Nema trebovanja za ovaj radni nalog.
                      </TableCell>
                    </TableRow>
                  ) : (
                    requisitions.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>{format(new Date(req.requisition_date), "dd.MM.yyyy")}</TableCell>
                        <TableCell className="font-mono text-xs">{req.requisition_number}</TableCell>
                        <TableCell>{req.warehouse_code} - {req.warehouse_name}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatNumber(req.total_value, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableScrollContainer>
          </TabsContent>

          {/* Deliveries tab */}
          <TabsContent value="deliveries" className="p-0 m-0">
            <div className="flex items-center justify-between p-3 border-b bg-muted/20">
              {deliveryNotes.length > 0 && order ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportDeliveryNotesToExcel(deliveryNotes, { companyName: selectedCompany?.name || "", orderNumber: order.order_number })}>
                    <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportDeliveryNotesToPdf(deliveryNotes, { companyName: selectedCompany?.name || "", orderNumber: order.order_number })}>
                    <FileDown className="w-4 h-4 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => printDeliveryNotes(deliveryNotes, { companyName: selectedCompany?.name || "", orderNumber: order.order_number })}>
                    <Printer className="w-4 h-4 mr-1" /> Štampa
                  </Button>
                </div>
              ) : <div />}
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Ukupno po JM: <strong>{formatNumber(deliveryNotes.reduce((s, d) => s + d.items.reduce((si, it) => si + it.qty_total, 0), 0), { minimumFractionDigits: 2 })}</strong></span>
                <span>Ukupno kg: <strong>{formatNumber(deliveryNotes.reduce((s, d) => s + d.items.reduce((si, it) => si + it.delivered_kg, 0), 0), { minimumFractionDigits: 2 })}</strong></span>
                <span>Vrednost: <strong>{formatNumber(deliveryNotes.reduce((s, d) => s + d.items.reduce((si, it) => si + it.item_value, 0), 0), { minimumFractionDigits: 2 })}</strong></span>
              </div>
            </div>
            <TableScrollContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Datum</TableHead>
                    <TableHead className="w-[100px]">Broj</TableHead>
                    <TableHead className="w-[80px]">Šifra</TableHead>
                    <TableHead className="w-[60px]">Linija</TableHead>
                    <TableHead className="w-[80px] text-right">I smena</TableHead>
                    <TableHead className="w-[80px] text-right">II smena</TableHead>
                    <TableHead className="w-[80px] text-right">III smena</TableHead>
                    <TableHead className="w-[100px] text-right">Predato JM</TableHead>
                    <TableHead className="w-[100px] text-right">Predato kg</TableHead>
                    <TableHead className="w-[100px] text-right">Cena</TableHead>
                    <TableHead className="w-[120px] text-right">Vrednost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryNotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-6 text-muted-foreground">
                        Nema predajnica za ovaj radni nalog.
                      </TableCell>
                    </TableRow>
                  ) : (
                    deliveryNotes.flatMap((dn) =>
                      dn.items.map((item, idx) => (
                        <TableRow key={`${dn.id}-${item.id}`}>
                          {idx === 0 ? (
                            <>
                              <TableCell rowSpan={dn.items.length} className="align-top">{format(new Date(dn.delivery_date), "dd.MM.yyyy")}</TableCell>
                              <TableCell rowSpan={dn.items.length} className="align-top font-mono text-xs">{dn.delivery_number}</TableCell>
                            </>
                          ) : null}
                          <TableCell className="font-mono text-xs">{item.article_code}</TableCell>
                          {idx === 0 ? (
                            <TableCell rowSpan={dn.items.length} className="align-top text-center">{dn.production_line}</TableCell>
                          ) : null}
                          <TableCell className="text-right font-mono">{formatNumber(item.qty_shift_1, { minimumFractionDigits: 0 })}</TableCell>
                          <TableCell className="text-right font-mono">{formatNumber(item.qty_shift_2, { minimumFractionDigits: 0 })}</TableCell>
                          <TableCell className="text-right font-mono">{formatNumber(item.qty_shift_3, { minimumFractionDigits: 0 })}</TableCell>
                          <TableCell className="text-right font-mono">{formatNumber(item.qty_total, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-mono">{formatNumber(item.delivered_kg, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-mono">{formatNumber(item.unit_price, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{formatNumber(item.item_value, { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))
                    )
                  )}
                </TableBody>
              </Table>
            </TableScrollContainer>
          </TabsContent>

          {/* Production note tab */}
          <TabsContent value="production_note" className="p-4">
            <Textarea
              rows={4}
              placeholder="Napomene za proizvodnju..."
              value={headerForm.production_note}
              onChange={(e) => updateHeaderField("production_note", e.target.value)}
              disabled={!isDraft}
            />
          </TabsContent>

          {/* Plant note tab */}
          <TabsContent value="plant_note" className="p-4">
            <Textarea
              rows={4}
              placeholder="Napomena za pogon..."
              value={headerForm.plant_note}
              onChange={(e) => updateHeaderField("plant_note", e.target.value)}
              disabled={!isDraft}
            />
          </TabsContent>
        </Tabs>
      </div>
      {order && (
        <DocumentHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} documentId={order.id} documentName={order.order_number} documentType="work_order" />
      )}
      <DateActionDialog
        open={showLaunchDialog}
        onOpenChange={setShowLaunchDialog}
        title={`Lansirati RN ${order.order_number}?`}
        label="Datum lansiranja"
        defaultDate={order.launched_at ? format(new Date(order.launched_at), "yyyy-MM-dd") : undefined}
        onConfirm={(date) => launchOrder.mutateAsync({ id: order.id, launched_at: new Date(date).toISOString() })}
        isPending={launchOrder.isPending}
      />
      <DateActionDialog
        open={showCloseDialog}
        onOpenChange={setShowCloseDialog}
        title={`Zaključiti RN ${order.order_number}?`}
        label="Datum zaključenja"
        defaultDate={order.closed_at ? format(new Date(order.closed_at), "yyyy-MM-dd") : undefined}
        minDate={order.launched_at ? format(new Date(order.launched_at), "yyyy-MM-dd") : undefined}
        minDateMessage="Datum zaključenja ne može biti pre datuma lansiranja."
        onConfirm={(date) => closeOrder.mutateAsync({ id: order.id, closed_at: new Date(date).toISOString() })}
        isPending={closeOrder.isPending}
      />
    </MainLayout>
  );
}
