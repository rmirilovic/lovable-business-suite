import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { ArrowLeft, Plus, Trash2, Save, BookCheck, AlertTriangle, Printer, FileDown, History, Undo2, MoreHorizontal, ClipboardList } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArticleRequisitionsDialog } from "@/components/proizvodnja/ArticleRequisitionsDialog";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import {
  useMaterialRequisition, useMaterialRequisitionItems, useMaterialRequisitions,
  REQ_STATUS_LABELS, REQ_STATUS_COLORS,
} from "@/hooks/useMaterialRequisitions";
import { useArticles } from "@/hooks/useArticles";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useWorkOrders, useWorkOrderMaterials } from "@/hooks/useWorkOrders";
import { useWarehouseStock } from "@/hooks/useWarehouseStock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatNumber, parseLocaleNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { exportRequisitionPdf, printRequisition } from "@/lib/requisitionPdfGenerator";

export default function RequisitionEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, user } = useAuth();
  const companyId = selectedCompany?.id;

  const { data: requisition, isLoading: reqLoading } = useMaterialRequisition(id);
  const { items, isLoading: itemsLoading, invalidate: invalidateItems } = useMaterialRequisitionItems(id);
  const { updateRequisition, postRequisition, unpostRequisition } = useMaterialRequisitions();
  const { articles } = useArticles(companyId);
  const { warehouses } = useWarehouses(companyId);
  const { orders } = useWorkOrders();

  const rmArticles = useMemo(() => articles.filter((a) => a.svk === "2" && a.is_active), [articles]);
  const rmWarehouses = useMemo(() => warehouses.filter((w) => w.warehouse_type === "2" && w.is_active), [warehouses]);
  const launchedOrders = useMemo(() => orders.filter((o) => o.status === "launched"), [orders]);

  // Check if selected work order is still launched
  const selectedWO = useMemo(() => orders.find((o) => o.id === requisition?.work_order_id), [orders, requisition]);
  const woNotLaunched = !!selectedWO && selectedWO.status !== "launched";

  // Warehouse stock for checking availability
  const { data: stockData } = useWarehouseStock(companyId, requisition?.warehouse_id);

  // Work order approved materials
  const { materials: woMaterials } = useWorkOrderMaterials(requisition?.work_order_id ?? undefined);

  // Build maps for quick lookup
  const stockMap = useMemo(() => {
    const m: Record<string, number> = {};
    if (stockData) stockData.forEach((s) => { m[s.article_id] = s.balance_qty; });
    return m;
  }, [stockData]);

  const approvedMap = useMemo(() => {
    const m: Record<string, number> = {};
    woMaterials.forEach((wm) => { m[wm.article_id] = (m[wm.article_id] ?? 0) + wm.approved_qty; });
    return m;
  }, [woMaterials]);

  // Header form
  const [headerForm, setHeaderForm] = useState({
    requisition_date: "",
    warehouse_id: "",
    work_order_id: "",
    note: "",
    issued_by: "",
    received_by: "",
  });
  const [headerDirty, setHeaderDirty] = useState(false);
  const [newArticleId, setNewArticleId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (requisition) {
      setHeaderForm({
        requisition_date: requisition.requisition_date,
        warehouse_id: requisition.warehouse_id,
        work_order_id: requisition.work_order_id || "",
        note: requisition.note || "",
        issued_by: requisition.issued_by || "",
        received_by: requisition.received_by || "",
      });
    }
  }, [requisition]);

  const isDraft = requisition?.status === "draft";

  // Check if any item exceeds stock
  const hasStockWarning = useMemo(() => {
    return items.some((item) => {
      const available = stockMap[item.article_id] ?? 0;
      return item.quantity > available;
    });
  }, [items, stockMap]);

  const handleSaveHeader = async () => {
    if (!id) return;
    await updateRequisition.mutateAsync({
      id,
      requisition_date: headerForm.requisition_date,
      warehouse_id: headerForm.warehouse_id,
      work_order_id: headerForm.work_order_id || null,
      note: headerForm.note || null,
      issued_by: headerForm.issued_by,
      received_by: headerForm.received_by,
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
    const article = rmArticles.find((a) => a.id === newArticleId);
    if (!article) return;

    const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.item_order)) + 1 : 1;
    // Use warehouse stock price (WAC) if available, fallback to article purchase_price
    const stockRow = stockData?.find((s) => s.article_id === newArticleId);
    const unitPrice = (stockRow && stockRow.balance_qty > 0)
      ? Math.round((stockRow.balance_value / stockRow.balance_qty) * 1000000) / 1000000
      : (article.purchase_price ?? 0);

    const { error } = await (supabase as any).from("material_requisition_items").insert({
      requisition_id: id,
      company_id: companyId,
      article_id: newArticleId,
      article_code: article.code,
      article_name: article.name,
      unit: article.unit,
      quantity: 0,
      unit_price: unitPrice,
      item_value: 0,
      item_order: nextOrder,
    });

    if (error) { toast.error("Greška pri dodavanju stavke"); return; }
    setNewArticleId("");
    invalidateItems();
  };

  // Update item
  const handleUpdateItemQty = async (item: typeof items[0], rawValue: string) => {
    const qty = parseLocaleNumber(rawValue);
    if (isNaN(qty)) return;
    const val = qty * item.unit_price;
    const { error } = await (supabase as any)
      .from("material_requisition_items")
      .update({ quantity: qty, item_value: Math.round(val * 100) / 100 })
      .eq("id", item.id);
    if (error) toast.error("Greška");
    invalidateItems();
  };

  const handleUpdateItemPrice = async (item: typeof items[0], rawValue: string) => {
    const price = parseLocaleNumber(rawValue);
    if (isNaN(price)) return;
    const val = item.quantity * price;
    const { error } = await (supabase as any)
      .from("material_requisition_items")
      .update({ unit_price: price, item_value: Math.round(val * 100) / 100 })
      .eq("id", item.id);
    if (error) toast.error("Greška");
    invalidateItems();
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    const { error } = await (supabase as any).from("material_requisition_items").delete().eq("id", itemId);
    if (error) toast.error("Greška");
    invalidateItems();
  };

  // Post
  const cannotPost = hasStockWarning || woNotLaunched;

  const handlePost = async () => {
    if (hasStockWarning) {
      toast.error("Nije moguće proknjižiti - postoje stavke sa nedovoljnom količinom u magacinu!");
      return;
    }
    if (woNotLaunched) {
      toast.error("Nije moguće proknjižiti - radni nalog nije u statusu 'Lansiran'!");
      return;
    }
    if (confirm("Proknjižiti trebovanje?")) {
      await postRequisition.mutateAsync(id!);
    }
  };

  // Totals
  const totalValue = items.reduce((s, i) => s + (i.item_value || 0), 0);

  if (reqLoading) return <MainLayout title="Trebovanje"><p>Učitavanje...</p></MainLayout>;
  if (!requisition) return <MainLayout title="Trebovanje"><p>Trebovanje nije pronađeno.</p></MainLayout>;

  return (
    <MainLayout title={`Trebovanje ${requisition.requisition_number}`}>
      <div className="flex flex-col gap-4 pb-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/proizvodnja/trebovanja")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Nazad
            </Button>
            <h1 className="text-xl font-semibold">{requisition.requisition_number}</h1>
            <Badge className={cn("text-xs", REQ_STATUS_COLORS[requisition.status])}>
              {REQ_STATUS_LABELS[requisition.status]}
            </Badge>
            {isDraft && woNotLaunched && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> RN nije lansiran
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportRequisitionPdf(requisition, items, selectedCompany as any)}>
              <FileDown className="h-4 w-4 mr-2" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printRequisition(requisition, items, selectedCompany as any)}>
              <Printer className="h-4 w-4 mr-2" />Štampa
            </Button>
            {isDraft && headerDirty && (
              <Button size="sm" onClick={handleSaveHeader} disabled={updateRequisition.isPending}>
                <Save className="w-4 h-4 mr-2" />Sačuvaj
              </Button>
            )}
            {isDraft && (
              <Button size="sm" onClick={handlePost} disabled={cannotPost}>
                <BookCheck className="h-4 w-4 mr-2" />Proknjiži
              </Button>
            )}
            {requisition.status === "posted" && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => {
                if (confirm("Poništiti knjiženje?")) unpostRequisition.mutateAsync(requisition.id);
              }}>
                <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
              </Button>
            )}
          </div>
        </div>

        {/* Header fields - one row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 border rounded-lg bg-card">
          <div className="space-y-1">
            <Label className="text-xs">Datum</Label>
            <LocaleDateInput value={headerForm.requisition_date} onChange={(v) => updateHeaderField("requisition_date", v)} disabled={!isDraft} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Magacin repromaterijala</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" value={headerForm.warehouse_id} onChange={(e) => updateHeaderField("warehouse_id", e.target.value)} disabled={!isDraft}>
              <option value="">--</option>
              {rmWarehouses.map((w) => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Radni nalog</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" value={headerForm.work_order_id} onChange={(e) => updateHeaderField("work_order_id", e.target.value)} disabled={!isDraft}>
              <option value="">-- Bez naloga --</option>
              {launchedOrders.map((o) => <option key={o.id} value={o.id}>{o.order_number}</option>)}
              {selectedWO && selectedWO.status !== "launched" && (
                <option key={selectedWO.id} value={selectedWO.id} disabled>{selectedWO.order_number} (nije lansiran)</option>
              )}
            </select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Napomena</Label>
            <Input value={headerForm.note} onChange={(e) => updateHeaderField("note", e.target.value)} disabled={!isDraft} autoComplete="off" />
          </div>
        </div>

        {/* Items */}
        <div className="border rounded-lg flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold text-sm">Stavke trebovanja</h3>
            <span className="text-sm text-muted-foreground">
              Zbir vrednosti: <strong>{formatNumber(totalValue, { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>
          {isDraft && (
            <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
              <div className="flex-1 max-w-md">
                <SearchableArticleSelect
                  articles={rmArticles}
                  value={newArticleId}
                  onValueChange={setNewArticleId}
                  placeholder="Izaberite materijal..."
                />
              </div>
              <Button size="sm" onClick={handleAddItem} disabled={!newArticleId}>
                <Plus className="w-4 h-4 mr-1" /> Dodaj
              </Button>
            </div>
          )}
          <TableScrollContainer className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">R.br.</TableHead>
                  <TableHead className="w-[80px]">Šifra</TableHead>
                  <TableHead>Naziv materijala</TableHead>
                  <TableHead className="w-[50px]">JM</TableHead>
                  <TableHead className="w-[130px] text-right">Količina</TableHead>
                  <TableHead className="w-[100px] text-right">U magacinu</TableHead>
                  <TableHead className="w-[100px] text-right">Odobreno RN</TableHead>
                  <TableHead className="w-[130px] text-right">Cena</TableHead>
                  <TableHead className="w-[130px] text-right">Vrednost</TableHead>
                  {isDraft && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isDraft ? 10 : 9} className="text-center py-6 text-muted-foreground">
                      Nema stavki. Dodajte materijal.
                    </TableCell>
                  </TableRow>
                ) : items.map((item, idx) => {
                  const available = stockMap[item.article_id] ?? 0;
                  const approved = approvedMap[item.article_id] ?? 0;
                  const overStock = item.quantity > available;

                  return (
                    <TableRow key={item.id} className={overStock ? "bg-destructive/5" : undefined}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{item.article_code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.article_name}
                          {overStock && (
                            <span title="Nedovoljna količina u magacinu">
                              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">
                        {isDraft ? (
                          <LocaleNumberInput
                            className="w-28 text-right h-8 text-sm ml-auto"
                            value={formatNumber(item.quantity, { minimumFractionDigits: 3, useGrouping: false }).replace('.', ',')}
                            onChange={() => {}}
                            onBlur={(e) => handleUpdateItemQty(item, (e.target as HTMLInputElement).value)}
                            decimalPlaces={3}
                          />
                        ) : (
                          formatNumber(item.quantity, { minimumFractionDigits: 3 })
                        )}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-xs", overStock && "text-destructive font-semibold")}>
                        {formatNumber(available, { minimumFractionDigits: 3 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {approved > 0 ? formatNumber(approved, { minimumFractionDigits: 3 }) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isDraft ? (
                          <LocaleNumberInput
                            className="w-28 text-right h-8 text-sm ml-auto"
                            value={formatNumber(item.unit_price, { minimumFractionDigits: 2, useGrouping: false }).replace('.', ',')}
                            onChange={() => {}}
                            onBlur={(e) => handleUpdateItemPrice(item, (e.target as HTMLInputElement).value)}
                            decimalPlaces={2}
                          />
                        ) : (
                          formatNumber(item.unit_price, { minimumFractionDigits: 2 })
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatNumber(item.item_value, { minimumFractionDigits: 2 })}
                      </TableCell>
                      {isDraft && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableScrollContainer>
        </div>

        {/* Footer - signatures */}
        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-card">
          <div className="space-y-1">
            <Label className="text-xs">Materijal izdao</Label>
            <Input value={headerForm.issued_by} onChange={(e) => updateHeaderField("issued_by", e.target.value)} disabled={!isDraft} autoComplete="off" placeholder="Ime i prezime" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Materijal primio</Label>
            <Input value={headerForm.received_by} onChange={(e) => updateHeaderField("received_by", e.target.value)} disabled={!isDraft} autoComplete="off" placeholder="Ime i prezime" />
          </div>
        </div>
      </div>
      <DocumentHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} documentId={requisition.id} documentName={requisition.requisition_number} documentType="material_requisition" />
    </MainLayout>
  );
}
