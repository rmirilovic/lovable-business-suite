import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { DateActionDialog } from "@/components/shared/DateActionDialog";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Trash2, Rocket, Lock, FileSpreadsheet, FileText, Printer, MoreHorizontal, Eye, Undo2 } from "lucide-react";
import { exportWorkOrdersToExcel, exportWorkOrdersToPdf, printWorkOrders, EnrichedWorkOrder } from "@/lib/workOrderExportUtils";
import { useWorkOrders, STATUS_LABELS, STATUS_COLORS, WorkOrder } from "@/hooks/useWorkOrders";
import { supabase } from "@/integrations/supabase/client";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useTableSort } from "@/hooks/useTableSort";
import { useQuery } from "@tanstack/react-query";
import { format, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/formatting";

const STORAGE_KEY = "radni_nalozi_filters";

function loadFilters() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveFilters(data: any) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function RadniNalozi() {
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, user } = useAuth();
  const companyId = selectedCompany?.id;
  const yearId = selectedYear?.id;
  const { orders, isLoading, createOrder, deleteOrder, launchOrder, closeOrder, reopenOrder, unlaunchOrder } = useWorkOrders();
  const { warehouses } = useWarehouses(companyId);
  const gpWarehouses = warehouses.filter((w) => w.warehouse_type === "9" && w.is_active);

  const saved = loadFilters();
  const yearStart = selectedYear
    ? format(startOfYear(new Date(selectedYear.year, 0, 1)), "yyyy-MM-dd")
    : format(startOfYear(new Date()), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const [search, setSearch] = useState(saved?.search ?? "");
  const [productCodeFilter, setProductCodeFilter] = useState(saved?.productCodeFilter ?? "");
  const [statusFilter, setStatusFilter] = useState(saved?.statusFilter ?? "all");
  const [dateFrom, setDateFrom] = useState(saved?.dateFrom ?? yearStart);
  const [dateTo, setDateTo] = useState(saved?.dateTo ?? today);
  const [deadlineFrom, setDeadlineFrom] = useState(saved?.deadlineFrom ?? "");
  const [deadlineTo, setDeadlineTo] = useState(saved?.deadlineTo ?? "");
  const [lastEditedId, setLastEditedId] = useState<string | null>(saved?.lastEditedId ?? null);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort(
    saved?.sortColumn ?? null,
    saved?.sortDirection ?? "asc"
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [operatorName, setOperatorName] = useState("");
  const [newForm, setNewForm] = useState({
    order_date: format(new Date(), "yyyy-MM-dd"),
    deadline_date: "",
    warehouse_id: "",
    issued_by: "",
  });

  // Fetch operator name from profile
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("first_name, last_name").eq("id", user.id).single()
      .then(({ data }) => {
        if (data) {
          const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
          setOperatorName(name);
        }
      });
  }, [user?.id]);

  // Fetch first product and launched value per order
  const orderIds = useMemo(() => orders.map(o => o.id), [orders]);
  
  const { data: itemsData } = useQuery({
    queryKey: ["work-order-items-summary", companyId, yearId],
    queryFn: async () => {
      if (!orderIds.length) return {};
      const { data, error } = await supabase
        .from("work_order_items")
        .select("work_order_id, article_code, article_name, launched_value, item_order")
        .in("work_order_id", orderIds)
        .order("item_order");
      if (error) throw error;
      
      const map: Record<string, { firstCode: string; firstName: string; totalValue: number }> = {};
      for (const item of data || []) {
        if (!map[item.work_order_id]) {
          map[item.work_order_id] = {
            firstCode: item.article_code,
            firstName: item.article_name,
            totalValue: 0,
          };
        }
        map[item.work_order_id].totalValue += Number(item.launched_value || 0);
      }
      return map;
    },
    enabled: orderIds.length > 0,
  });

  // Fetch issued (delivered) value per order from posted requisitions
  const { data: issuedData } = useQuery({
    queryKey: ["work-order-issued-summary", companyId, yearId],
    queryFn: async () => {
      if (!orderIds.length) return {};
      // Get posted requisitions for these orders
      const { data: reqs, error: reqErr } = await supabase
        .from("material_requisitions")
        .select("id, work_order_id")
        .in("work_order_id", orderIds)
        .not("posted_at", "is", null);
      if (reqErr) throw reqErr;
      if (!reqs?.length) return {};
      
      const reqIds = reqs.map(r => r.id);
      const reqToOrder: Record<string, string> = {};
      reqs.forEach(r => { reqToOrder[r.id] = r.work_order_id!; });
      
      const { data: items, error: itemErr } = await supabase
        .from("material_requisition_items")
        .select("requisition_id, item_value")
        .in("requisition_id", reqIds);
      if (itemErr) throw itemErr;
      
      const map: Record<string, number> = {};
      for (const item of items || []) {
        const orderId = reqToOrder[item.requisition_id];
        map[orderId] = (map[orderId] || 0) + Number(item.item_value || 0);
      }
      return map;
    },
    enabled: orderIds.length > 0,
  });

  // Auto-fill issued_by when dialog opens
  const handleOpenNewDialog = useCallback(() => {
    setNewForm({
      order_date: format(new Date(), "yyyy-MM-dd"),
      deadline_date: "",
      warehouse_id: "",
      issued_by: operatorName,
    });
    setShowNewDialog(true);
  }, [operatorName]);

  // Enrich orders
  const enrichedOrders: EnrichedWorkOrder[] = useMemo(() => {
    return orders.map(o => ({
      ...o,
      firstProductCode: itemsData?.[o.id]?.firstCode ?? "",
      firstProductName: itemsData?.[o.id]?.firstName ?? "",
      launchedValue: itemsData?.[o.id]?.totalValue ?? 0,
      issuedValue: issuedData?.[o.id] ?? 0,
    }));
  }, [orders, itemsData, issuedData]);

  const filteredOrders = enrichedOrders.filter((o) => {
    const matchSearch =
      !search ||
      o.order_number.includes(search) ||
      o.issued_by.toLowerCase().includes(search.toLowerCase());
    const matchProductCode =
      !productCodeFilter ||
      o.firstProductCode.toLowerCase().includes(productCodeFilter.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchDateFrom = !dateFrom || o.order_date >= dateFrom;
    const matchDateTo = !dateTo || o.order_date <= dateTo;
    const matchDeadlineFrom = !deadlineFrom || (o.deadline_date && o.deadline_date >= deadlineFrom);
    const matchDeadlineTo = !deadlineTo || (o.deadline_date && o.deadline_date <= deadlineTo);
    return matchSearch && matchProductCode && matchStatus && matchDateFrom && matchDateTo && matchDeadlineFrom && matchDeadlineTo;
  });

  const sorted = sortItems(filteredOrders, (item, col) => {
    switch (col) {
      case "order_number": return item.order_number;
      case "order_date": return item.order_date;
      case "deadline_date": return item.deadline_date ?? "";
      case "product": return item.firstProductCode;
      case "warehouse": return item.warehouse?.code ?? "";
      case "launched_at": return item.launched_at ?? "";
      case "closed_at": return item.closed_at ?? "";
      case "launched_value": return item.launchedValue;
      case "issued_value": return item.issuedValue;
      case "status": return item.status;
      default: return "";
    }
  });

  useEffect(() => {
    if (!isLoading && lastEditedId && sorted.length > 0) {
      const row = scrollRef.current?.querySelector(`[data-order-id="${lastEditedId}"]`);
      if (row) {
        row.scrollIntoView({ block: "center", behavior: "auto" });
        setLastEditedId(null);
      }
    }
  }, [isLoading, sorted.length, lastEditedId]);

  const persistAndNavigate = (id: string) => {
    saveFilters({ search, productCodeFilter, statusFilter, dateFrom, dateTo, deadlineFrom, deadlineTo, sortColumn, sortDirection, lastEditedId: id });
    navigate(`/proizvodnja/nalozi/${id}`);
  };

  const handleCreate = async () => {
    if (!newForm.warehouse_id || !newForm.order_date) return;
    const result = await createOrder.mutateAsync({
      order_date: newForm.order_date,
      deadline_date: newForm.deadline_date || undefined,
      warehouse_id: newForm.warehouse_id,
      issued_by: newForm.issued_by,
    });
    setShowNewDialog(false);
    navigate(`/proizvodnja/nalozi/${result.id}`);
  };

  const handleDelete = async (order: WorkOrder) => {
    if (confirm(`Obrisati radni nalog ${order.order_number}?`)) {
      await deleteOrder.mutateAsync(order.id);
    }
  };

  const [launchTarget, setLaunchTarget] = useState<WorkOrder | null>(null);
  const [closeTarget, setCloseTarget] = useState<WorkOrder | null>(null);

  const handleLaunch = (order: WorkOrder) => setLaunchTarget(order);
  const handleClose = (order: WorkOrder) => setCloseTarget(order);

  const handleReopen = async (order: WorkOrder) => {
    if (confirm(`Vratiti radni nalog ${order.order_number} u status Lansiran?`)) {
      await reopenOrder.mutateAsync(order.id);
    }
  };

  const handleUnlaunch = async (order: WorkOrder) => {
    if (confirm(`Vratiti radni nalog ${order.order_number} u status Nacrt?`)) {
      await unlaunchOrder.mutateAsync(order.id);
    }
  };

  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd.MM.yyyy") : "-";

  const exportMeta = { companyName: selectedCompany?.name ?? "", dateFrom, dateTo };

  return (
    <MainLayout title="Radni nalozi">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col h-full min-h-0">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-4 flex-1 items-end">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Broj ili izdavalac..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  autoComplete="off"
                />
              </div>
              <div className="relative max-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Šifra proizvoda..."
                  value={productCodeFilter}
                  onChange={(e) => setProductCodeFilter(e.target.value)}
                  className="pl-10"
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-1">
                {["all", "draft", "launched", "closed"].map((s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === "all" ? "Svi" : STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportWorkOrdersToExcel(sorted, exportMeta)}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportWorkOrdersToPdf(sorted, exportMeta)}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => printWorkOrders(sorted, exportMeta)}>
                <Printer className="w-4 h-4 mr-2" /> Štampa
              </Button>
              <Button onClick={handleOpenNewDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Novi radni nalog
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Datum od</Label>
              <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[140px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Datum do</Label>
              <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[140px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Rok od</Label>
              <LocaleDateInput value={deadlineFrom} onChange={setDeadlineFrom} className="w-[140px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Rok do</Label>
              <LocaleDateInput value={deadlineTo} onChange={setDeadlineTo} className="w-[140px]" />
            </div>
          </div>
        </div>

        {/* Table */}
        <TableScrollContainer ref={scrollRef} className="flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">
                  <SortableHeader column="order_number" label="Broj" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[90px]">
                  <SortableHeader column="order_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[90px]">
                  <SortableHeader column="deadline_date" label="Rok" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="product" label="Proizvod" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[80px]">
                  <SortableHeader column="warehouse" label="Magacin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[90px]">
                  <SortableHeader column="launched_at" label="Lansirano" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[90px]">
                  <SortableHeader column="closed_at" label="Zaključeno" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[110px] text-right">
                  <SortableHeader column="launched_value" label="Vr. lansiranja" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                </TableHead>
                <TableHead className="w-[110px] text-right">
                  <SortableHeader column="issued_value" label="Vr. predaje" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                </TableHead>
                <TableHead className="w-[100px]">
                  <SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">Učitavanje...</TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Nema radnih naloga.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((order) => (
                  <TableRow
                    key={order.id}
                    data-order-id={order.id}
                    className="cursor-pointer hover:bg-muted/50 relative"
                    onClick={() => persistAndNavigate(order.id)}
                  >
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{fmtDate(order.order_date)}</TableCell>
                    <TableCell>{fmtDate(order.deadline_date)}</TableCell>
                    <TableCell className="truncate max-w-[250px]" title={order.firstProductCode ? `${order.firstProductCode} - ${order.firstProductName}` : ""}>
                      {order.firstProductCode ? `${order.firstProductCode} - ${order.firstProductName}` : "-"}
                    </TableCell>
                    <TableCell>{order.warehouse?.code || "-"}</TableCell>
                    <TableCell>{fmtDate(order.launched_at)}</TableCell>
                    <TableCell>{fmtDate(order.closed_at)}</TableCell>
                    <TableCell className="text-right">{order.launchedValue ? formatPrice(order.launchedValue) : "-"}</TableCell>
                    <TableCell className="text-right">{order.issuedValue ? formatPrice(order.issuedValue) : "-"}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", STATUS_COLORS[order.status])}>
                        {STATUS_LABELS[order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => persistAndNavigate(order.id)}>
                            <Eye className="h-4 w-4 mr-2" /> Prikaži
                          </DropdownMenuItem>
                          {order.status === "draft" && (
                            <DropdownMenuItem onClick={() => handleLaunch(order)}>
                              <Rocket className="h-4 w-4 mr-2" /> Lansiraj
                            </DropdownMenuItem>
                          )}
                          {order.status === "launched" && (
                            <DropdownMenuItem onClick={() => handleClose(order)}>
                              <Lock className="h-4 w-4 mr-2" /> Zaključi
                            </DropdownMenuItem>
                          )}
                          {order.status === "launched" && (
                            <DropdownMenuItem onClick={() => handleUnlaunch(order)}>
                              <Undo2 className="h-4 w-4 mr-2" /> Vrati u Nacrt
                            </DropdownMenuItem>
                          )}
                          {order.status === "closed" && (
                            <DropdownMenuItem onClick={() => handleReopen(order)}>
                              <Undo2 className="h-4 w-4 mr-2" /> Vrati u Lansiran
                            </DropdownMenuItem>
                          )}
                          {order.status === "draft" && (
                            <DropdownMenuItem onClick={() => handleDelete(order)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Obriši
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>

      {/* New Work Order Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novi radni nalog</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Datum radnog naloga *</Label>
              <LocaleDateInput
                value={newForm.order_date}
                onChange={(v) => setNewForm({ ...newForm, order_date: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>Rok završetka</Label>
              <LocaleDateInput
                value={newForm.deadline_date}
                onChange={(v) => setNewForm({ ...newForm, deadline_date: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>Magacin gotovih proizvoda *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newForm.warehouse_id}
                onChange={(e) => setNewForm({ ...newForm, warehouse_id: e.target.value })}
              >
                <option value="">-- Izaberite --</option>
                {gpWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Nalog izdao</Label>
              <Input
                value={newForm.issued_by}
                onChange={(e) => setNewForm({ ...newForm, issued_by: e.target.value })}
                placeholder="Ime i prezime"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Otkaži</Button>
            <Button
              onClick={handleCreate}
              disabled={!newForm.order_date || !newForm.warehouse_id || createOrder.isPending}
            >
              Kreiraj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Launch date dialog */}
      <DateActionDialog
        open={!!launchTarget}
        onOpenChange={(v) => { if (!v) setLaunchTarget(null); }}
        title={`Lansirati RN ${launchTarget?.order_number || ""}?`}
        label="Datum lansiranja"
        onConfirm={(date) => { if (launchTarget) launchOrder.mutateAsync({ id: launchTarget.id, launched_at: new Date(date).toISOString() }); setLaunchTarget(null); }}
        isPending={launchOrder.isPending}
      />

      {/* Close date dialog */}
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
