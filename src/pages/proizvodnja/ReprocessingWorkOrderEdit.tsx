import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { ArrowLeft, Plus, Trash2, Rocket, Lock, Save, Undo2, History, FileSpreadsheet, FileDown, Printer } from "lucide-react";
import { DateActionDialog } from "@/components/shared/DateActionDialog";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import {
  useReprocessingWorkOrder, useRWOOutputItems, useRWOInputItems, useRWOMaterials,
  useReprocessingWorkOrders, RWOOutputItem, RWOInputItem, RWOMaterial,
  RWO_STATUS_LABELS, RWO_STATUS_COLORS,
} from "@/hooks/useReprocessingWorkOrders";
import { useArticles } from "@/hooks/useArticles";
import { useWarehouses } from "@/hooks/useWarehouses";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatNumber } from "@/lib/formatting";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { WarehouseStockRow } from "@/hooks/useWarehouseStock";
import { useQueryClient } from "@tanstack/react-query";
import { exportRWOToExcel, exportRWOToPdf, printRWO } from "@/lib/workOrderDocExport";

export default function ReprocessingWorkOrderEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, user } = useAuth();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();

  const { data: order, isLoading: orderLoading } = useReprocessingWorkOrder(id);
  const { items: outputItems, invalidate: invalidateOutput } = useRWOOutputItems(id);
  const { items: inputItems, invalidate: invalidateInput } = useRWOInputItems(id);
  const { materials, invalidate: invalidateMaterials } = useRWOMaterials(id);
  const { updateOrder, launchOrder, closeOrder, reopenOrder, unlaunchOrder } = useReprocessingWorkOrders();
  const { articles } = useArticles(companyId);
  const { warehouses } = useWarehouses(companyId);

  const gpArticles = useMemo(() => articles.filter((a) => a.svk === "9" && a.is_active), [articles]);
  const rmArticlesBase = useMemo(() => articles.filter((a) => (a.svk === "2" || a.svk === "6") && a.is_active), [articles]);
  const gpWarehouses = useMemo(() => warehouses.filter((w) => w.warehouse_type === "9" && w.is_active), [warehouses]);
  const rmWarehouses = useMemo(() => warehouses.filter((w) => (w.warehouse_type === "2" || w.warehouse_type === "6") && w.is_active), [warehouses]);

  const [headerForm, setHeaderForm] = useState({ order_date: "", deadline_date: "", warehouse_id: "", note: "" });
  const [headerDirty, setHeaderDirty] = useState(false);
  const [newOutputArticleId, setNewOutputArticleId] = useState("");
  const [newInputArticleId, setNewInputArticleId] = useState("");
  const [inputWarehouseId, setInputWarehouseId] = useState("");
  const [newMaterialArticleId, setNewMaterialArticleId] = useState("");
  const [materialWarehouseId, setMaterialWarehouseId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  // Fetch WAC prices for input warehouse GP articles
  const [inputWacPrices, setInputWacPrices] = useState<Record<string, number>>({});
  const [materialWacPrices, setMaterialWacPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const whId = inputWarehouseId || order?.warehouse_id;
    if (!whId || !companyId) { setInputWacPrices({}); return; }
    supabase.rpc("get_warehouse_stock", { p_company_id: companyId, p_warehouse_id: whId, p_date_from: null, p_date_to: null })
      .then(({ data }) => {
        const prices: Record<string, number> = {};
        (data as unknown as WarehouseStockRow[])?.forEach(r => {
          if (r.balance_qty > 0) prices[r.article_id] = r.balance_value / r.balance_qty;
        });
        setInputWacPrices(prices);
      });
  }, [inputWarehouseId, order?.warehouse_id, companyId]);

  useEffect(() => {
    const whId = materialWarehouseId || order?.warehouse_id;
    if (!whId || !companyId) { setMaterialWacPrices({}); return; }
    supabase.rpc("get_warehouse_stock", { p_company_id: companyId, p_warehouse_id: whId, p_date_from: null, p_date_to: null })
      .then(({ data }) => {
        const prices: Record<string, number> = {};
        (data as unknown as WarehouseStockRow[])?.forEach(r => {
          if (r.balance_qty > 0) prices[r.article_id] = r.balance_value / r.balance_qty;
        });
        setMaterialWacPrices(prices);
      });
  }, [materialWarehouseId, order?.warehouse_id, companyId]);

  const gpArticlesWithWac = useMemo(() => gpArticles.map(a => ({
    ...a, purchase_price: inputWacPrices[a.id] ?? a.purchase_price,
  })), [gpArticles, inputWacPrices]);

  const rmArticles = useMemo(() => rmArticlesBase.map(a => ({
    ...a, purchase_price: materialWacPrices[a.id] ?? a.purchase_price,
  })), [rmArticlesBase, materialWacPrices]);

  useEffect(() => {
    if (order) {
      setHeaderForm({ order_date: order.order_date, deadline_date: order.deadline_date || "", warehouse_id: order.warehouse_id, note: order.note || "" });
    }
  }, [order]);

  useEffect(() => {
    if (materials.length > 0 && !materialWarehouseId) {
      const wh = materials.find((m) => m.warehouse_id)?.warehouse_id;
      if (wh) setMaterialWarehouseId(wh);
    }
    if (inputItems.length > 0 && !inputWarehouseId) {
      const wh = inputItems.find((i) => i.warehouse_id)?.warehouse_id;
      if (wh) setInputWarehouseId(wh);
    }
  }, [materials, inputItems]);

  const isDraft = order?.status === "draft";
  const isLaunched = order?.status === "launched";
  const isClosed = order?.status === "closed";

  const handleSaveHeader = async () => {
    if (!id) return;
    await updateOrder.mutateAsync({
      id, order_date: headerForm.order_date, deadline_date: headerForm.deadline_date || null,
      warehouse_id: headerForm.warehouse_id, note: headerForm.note || null,
    } as any);
    setHeaderDirty(false);
  };

  const updateHeaderField = (field: string, value: string) => { setHeaderForm((p) => ({ ...p, [field]: value })); setHeaderDirty(true); };

  // ── Output items (Table 1) ──
  const handleAddOutput = async () => {
    if (!newOutputArticleId || !id || !companyId) return;
    const article = gpArticles.find((a) => a.id === newOutputArticleId);
    if (!article) return;
    const nextOrder = outputItems.length > 0 ? Math.max(...outputItems.map((i) => i.item_order)) + 1 : 1;
    const { error } = await (supabase as any).from("reprocessing_wo_output_items").insert({
      work_order_id: id, company_id: companyId, article_id: newOutputArticleId,
      article_code: article.code, article_name: article.name, unit: article.unit,
      kg_per_unit: article.kg_po_jm ?? 0, unit_price: article.purchase_price ?? 0, item_order: nextOrder,
    });
    if (error) { toast.error("Greška"); return; }
    setNewOutputArticleId("");
    invalidateOutput();
  };

  const handleUpdateOutput = async (item: RWOOutputItem, field: string, value: number) => {
    const updates: any = { [field]: value };
    if (field === "launched_qty") updates.launched_value = value * item.unit_price;
    if (field === "unit_price") updates.launched_value = item.launched_qty * value;
    await (supabase as any).from("reprocessing_wo_output_items").update(updates).eq("id", item.id);
    invalidateOutput();
  };

  const handleDeleteOutput = async (itemId: string) => {
    await (supabase as any).from("reprocessing_wo_output_items").delete().eq("id", itemId);
    invalidateOutput();
  };

  // ── Input items (Table 2) ──
  const handleAddInput = async () => {
    if (!newInputArticleId || !id || !companyId) return;
    const article = gpArticles.find((a) => a.id === newInputArticleId);
    if (!article) return;
    const nextOrder = inputItems.length > 0 ? Math.max(...inputItems.map((i) => i.item_order)) + 1 : 1;

    // Fetch WAC price from warehouse stock
    let unitPrice = article.purchase_price ?? 0;
    const whId = inputWarehouseId || order?.warehouse_id;
    if (whId) {
      try {
        const { data: stockData } = await supabase.rpc("get_warehouse_stock", {
          p_company_id: companyId, p_warehouse_id: whId, p_date_from: null, p_date_to: null,
        });
        const stockRow = (stockData as unknown as WarehouseStockRow[])?.find(r => r.article_id === newInputArticleId);
        if (stockRow && stockRow.balance_qty > 0) {
          unitPrice = stockRow.balance_value / stockRow.balance_qty;
        }
      } catch (e) { /* fallback to purchase_price */ }
    }

    await (supabase as any).from("reprocessing_wo_input_items").insert({
      work_order_id: id, company_id: companyId, article_id: newInputArticleId,
      article_code: article.code, article_name: article.name, unit: article.unit,
      unit_price: unitPrice, item_order: nextOrder,
      warehouse_id: inputWarehouseId || null,
    });
    setNewInputArticleId("");
    invalidateInput();
  };

  const handleUpdateInput = async (item: RWOInputItem, field: string, value: number) => {
    const updates: any = { [field]: value };
    if (field === "quantity") {
      // Validate against warehouse-specific stock
      const whId = item.warehouse_id || inputWarehouseId;
      if (whId && companyId) {
        try {
          const { data: stockData } = await supabase.rpc("get_warehouse_stock", {
            p_company_id: companyId, p_warehouse_id: whId, p_date_from: null, p_date_to: null,
          });
          const stockRow = (stockData as unknown as WarehouseStockRow[])?.find(r => r.article_id === item.article_id);
          const available = stockRow?.balance_qty ?? 0;
          if (value > available) {
            toast.warning(`Upozorenje: Količina ${value} premašuje raspoloživu zalihu u magacinu (${available})`);
          }
        } catch (e) { /* ignore stock check errors */ }
      }
      updates.item_value = value * item.unit_price;
    }
    if (field === "unit_price") updates.item_value = item.quantity * value;
    await (supabase as any).from("reprocessing_wo_input_items").update(updates).eq("id", item.id);
    invalidateInput();
  };

  const handleDeleteInput = async (itemId: string) => {
    await (supabase as any).from("reprocessing_wo_input_items").delete().eq("id", itemId);
    invalidateInput();
  };

  // ── Materials (Table 3) ──
  const handleAddMaterial = async () => {
    if (!newMaterialArticleId || !id || !companyId) return;
    const article = rmArticles.find((a) => a.id === newMaterialArticleId) || articles.find((a) => a.id === newMaterialArticleId);
    if (!article) return;
    const nextOrder = materials.length > 0 ? Math.max(...materials.map((m) => m.item_order)) + 1 : 1;

    // Fetch WAC price from warehouse stock
    let unitPrice = article.purchase_price ?? 0;
    const whId = materialWarehouseId || order?.warehouse_id;
    if (whId) {
      try {
        const { data: stockData } = await supabase.rpc("get_warehouse_stock", {
          p_company_id: companyId, p_warehouse_id: whId, p_date_from: null, p_date_to: null,
        });
        const stockRow = (stockData as unknown as WarehouseStockRow[])?.find(r => r.article_id === newMaterialArticleId);
        if (stockRow && stockRow.balance_qty > 0) {
          unitPrice = stockRow.balance_value / stockRow.balance_qty;
        }
      } catch (e) { /* fallback to purchase_price */ }
    }

    await (supabase as any).from("reprocessing_wo_materials").insert({
      work_order_id: id, company_id: companyId, article_id: newMaterialArticleId,
      article_code: article.code, article_name: article.name, unit: article.unit,
      unit_price: unitPrice, warehouse_id: materialWarehouseId || null, item_order: nextOrder,
    });
    setNewMaterialArticleId("");
    invalidateMaterials();
  };

  const handleUpdateMaterial = async (mat: RWOMaterial, field: string, value: number) => {
    const updates: any = { [field]: value };
    if (field === "quantity") {
      // Validate against warehouse-specific stock
      const whId = mat.warehouse_id || materialWarehouseId;
      if (whId && companyId) {
        try {
          const { data: stockData } = await supabase.rpc("get_warehouse_stock", {
            p_company_id: companyId, p_warehouse_id: whId, p_date_from: null, p_date_to: null,
          });
          const stockRow = (stockData as unknown as WarehouseStockRow[])?.find(r => r.article_id === mat.article_id);
          const available = stockRow?.balance_qty ?? 0;
          if (value > available) {
            toast.warning(`Upozorenje: Količina ${value} premašuje raspoloživu zalihu u magacinu (${available})`);
          }
        } catch (e) { /* ignore stock check errors */ }
      }
      updates.item_value = value * mat.unit_price;
    }
    if (field === "unit_price") updates.item_value = mat.quantity * value;
    await (supabase as any).from("reprocessing_wo_materials").update(updates).eq("id", mat.id);
    invalidateMaterials();
  };

  const handleDeleteMaterial = async (matId: string) => {
    await (supabase as any).from("reprocessing_wo_materials").delete().eq("id", matId);
    invalidateMaterials();
  };

  // ── Delivered quantities from posted delivery notes ──
  const [deliveredQtyMap, setDeliveredQtyMap] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("reprocessing_delivery_note_items")
        .select("article_id, delivered_kg, delivery_note_id, reprocessing_delivery_notes!inner(work_order_id, status)")
        .eq("reprocessing_delivery_notes.work_order_id", id)
        .eq("reprocessing_delivery_notes.status", "posted");
      if (!data) return;
      const map: Record<string, number> = {};
      for (const row of data) {
        map[row.article_id] = (map[row.article_id] || 0) + (row.delivered_kg || 0);
      }
      setDeliveredQtyMap(map);
    })();
  }, [id, outputItems]);

  const totalOutputValue = outputItems.reduce((s, i) => s + (i.launched_value || 0), 0);
  const totalInputValue = inputItems.reduce((s, i) => s + (i.item_value || 0), 0);
  const totalMaterialValue = materials.reduce((s, m) => s + (m.item_value || 0), 0);

  if (orderLoading) return <MainLayout title="RN za preradu"><p>Učitavanje...</p></MainLayout>;
  if (!order) return <MainLayout title="RN za preradu"><p>Nalog nije pronađen.</p></MainLayout>;

  return (
    <MainLayout title={`RN za preradu ${order.order_number}`}>
      <div className="flex flex-col gap-4 h-full min-h-0 overflow-y-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/proizvodnja/prerada")}><ArrowLeft className="w-5 h-5" /></Button>
            <h2 className="text-lg font-semibold">RN preradu {order.order_number}</h2>
            <Badge className={cn("text-xs", RWO_STATUS_COLORS[order.status])}>{RWO_STATUS_LABELS[order.status]}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => setHistoryOpen(true)} title="Istorija izmena"><History className="w-4 h-4" /></Button>
            {outputItems.length > 0 && order && (
              <>
                <Button variant="outline" size="sm" onClick={() => exportRWOToExcel({ companyName: selectedCompany?.name || "", order, outputItems })}>
                  <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportRWOToPdf({ companyName: selectedCompany?.name || "", order, outputItems })}>
                  <FileDown className="w-4 h-4 mr-1" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => printRWO({ companyName: selectedCompany?.name || "", order, outputItems })}>
                  <Printer className="w-4 h-4 mr-1" /> Štampa
                </Button>
              </>
            )}
            {isDraft && headerDirty && <Button onClick={handleSaveHeader} disabled={updateOrder.isPending}><Save className="w-4 h-4 mr-2" /> Sačuvaj</Button>}
            {isDraft && <Button variant="outline" onClick={() => setShowLaunchDialog(true)}><Rocket className="w-4 h-4 mr-2" /> Lansiraj</Button>}
            {isLaunched && <Button variant="outline" onClick={() => setShowCloseDialog(true)}><Lock className="w-4 h-4 mr-2" /> Zaključi</Button>}
            {isClosed && <Button variant="outline" className="text-destructive border-destructive" onClick={() => { if (confirm("Vratiti RN u Lansiran? Ovo će poništiti knjiženje.")) reopenOrder.mutateAsync(order.id); }}><Undo2 className="w-4 h-4 mr-2" /> Vrati u Lansiran</Button>}
            {isLaunched && <Button variant="outline" className="text-destructive border-destructive" onClick={() => { if (confirm("Vratiti u Nacrt?")) unlaunchOrder.mutateAsync(order.id); }}><Undo2 className="w-4 h-4 mr-2" /> Vrati u Nacrt</Button>}
          </div>
        </div>

        {/* Header */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
          <div className="space-y-1"><Label className="text-xs">Datum RN</Label><LocaleDateInput value={headerForm.order_date} onChange={(v) => updateHeaderField("order_date", v)} disabled={!isDraft} /></div>
          <div className="space-y-1"><Label className="text-xs">Rok završetka</Label><LocaleDateInput value={headerForm.deadline_date} onChange={(v) => updateHeaderField("deadline_date", v)} disabled={!isDraft} /></div>
          <div className="space-y-1">
            <Label className="text-xs">Magacin GP</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" value={headerForm.warehouse_id} onChange={(e) => updateHeaderField("warehouse_id", e.target.value)} disabled={!isDraft}>
              <option value="">--</option>
              {gpWarehouses.map((w) => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Napomena</Label><Input value={headerForm.note} onChange={(e) => updateHeaderField("note", e.target.value)} disabled={isClosed} /></div>
          {order.launched_at && <div className="space-y-1"><Label className="text-xs">Datum lansiranja</Label><Input value={new Date(order.launched_at).toLocaleDateString("sr-Latn")} disabled /></div>}
          {order.closed_at && <div className="space-y-1"><Label className="text-xs">Datum zaključenja</Label><Input value={new Date(order.closed_at).toLocaleDateString("sr-Latn")} disabled /></div>}
        </div>

        {/* Table 1: Output GP */}
        <div className="border rounded-lg">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold text-sm">Tabela 1 - Gotovi proizvodi koji se rade</h3>
            <span className="text-sm text-muted-foreground">Ukupna vrednost: <strong>{formatNumber(totalOutputValue, { minimumFractionDigits: 2 })}</strong></span>
          </div>
          {isDraft && (
            <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
              <div className="flex-1 max-w-md"><SearchableArticleSelect articles={gpArticles} value={newOutputArticleId} onValueChange={setNewOutputArticleId} placeholder="Izaberite GP..." /></div>
              <Button size="sm" onClick={handleAddOutput} disabled={!newOutputArticleId}><Plus className="w-4 h-4 mr-1" /> Dodaj</Button>
            </div>
          )}
          <TableScrollContainer className="max-h-[200px]">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-[40px]">R.br.</TableHead>
                <TableHead className="w-[80px]">Šifra</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead className="w-[50px]">JM</TableHead>
                <TableHead className="w-[100px] text-right">Cena</TableHead>
                 <TableHead className="w-[100px] text-right">Lans. kol.</TableHead>
                 <TableHead className="w-[100px] text-right">Predata kol.</TableHead>
                 <TableHead className="w-[120px] text-right">Vrednost</TableHead>
                 {isDraft && <TableHead className="w-[40px]" />}
              </TableRow></TableHeader>
              <TableBody>
                {outputItems.length === 0 ? (
                  <TableRow><TableCell colSpan={isDraft ? 9 : 8} className="text-center py-4 text-muted-foreground">Nema stavki.</TableCell></TableRow>
                ) : outputItems.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{item.article_code}</TableCell>
                    <TableCell>{item.article_name}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right"><LocaleNumberInput value={String(item.unit_price ?? 0)} onChange={(v) => handleUpdateOutput(item, "unit_price", parseFloat(v.replace(',', '.')) || 0)} disabled={!isDraft} className="w-[90px] text-right h-8" /></TableCell>
                     <TableCell className="text-right"><LocaleNumberInput value={String(item.launched_qty ?? 0)} onChange={(v) => handleUpdateOutput(item, "launched_qty", parseFloat(v.replace(',', '.')) || 0)} disabled={!isDraft} className="w-[90px] text-right h-8" /></TableCell>
                     <TableCell className="text-right font-mono">{formatNumber(deliveredQtyMap[item.article_id] || 0, { minimumFractionDigits: 2 })}</TableCell>
                     <TableCell className="text-right font-mono">{formatNumber(item.launched_value, { minimumFractionDigits: 2 })}</TableCell>
                    {isDraft && <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteOutput(item.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScrollContainer>
        </div>

        {/* Table 2: Input GP (consumed) */}
        <div className="border rounded-lg">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold text-sm">Tabela 2 - GP koji se troše (prerađuju)</h3>
            <span className="text-sm text-muted-foreground">Ukupna vrednost: <strong>{formatNumber(totalInputValue, { minimumFractionDigits: 2 })}</strong></span>
          </div>
          {(isDraft || isLaunched) && (
            <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
              <div className="max-w-[160px]">
                <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" value={inputWarehouseId} onChange={(e) => setInputWarehouseId(e.target.value)}>
                  <option value="">-- Magacin --</option>
                  {gpWarehouses.map((w) => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
                </select>
              </div>
              <div className="flex-1 max-w-md"><SearchableArticleSelect articles={gpArticlesWithWac} value={newInputArticleId} onValueChange={setNewInputArticleId} placeholder="Izaberite GP za preradu..." priceField="purchase_price" /></div>
              <Button size="sm" onClick={handleAddInput} disabled={!newInputArticleId}><Plus className="w-4 h-4 mr-1" /> Dodaj</Button>
            </div>
          )}
          <TableScrollContainer className="max-h-[200px]">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-[40px]">R.br.</TableHead>
                <TableHead className="w-[80px]">Šifra</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead className="w-[50px]">JM</TableHead>
                <TableHead className="w-[100px] text-right">Količina</TableHead>
                <TableHead className="w-[100px] text-right">Cena</TableHead>
                <TableHead className="w-[120px] text-right">Vrednost</TableHead>
                {(isDraft || isLaunched) && <TableHead className="w-[40px]" />}
              </TableRow></TableHeader>
              <TableBody>
                {inputItems.length === 0 ? (
                  <TableRow><TableCell colSpan={(isDraft || isLaunched) ? 8 : 7} className="text-center py-4 text-muted-foreground">Nema stavki.</TableCell></TableRow>
                ) : inputItems.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{item.article_code}</TableCell>
                    <TableCell>{item.article_name}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right"><LocaleNumberInput value={String(item.quantity ?? 0)} onChange={(v) => handleUpdateInput(item, "quantity", parseFloat(v.replace(',', '.')) || 0)} disabled={isClosed} className="w-[90px] text-right h-8" /></TableCell>
                    <TableCell className="text-right"><LocaleNumberInput value={String(item.unit_price ?? 0)} onChange={(v) => handleUpdateInput(item, "unit_price", parseFloat(v.replace(',', '.')) || 0)} disabled={isClosed} className="w-[90px] text-right h-8" /></TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(item.item_value, { minimumFractionDigits: 2 })}</TableCell>
                    {(isDraft || isLaunched) && <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteInput(item.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScrollContainer>
        </div>

        {/* Table 3: Materials */}
        <div className="border rounded-lg">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold text-sm">Tabela 3 - Materijal za doradu</h3>
            <span className="text-sm text-muted-foreground">Ukupna vrednost: <strong>{formatNumber(totalMaterialValue, { minimumFractionDigits: 2 })}</strong></span>
          </div>
          {(isDraft || isLaunched) && (
            <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
              <div className="max-w-[160px]">
                <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" value={materialWarehouseId} onChange={(e) => setMaterialWarehouseId(e.target.value)}>
                  <option value="">-- Magacin --</option>
                  {rmWarehouses.map((w) => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
                </select>
              </div>
              <div className="flex-1 max-w-md"><SearchableArticleSelect articles={rmArticles} value={newMaterialArticleId} onValueChange={setNewMaterialArticleId} placeholder="Izaberite materijal..." priceField="purchase_price" /></div>
              <Button size="sm" onClick={handleAddMaterial} disabled={!newMaterialArticleId}><Plus className="w-4 h-4 mr-1" /> Dodaj</Button>
            </div>
          )}
          <TableScrollContainer className="max-h-[200px]">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-[40px]">R.br.</TableHead>
                <TableHead className="w-[80px]">Šifra</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead className="w-[50px]">JM</TableHead>
                <TableHead className="w-[100px] text-right">Količina</TableHead>
                <TableHead className="w-[100px] text-right">Cena</TableHead>
                <TableHead className="w-[120px] text-right">Vrednost</TableHead>
                {(isDraft || isLaunched) && <TableHead className="w-[40px]" />}
              </TableRow></TableHeader>
              <TableBody>
                {materials.length === 0 ? (
                  <TableRow><TableCell colSpan={(isDraft || isLaunched) ? 8 : 7} className="text-center py-4 text-muted-foreground">Nema materijala.</TableCell></TableRow>
                ) : materials.map((mat, idx) => (
                  <TableRow key={mat.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{mat.article_code}</TableCell>
                    <TableCell>{mat.article_name}</TableCell>
                    <TableCell>{mat.unit}</TableCell>
                    <TableCell className="text-right"><LocaleNumberInput value={String(mat.quantity ?? 0)} onChange={(v) => handleUpdateMaterial(mat, "quantity", parseFloat(v.replace(',', '.')) || 0)} disabled={isClosed} className="w-[90px] text-right h-8" /></TableCell>
                    <TableCell className="text-right"><LocaleNumberInput value={String(mat.unit_price ?? 0)} onChange={(v) => handleUpdateMaterial(mat, "unit_price", parseFloat(v.replace(',', '.')) || 0)} disabled={isClosed} className="w-[90px] text-right h-8" /></TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(mat.item_value, { minimumFractionDigits: 2 })}</TableCell>
                    {(isDraft || isLaunched) && <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteMaterial(mat.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScrollContainer>
        </div>

        {/* Summary */}
        <div className="p-4 border rounded-lg bg-card">
          <div className="flex gap-8 text-sm">
            <span>Istrebovani GP: <strong>{formatNumber(totalInputValue, { minimumFractionDigits: 2 })}</strong></span>
            <span>Istrebovani materijal: <strong>{formatNumber(totalMaterialValue, { minimumFractionDigits: 2 })}</strong></span>
            <span className="font-bold">Ukupno istrebovano: {formatNumber(totalInputValue + totalMaterialValue, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
      <DocumentHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} documentId={order.id} documentName={order.order_number} documentType="reprocessing_work_order" />
      <DateActionDialog
        open={showLaunchDialog}
        onOpenChange={setShowLaunchDialog}
        title={`Lansirati RN ${order.order_number}?`}
        label="Datum lansiranja"
        onConfirm={(date) => launchOrder.mutateAsync({ id: order.id, launched_at: new Date(date).toISOString() })}
        isPending={launchOrder.isPending}
      />
      <DateActionDialog
        open={showCloseDialog}
        onOpenChange={setShowCloseDialog}
        title={`Zaključiti RN ${order.order_number}? Ovo će proknjižiti istrebovane GP i materijal.`}
        label="Datum zaključenja"
        minDate={order.launched_at ? format(new Date(order.launched_at), "yyyy-MM-dd") : undefined}
        minDateMessage="Datum zaključenja ne može biti pre datuma lansiranja."
        onConfirm={(date) => closeOrder.mutateAsync({ id: order.id, closed_at: new Date(date).toISOString() })}
        isPending={closeOrder.isPending}
      />
    </MainLayout>
  );
}
