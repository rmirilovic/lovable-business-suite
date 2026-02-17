import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Plus, Search, Trash2, FileSpreadsheet, FileText, Printer } from "lucide-react";
import {
  useMaterialRequisitions, REQ_STATUS_LABELS, REQ_STATUS_COLORS, MaterialRequisition,
} from "@/hooks/useMaterialRequisitions";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { useTableSort } from "@/hooks/useTableSort";
import {
  exportRequisitionsToExcel, exportRequisitionsToPdf, printRequisitions,
} from "@/lib/requisitionExportUtils";
import { format, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/formatting";

const STORAGE_KEY = "trebovanja_filters";
function loadFilters() {
  try { const r = sessionStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function saveFilters(d: any) { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

export default function Trebovanja() {
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, user } = useAuth();
  const companyId = selectedCompany?.id;
  const { requisitions, isLoading, createRequisition, deleteRequisition, postRequisition, unpostRequisition } = useMaterialRequisitions();
  const { warehouses } = useWarehouses(companyId);
  const { orders } = useWorkOrders();
  const rmWarehouses = warehouses.filter((w) => w.warehouse_type === "2" && w.is_active);
  const launchedOrders = orders.filter((o) => o.status === "launched");

  const saved = loadFilters();
  const yearStart = selectedYear
    ? format(startOfYear(new Date(selectedYear.year, 0, 1)), "yyyy-MM-dd")
    : format(startOfYear(new Date()), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const [search, setSearch] = useState(saved?.search ?? "");
  const [statusFilter, setStatusFilter] = useState(saved?.statusFilter ?? "all");
  const [dateFrom, setDateFrom] = useState(saved?.dateFrom ?? yearStart);
  const [dateTo, setDateTo] = useState(saved?.dateTo ?? today);
  const [lastEditedId, setLastEditedId] = useState<string | null>(saved?.lastEditedId ?? null);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort(
    saved?.sortColumn ?? null, saved?.sortDirection ?? "asc"
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newForm, setNewForm] = useState({
    requisition_date: format(new Date(), "yyyy-MM-dd"),
    warehouse_id: "",
    work_order_id: "",
  });

  const filtered = requisitions.filter((r) => {
    const s = !search || r.requisition_number.includes(search) ||
      r.work_order?.order_number?.includes(search) ||
      r.issued_by.toLowerCase().includes(search.toLowerCase());
    const st = statusFilter === "all" || r.status === statusFilter;
    const df = !dateFrom || r.requisition_date >= dateFrom;
    const dt = !dateTo || r.requisition_date <= dateTo;
    return s && st && df && dt;
  });

  const sorted = sortItems(filtered, (item, col) => {
    switch (col) {
      case "requisition_number": return item.requisition_number;
      case "requisition_date": return item.requisition_date;
      case "warehouse": return `${item.warehouse?.code ?? ""} ${item.warehouse?.name ?? ""}`;
      case "work_order": return item.work_order?.order_number ?? "";
      case "gp_codes": return item.work_order?.work_order_items?.map(i => i.article_code).join(", ") ?? "";
      case "issued_by": return item.issued_by;
      case "value": return item.items?.reduce((s, i) => s + (i.item_value || 0), 0) ?? 0;
      case "status": return item.status;
      default: return "";
    }
  });

  useEffect(() => {
    if (!isLoading && lastEditedId && sorted.length > 0) {
      const row = scrollRef.current?.querySelector(`[data-req-id="${lastEditedId}"]`);
      if (row) { row.scrollIntoView({ block: "center", behavior: "auto" }); setLastEditedId(null); }
    }
  }, [isLoading, sorted.length, lastEditedId]);

  const persistAndNavigate = (id: string) => {
    saveFilters({ search, statusFilter, dateFrom, dateTo, sortColumn, sortDirection, lastEditedId: id });
    navigate(`/proizvodnja/trebovanja/${id}`);
  };

  const handleCreate = async () => {
    if (!newForm.warehouse_id || !newForm.requisition_date) return;
    const meta = user?.user_metadata;
    const fullName = [meta?.first_name, meta?.last_name].filter(Boolean).join(" ");
    const result = await createRequisition.mutateAsync({
      requisition_date: newForm.requisition_date,
      warehouse_id: newForm.warehouse_id,
      work_order_id: newForm.work_order_id || undefined,
      received_by: fullName || "",
    });
    setShowNewDialog(false);
    navigate(`/proizvodnja/trebovanja/${result.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, r: MaterialRequisition) => {
    e.stopPropagation();
    if (confirm(`Obrisati trebovanje ${r.requisition_number}?`)) {
      await deleteRequisition.mutateAsync(r.id);
    }
  };

  const handlePost = async (e: React.MouseEvent, r: MaterialRequisition) => {
    e.stopPropagation();
    if (confirm(`Proknjižiti trebovanje ${r.requisition_number}?`)) {
      await postRequisition.mutateAsync(r.id);
    }
  };

  const handleUnpost = async (e: React.MouseEvent, r: MaterialRequisition) => {
    e.stopPropagation();
    if (confirm(`Poništiti knjiženje trebovanja ${r.requisition_number}?`)) {
      await unpostRequisition.mutateAsync(r.id);
    }
  };

  return (
    <MainLayout title="Trebovanja materijala">
      <div className="flex flex-col h-full min-h-0">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-4 flex-1 items-end">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Pretraži po broju, nalogu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" autoComplete="off" />
              </div>
              <div className="flex gap-1">
                {["all", "draft", "posted"].map((s) => (
                  <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
                    {s === "all" ? "Svi" : REQ_STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportRequisitionsToExcel(sorted, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportRequisitionsToPdf(sorted, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => printRequisitions(sorted, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })}>
                <Printer className="w-4 h-4 mr-2" /> Štampa
              </Button>
              <Button onClick={() => { setNewForm({ requisition_date: format(new Date(), "yyyy-MM-dd"), warehouse_id: "", work_order_id: "" }); setShowNewDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Novo trebovanje
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
                <TableHead className="w-[100px]"><SortableHeader column="requisition_number" label="Broj" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[100px]"><SortableHeader column="requisition_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader column="warehouse" label="Magacin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[120px]"><SortableHeader column="work_order" label="Radni nalog" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader column="gp_codes" label="Gotovi proizvodi" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader column="issued_by" label="Izdao" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[120px] text-right"><SortableHeader column="value" label="Vrednost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[100px]"><SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[120px]">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8">Učitavanje...</TableCell></TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nema trebovanja.</TableCell></TableRow>
              ) : sorted.map((r) => {
                const gpCodes = r.work_order?.work_order_items?.map(i => i.article_code).join(", ") || "-";
                const totalValue = r.items?.reduce((s, i) => s + (i.item_value || 0), 0) ?? 0;
                return (
                <TableRow key={r.id} data-req-id={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => persistAndNavigate(r.id)}>
                  <TableCell className="font-medium">{r.requisition_number}</TableCell>
                  <TableCell>{format(new Date(r.requisition_date), "dd.MM.yyyy")}</TableCell>
                  <TableCell>{r.warehouse ? `${r.warehouse.code} - ${r.warehouse.name}` : "-"}</TableCell>
                  <TableCell>{r.work_order?.order_number || "-"}</TableCell>
                  <TableCell className="text-xs">{gpCodes}</TableCell>
                  <TableCell>{r.issued_by || "-"}</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(totalValue)}</TableCell>
                  <TableCell><Badge className={cn("text-xs", REQ_STATUS_COLORS[r.status])}>{REQ_STATUS_LABELS[r.status]}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {r.status === "draft" && (
                        <>
                          <Button variant="ghost" size="icon" title="Proknjiži" onClick={(e) => handlePost(e, r)}>
                            <FileText className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Obriši" onClick={(e) => handleDelete(e, r)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {r.status === "posted" && (
                        <Button variant="ghost" size="icon" title="Poništi knjiženje" onClick={(e) => handleUnpost(e, r)}>
                          <FileText className="w-4 h-4 text-yellow-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo trebovanje</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Datum trebovanja *</Label>
              <LocaleDateInput value={newForm.requisition_date} onChange={(v) => setNewForm({ ...newForm, requisition_date: v })} />
            </div>
            <div className="space-y-2">
              <Label>Magacin repromaterijala *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newForm.warehouse_id} onChange={(e) => setNewForm({ ...newForm, warehouse_id: e.target.value })}>
                <option value="">-- Izaberite --</option>
                {rmWarehouses.map((w) => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Radni nalog</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newForm.work_order_id} onChange={(e) => setNewForm({ ...newForm, work_order_id: e.target.value })}>
                <option value="">-- Bez naloga --</option>
                {launchedOrders.map((o) => <option key={o.id} value={o.id}>{o.order_number}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Otkaži</Button>
            <Button onClick={handleCreate} disabled={!newForm.requisition_date || !newForm.warehouse_id || createRequisition.isPending}>Kreiraj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
