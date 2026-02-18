import { useState, useEffect, useRef, useMemo } from "react";
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
import { Plus, Search, Trash2, Lock, MoreHorizontal, Eye } from "lucide-react";
import {
  useProductionDeliveryNotes,
  PDN_STATUS_LABELS, PDN_STATUS_COLORS,
  ProductionDeliveryNote,
} from "@/hooks/useProductionDeliveryNotes";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { useTableSort } from "@/hooks/useTableSort";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/formatting";
import { useQuery } from "@tanstack/react-query";

const STORAGE_KEY = "predajnice_gp_filters";

function loadFilters() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveFilters(data: any) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function PredajniceGP() {
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, user } = useAuth();
  const companyId = selectedCompany?.id;
  const { notes, isLoading, createNote, deleteNote } = useProductionDeliveryNotes();
  const { warehouses } = useWarehouses(companyId);
  const { orders } = useWorkOrders();
  const gpWarehouses = warehouses.filter((w) => w.warehouse_type === "9" && w.is_active);

  // Launched / closed work orders for dropdown
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === "launched" || o.status === "closed"),
    [orders]
  );

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
    saved?.sortColumn ?? null,
    saved?.sortDirection ?? "asc"
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [operatorName, setOperatorName] = useState("");
  const [newForm, setNewForm] = useState({
    delivery_date: format(new Date(), "yyyy-MM-dd"),
    warehouse_id: "",
    work_order_id: "",
    production_line: 1,
    responsible_person: "",
  });

  // Fetch operator name
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

  // Fetch item summaries (total_value per note)
  const noteIds = useMemo(() => notes.map(n => n.id), [notes]);
  const { data: itemSummary } = useQuery({
    queryKey: ["pdn-items-summary", companyId, noteIds],
    queryFn: async () => {
      if (!noteIds.length) return {};
      const { data, error } = await (supabase as any)
        .from("production_delivery_note_items")
        .select("delivery_note_id, item_value, delivered_kg, article_code, article_name, item_order")
        .in("delivery_note_id", noteIds);
      if (error) throw error;
      const map: Record<string, { totalValue: number; totalKg: number; firstArticle: string }> = {};
      for (const item of data || []) {
        if (!map[item.delivery_note_id]) {
          map[item.delivery_note_id] = { totalValue: 0, totalKg: 0, firstArticle: "" };
        }
        map[item.delivery_note_id].totalValue += Number(item.item_value || 0);
        map[item.delivery_note_id].totalKg += Number(item.delivered_kg || 0);
      }
      // Find first article by item_order for each note
      for (const item of (data || []).sort((a: any, b: any) => (a.item_order ?? 0) - (b.item_order ?? 0))) {
        if (map[item.delivery_note_id] && !map[item.delivery_note_id].firstArticle) {
          map[item.delivery_note_id].firstArticle = `${item.article_code} - ${item.article_name}`;
        }
      }
      return map;
    },
    enabled: noteIds.length > 0,
  });

  const handleOpenNewDialog = () => {
    setNewForm({
      delivery_date: format(new Date(), "yyyy-MM-dd"),
      warehouse_id: gpWarehouses.length === 1 ? gpWarehouses[0].id : "",
      work_order_id: "",
      production_line: 1,
      responsible_person: operatorName,
    });
    setShowNewDialog(true);
  };

  const filtered = notes.filter((n) => {
    const s = search.toLowerCase();
    const matchSearch = !search ||
      n.delivery_number.includes(search) ||
      n.work_order?.order_number?.includes(search) ||
      (itemSummary?.[n.id]?.firstArticle ?? "").toLowerCase().includes(s);
    const matchStatus = statusFilter === "all" || n.status === statusFilter;
    const matchDateFrom = !dateFrom || n.delivery_date >= dateFrom;
    const matchDateTo = !dateTo || n.delivery_date <= dateTo;
    return matchSearch && matchStatus && matchDateFrom && matchDateTo;
  });

  const sorted = sortItems(filtered, (item, col) => {
    switch (col) {
      case "delivery_number": return item.delivery_number;
      case "delivery_date": return item.delivery_date;
      case "work_order": return item.work_order?.order_number ?? "";
      case "warehouse": return item.warehouse?.code ?? "";
      case "article": return itemSummary?.[item.id]?.firstArticle ?? "";
      case "line": return item.production_line;
      case "total_value": return itemSummary?.[item.id]?.totalValue ?? 0;
      case "total_kg": return itemSummary?.[item.id]?.totalKg ?? 0;
      case "status": return item.status;
      default: return "";
    }
  });

  useEffect(() => {
    if (!isLoading && lastEditedId && sorted.length > 0) {
      const row = scrollRef.current?.querySelector(`[data-note-id="${lastEditedId}"]`);
      if (row) {
        row.scrollIntoView({ block: "center", behavior: "auto" });
        setLastEditedId(null);
      }
    }
  }, [isLoading, sorted.length, lastEditedId]);

  const persistAndNavigate = (id: string) => {
    saveFilters({ search, statusFilter, dateFrom, dateTo, sortColumn, sortDirection, lastEditedId: id });
    navigate(`/proizvodnja/predajnice/${id}`);
  };

  const handleCreate = async () => {
    if (!newForm.warehouse_id || !newForm.delivery_date) return;
    const result = await createNote.mutateAsync({
      delivery_date: newForm.delivery_date,
      warehouse_id: newForm.warehouse_id,
      work_order_id: newForm.work_order_id || undefined,
      production_line: newForm.production_line,
      responsible_person: newForm.responsible_person,
    });
    setShowNewDialog(false);
    navigate(`/proizvodnja/predajnice/${result.id}`);
  };

  const handleDelete = async (note: ProductionDeliveryNote) => {
    if (confirm(`Obrisati predajnicu ${note.delivery_number}?`)) {
      await deleteNote.mutateAsync(note.id);
    }
  };

  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd.MM.yyyy") : "-";

  return (
    <MainLayout title="Predajnice GP iz proizvodnje">
      <div className="flex flex-col h-full min-h-0">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-4 flex-1 items-end">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Broj, RN ili gotov proizvod..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-1">
                {["all", "draft", "posted"].map((s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === "all" ? "Svi" : PDN_STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleOpenNewDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Nova predajnica
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
          </div>
        </div>

        {/* Table */}
        <TableScrollContainer ref={scrollRef} className="flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">
                  <SortableHeader column="delivery_number" label="Broj" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[90px]">
                  <SortableHeader column="delivery_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[90px]">
                  <SortableHeader column="work_order" label="RN" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[80px]">
                  <SortableHeader column="warehouse" label="Magacin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[60px]">
                  <SortableHeader column="line" label="Linija" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[180px]">
                  <SortableHeader column="article" label="Gotov proizvod" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[110px] text-right">
                  <SortableHeader column="total_kg" label="Ukupno kg" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                </TableHead>
                <TableHead className="w-[110px] text-right">
                  <SortableHeader column="total_value" label="Vrednost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
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
                  <TableCell colSpan={10} className="text-center py-8">Učitavanje...</TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nema predajnica.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((note) => (
                  <TableRow
                    key={note.id}
                    data-note-id={note.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => persistAndNavigate(note.id)}
                  >
                    <TableCell className="font-medium">{note.delivery_number}</TableCell>
                    <TableCell>{fmtDate(note.delivery_date)}</TableCell>
                    <TableCell className="font-mono text-xs">{note.work_order?.order_number ?? "-"}</TableCell>
                    <TableCell>{note.warehouse?.code ?? "-"}</TableCell>
                    <TableCell className="text-center">{note.production_line}</TableCell>
                    <TableCell className="text-xs truncate max-w-[220px]" title={itemSummary?.[note.id]?.firstArticle ?? ""}>
                      {itemSummary?.[note.id]?.firstArticle ?? "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatPrice(itemSummary?.[note.id]?.totalKg ?? 0)}</TableCell>
                    <TableCell className="text-right font-mono">{formatPrice(itemSummary?.[note.id]?.totalValue ?? 0)}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", PDN_STATUS_COLORS[note.status])}>
                        {PDN_STATUS_LABELS[note.status] ?? note.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => persistAndNavigate(note.id)}>
                            <Eye className="w-4 h-4 mr-2" /> Otvori
                          </DropdownMenuItem>
                          {note.status === "draft" && (
                            <DropdownMenuItem onClick={() => handleDelete(note)} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Obriši
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

      {/* New dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova predajnica GP</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label>Datum</Label>
              <LocaleDateInput
                value={newForm.delivery_date}
                onChange={(v) => setNewForm((p) => ({ ...p, delivery_date: v }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Magacin</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newForm.warehouse_id}
                onChange={(e) => setNewForm((p) => ({ ...p, warehouse_id: e.target.value }))}
              >
                <option value="">-- Izaberite --</option>
                {gpWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Radni nalog</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newForm.work_order_id}
                onChange={(e) => setNewForm((p) => ({ ...p, work_order_id: e.target.value }))}
              >
                <option value="">-- Bez radnog naloga --</option>
                {activeOrders.map((o) => (
                  <option key={o.id} value={o.id}>{o.order_number}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Proizvodna linija (1-19)</Label>
              <Input
                type="number"
                min={1}
                max={19}
                value={newForm.production_line}
                onChange={(e) => setNewForm((p) => ({ ...p, production_line: Math.min(19, Math.max(1, parseInt(e.target.value) || 1)) }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Odgovorno lice</Label>
              <Input
                value={newForm.responsible_person}
                onChange={(e) => setNewForm((p) => ({ ...p, responsible_person: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Otkaži</Button>
            <Button onClick={handleCreate} disabled={!newForm.warehouse_id || createNote.isPending}>
              Kreiraj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
