import { useState, useEffect, useRef } from "react";
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
import { Plus, Search, Trash2, Rocket, Lock } from "lucide-react";
import { useWorkOrders, STATUS_LABELS, STATUS_COLORS, WorkOrder } from "@/hooks/useWorkOrders";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useTableSort } from "@/hooks/useTableSort";
import { format, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";

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
  const { selectedCompany, selectedYear } = useAuth();
  const companyId = selectedCompany?.id;
  const { orders, isLoading, createOrder, deleteOrder, launchOrder, closeOrder } = useWorkOrders();
  const { warehouses } = useWarehouses(companyId);
  const gpWarehouses = warehouses.filter((w) => w.warehouse_type === "9" && w.is_active);

  const saved = loadFilters();
  const yearStart = selectedYear
    ? format(startOfYear(new Date(selectedYear.year, 0, 1)), "yyyy-MM-dd")
    : format(startOfYear(new Date()), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const [search, setSearch] = useState(saved?.search ?? "");
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
  const [newForm, setNewForm] = useState({
    order_date: format(new Date(), "yyyy-MM-dd"),
    deadline_date: "",
    warehouse_id: "",
    issued_by: "",
  });

  const filteredOrders = orders.filter((o) => {
    const matchSearch =
      !search ||
      o.order_number.includes(search) ||
      o.issued_by.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchDateFrom = !dateFrom || o.order_date >= dateFrom;
    const matchDateTo = !dateTo || o.order_date <= dateTo;
    const matchDeadlineFrom = !deadlineFrom || (o.deadline_date && o.deadline_date >= deadlineFrom);
    const matchDeadlineTo = !deadlineTo || (o.deadline_date && o.deadline_date <= deadlineTo);
    return matchSearch && matchStatus && matchDateFrom && matchDateTo && matchDeadlineFrom && matchDeadlineTo;
  });

  const sorted = sortItems(filteredOrders, (item, col) => {
    switch (col) {
      case "order_number": return item.order_number;
      case "order_date": return item.order_date;
      case "deadline_date": return item.deadline_date ?? "";
      case "warehouse": return item.warehouse?.name ?? "";
      case "issued_by": return item.issued_by;
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
    saveFilters({ search, statusFilter, dateFrom, dateTo, deadlineFrom, deadlineTo, sortColumn, sortDirection, lastEditedId: id });
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

  const handleDelete = async (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    if (confirm(`Obrisati radni nalog ${order.order_number}?`)) {
      await deleteOrder.mutateAsync(order.id);
    }
  };

  const handleLaunch = async (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    if (confirm(`Lansirati radni nalog ${order.order_number}?`)) {
      await launchOrder.mutateAsync(order.id);
    }
  };

  const handleClose = async (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    if (confirm(`Zaključiti radni nalog ${order.order_number}?`)) {
      await closeOrder.mutateAsync(order.id);
    }
  };

  return (
    <MainLayout title="Radni nalozi">
      <div className="flex flex-col h-full min-h-0">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-4 flex-1 items-end">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Pretraži po broju ili izdavaocu..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
            <Button onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novi radni nalog
            </Button>
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
                <TableHead className="w-[100px]">
                  <SortableHeader column="order_number" label="Broj" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px]">
                  <SortableHeader column="order_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px]">
                  <SortableHeader column="deadline_date" label="Rok" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="warehouse" label="Magacin GP" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="issued_by" label="Nalog izdao" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px]">
                  <SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[120px]">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Učitavanje...</TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                    <TableCell>{format(new Date(order.order_date), "dd.MM.yyyy")}</TableCell>
                    <TableCell>
                      {order.deadline_date ? format(new Date(order.deadline_date), "dd.MM.yyyy") : "-"}
                    </TableCell>
                    <TableCell>{order.warehouse?.name || "-"}</TableCell>
                    <TableCell>{order.issued_by || "-"}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", STATUS_COLORS[order.status])}>
                        {STATUS_LABELS[order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 relative z-10" onClick={(e) => e.stopPropagation()}>
                        {order.status === "draft" && (
                          <>
                            <Button variant="ghost" size="icon" title="Lansiraj" onClick={(e) => handleLaunch(e, order)}>
                              <Rocket className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Obriši" onClick={(e) => handleDelete(e, order)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {order.status === "launched" && (
                          <Button variant="ghost" size="icon" title="Zaključi" onClick={(e) => handleClose(e, order)}>
                            <Lock className="w-4 h-4 text-green-600" />
                          </Button>
                        )}
                      </div>
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
    </MainLayout>
  );
}
