import { useState, useEffect, useRef, useMemo } from "react";
import { DateActionDialog } from "@/components/shared/DateActionDialog";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { SortableHeader } from "@/components/ui/sortable-header";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Trash2, Rocket, Lock, MoreHorizontal, Eye, Undo2, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useReprocessingWorkOrders, RWO_STATUS_LABELS, RWO_STATUS_COLORS, ReprocessingWorkOrder } from "@/hooks/useReprocessingWorkOrders";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useTableSort } from "@/hooks/useTableSort";
import { format, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/formatting";
import { exportRWOToExcel, exportRWOToPdf, printRWO, EnrichedRWO } from "@/lib/reprocessingWorkOrderExportUtils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "reprocessing_wo_filters";
function loadFilters() { try { const r = sessionStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveFilters(d: any) { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

export default function ReprocessingWorkOrders() {
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, user } = useAuth();
  const companyId = selectedCompany?.id;
  const { orders, isLoading, createOrder, deleteOrder, launchOrder, closeOrder, reopenOrder, unlaunchOrder } = useReprocessingWorkOrders();
  const { warehouses } = useWarehouses(companyId);
  const gpWarehouses = warehouses.filter((w) => w.warehouse_type === "9" && w.is_active);

  const saved = loadFilters();
  const yearStart = selectedYear ? format(startOfYear(new Date(selectedYear.year, 0, 1)), "yyyy-MM-dd") : format(startOfYear(new Date()), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const [search, setSearch] = useState(saved?.search ?? "");
  const [statusFilter, setStatusFilter] = useState(saved?.statusFilter ?? "all");
  const [dateFrom, setDateFrom] = useState(saved?.dateFrom ?? yearStart);
  const [dateTo, setDateTo] = useState(saved?.dateTo ?? today);
  const [lastEditedId, setLastEditedId] = useState<string | null>(saved?.lastEditedId ?? null);
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort(saved?.sortColumn ?? null, saved?.sortDirection ?? "asc");
  const scrollRef = useRef<HTMLDivElement>(null);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newForm, setNewForm] = useState({ order_date: format(new Date(), "yyyy-MM-dd"), deadline_date: "", warehouse_id: "" });
  const [launchTarget, setLaunchTarget] = useState<ReprocessingWorkOrder | null>(null);
  const [closeTarget, setCloseTarget] = useState<ReprocessingWorkOrder | null>(null);

  // Fetch output items summary
  const orderIds = useMemo(() => orders.map(o => o.id), [orders]);
  const { data: outputSummary } = useQuery({
    queryKey: ["rwo-output-summary", companyId, orderIds],
    queryFn: async () => {
      if (!orderIds.length) return {};
      const { data, error } = await (supabase as any)
        .from("reprocessing_wo_output_items")
        .select("work_order_id, article_code, article_name, launched_value, item_order")
        .in("work_order_id", orderIds);
      if (error) throw error;
      const map: Record<string, { firstProduct: string; totalValue: number }> = {};
      for (const item of (data || []).sort((a: any, b: any) => (a.item_order ?? 0) - (b.item_order ?? 0))) {
        if (!map[item.work_order_id]) {
          map[item.work_order_id] = { firstProduct: `${item.article_code} - ${item.article_name}`, totalValue: 0 };
        }
        map[item.work_order_id].totalValue += Number(item.launched_value || 0);
      }
      return map;
    },
    enabled: orderIds.length > 0,
  });

  const filtered = orders.filter((o) => {
    const s = search.toLowerCase();
    const matchSearch = !search || o.order_number.includes(search) || (outputSummary?.[o.id]?.firstProduct ?? "").toLowerCase().includes(s);
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchDateFrom = !dateFrom || o.order_date >= dateFrom;
    const matchDateTo = !dateTo || o.order_date <= dateTo;
    return matchSearch && matchStatus && matchDateFrom && matchDateTo;
  });

  const sorted = sortItems(filtered, (item, col) => {
    switch (col) {
      case "order_number": return item.order_number;
      case "order_date": return item.order_date;
      case "deadline_date": return item.deadline_date ?? "";
      case "product": return outputSummary?.[item.id]?.firstProduct ?? "";
      case "warehouse": return item.warehouse?.code ?? "";
      case "launched_at": return item.launched_at ?? "";
      case "closed_at": return item.closed_at ?? "";
      case "launched_value": return outputSummary?.[item.id]?.totalValue ?? 0;
      case "status": return item.status;
      default: return "";
    }
  });

  useEffect(() => {
    if (!isLoading && lastEditedId && sorted.length > 0) {
      const row = scrollRef.current?.querySelector(`[data-order-id="${lastEditedId}"]`);
      if (row) { row.scrollIntoView({ block: "center", behavior: "auto" }); setLastEditedId(null); }
    }
  }, [isLoading, sorted.length, lastEditedId]);

  const persistAndNavigate = (id: string) => {
    saveFilters({ search, statusFilter, dateFrom, dateTo, sortColumn, sortDirection, lastEditedId: id });
    navigate(`/proizvodnja/prerada/${id}`);
  };

  const handleCreate = async () => {
    if (!newForm.warehouse_id || !newForm.order_date) return;
    const result = await createOrder.mutateAsync({ order_date: newForm.order_date, deadline_date: newForm.deadline_date || undefined, warehouse_id: newForm.warehouse_id });
    setShowNewDialog(false);
    navigate(`/proizvodnja/prerada/${result.id}`);
  };

  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd.MM.yyyy") : "-";

  const getEnrichedOrders = (): EnrichedRWO[] => sorted.map((o) => ({
    ...o,
    firstProduct: outputSummary?.[o.id]?.firstProduct ?? "",
    totalValue: outputSummary?.[o.id]?.totalValue ?? 0,
  }));

  return (
    <MainLayout title="RN za preradu i doradu">
      <div className="flex flex-col h-full min-h-0">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-4 flex-1 items-end">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Broj ili proizvod..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" autoComplete="off" />
              </div>
              <div className="flex gap-1">
                {["all", "draft", "launched", "closed"].map((s) => (
                  <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
                    {s === "all" ? "Svi" : RWO_STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { const enriched = getEnrichedOrders(); const meta = { companyName: selectedCompany?.name ?? "", dateFrom, dateTo }; exportRWOToExcel(enriched, meta); }}><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
              <Button variant="outline" size="sm" onClick={() => { const enriched = getEnrichedOrders(); const meta = { companyName: selectedCompany?.name ?? "", dateFrom, dateTo }; exportRWOToPdf(enriched, meta); }}><FileText className="w-4 h-4 mr-1" /> PDF</Button>
              <Button variant="outline" size="sm" onClick={() => { const enriched = getEnrichedOrders(); const meta = { companyName: selectedCompany?.name ?? "", dateFrom, dateTo }; printRWO(enriched, meta); }}><Printer className="w-4 h-4 mr-1" /> Štampa</Button>
              <Button onClick={() => { setNewForm({ order_date: format(new Date(), "yyyy-MM-dd"), deadline_date: "", warehouse_id: gpWarehouses.length === 1 ? gpWarehouses[0].id : "" }); setShowNewDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Novi RN za preradu
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Datum od</Label><LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[140px]" /></div>
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Datum do</Label><LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[140px]" /></div>
          </div>
        </div>

        <TableScrollContainer ref={scrollRef} className="flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]"><SortableHeader column="order_number" label="Broj" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[90px]"><SortableHeader column="order_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[90px]"><SortableHeader column="deadline_date" label="Rok" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader column="product" label="Proizvod" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[80px]"><SortableHeader column="warehouse" label="Magacin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[90px]"><SortableHeader column="launched_at" label="Lansirano" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[90px]"><SortableHeader column="closed_at" label="Zaključeno" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[120px] text-right"><SortableHeader column="launched_value" label="Vrednost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                <TableHead className="w-[100px]"><SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8">Učitavanje...</TableCell></TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nema radnih naloga za preradu.</TableCell></TableRow>
              ) : sorted.map((order) => (
                <TableRow key={order.id} data-order-id={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => persistAndNavigate(order.id)}>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>{fmtDate(order.order_date)}</TableCell>
                  <TableCell>{fmtDate(order.deadline_date)}</TableCell>
                  <TableCell className="text-xs truncate max-w-[220px]">{outputSummary?.[order.id]?.firstProduct ?? "-"}</TableCell>
                  <TableCell>{order.warehouse?.code ?? "-"}</TableCell>
                  <TableCell>{fmtDate(order.launched_at)}</TableCell>
                  <TableCell>{fmtDate(order.closed_at)}</TableCell>
                  <TableCell className="text-right font-mono">{formatPrice(outputSummary?.[order.id]?.totalValue ?? 0)}</TableCell>
                  <TableCell><Badge className={cn("text-xs", RWO_STATUS_COLORS[order.status])}>{RWO_STATUS_LABELS[order.status]}</Badge></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => persistAndNavigate(order.id)}><Eye className="w-4 h-4 mr-2" /> Otvori</DropdownMenuItem>
                        {order.status === "draft" && <DropdownMenuItem onClick={() => setLaunchTarget(order)}><Rocket className="w-4 h-4 mr-2" /> Lansiraj</DropdownMenuItem>}
                        {order.status === "launched" && <DropdownMenuItem onClick={() => setCloseTarget(order)}><Lock className="w-4 h-4 mr-2" /> Zaključi</DropdownMenuItem>}
                        {order.status === "closed" && <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm(`Vratiti RN ${order.order_number} u Lansiran?`)) reopenOrder.mutateAsync(order.id); }}><Undo2 className="w-4 h-4 mr-2" /> Vrati u Lansiran</DropdownMenuItem>}
                        {order.status === "launched" && <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm(`Vratiti RN ${order.order_number} u Nacrt?`)) unlaunchOrder.mutateAsync(order.id); }}><Undo2 className="w-4 h-4 mr-2" /> Vrati u Nacrt</DropdownMenuItem>}
                        {order.status === "draft" && <DropdownMenuItem onClick={() => { if (confirm(`Obrisati RN ${order.order_number}?`)) deleteOrder.mutateAsync(order.id); }} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Obriši</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novi RN za preradu i doradu</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1"><Label>Datum</Label><LocaleDateInput value={newForm.order_date} onChange={(v) => setNewForm((p) => ({ ...p, order_date: v }))} /></div>
            <div className="space-y-1"><Label>Rok završetka</Label><LocaleDateInput value={newForm.deadline_date} onChange={(v) => setNewForm((p) => ({ ...p, deadline_date: v }))} /></div>
            <div className="space-y-1">
              <Label>Magacin GP</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newForm.warehouse_id} onChange={(e) => setNewForm((p) => ({ ...p, warehouse_id: e.target.value }))}>
                <option value="">-- Izaberite --</option>
                {gpWarehouses.map((w) => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Otkaži</Button>
            <Button onClick={handleCreate} disabled={!newForm.warehouse_id || createOrder.isPending}>Kreiraj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DateActionDialog
        open={!!launchTarget}
        onOpenChange={(v) => { if (!v) setLaunchTarget(null); }}
        title={`Lansirati RN ${launchTarget?.order_number || ""}?`}
        label="Datum lansiranja"
        onConfirm={(date) => { if (launchTarget) launchOrder.mutateAsync({ id: launchTarget.id, launched_at: new Date(date).toISOString() }); setLaunchTarget(null); }}
        isPending={launchOrder.isPending}
      />

      <DateActionDialog
        open={!!closeTarget}
        onOpenChange={(v) => { if (!v) setCloseTarget(null); }}
        title={`Zaključiti RN ${closeTarget?.order_number || ""}?`}
        label="Datum zaključenja"
        minDate={closeTarget?.launched_at ? format(new Date(closeTarget.launched_at), "yyyy-MM-dd") : undefined}
        minDateMessage="Datum zaključenja ne može biti pre datuma lansiranja."
        onConfirm={(date) => { if (closeTarget) closeOrder.mutateAsync({ id: closeTarget.id, closed_at: new Date(date).toISOString() }); setCloseTarget(null); }}
        isPending={closeOrder.isPending}
      />
    </MainLayout>
  );
}
