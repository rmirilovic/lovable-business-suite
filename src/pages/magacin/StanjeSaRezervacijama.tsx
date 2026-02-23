import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, Warehouse, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useStockWithReservations, type StockWithReservationsRow } from "@/hooks/useWarehouseReservations";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { formatPrice, formatDecimal } from "@/lib/formatting";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { format } from "date-fns";
import { exportStockReservationsToExcel, exportStockReservationsToPdf, printStockReservations } from "@/lib/reservationExportUtils";
import { toast } from "sonner";

const STORAGE_KEY = "stanje_rezervacije_view_state";

interface ViewState {
  warehouseId: string;
  dateTo: string;
  search: string;
  sortColumn: string;
  sortDirection: string;
  scrollTop: number;
}

function loadState(): Partial<ViewState> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveState(state: Partial<ViewState>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export default function StanjeSaRezervacijama() {
  const { selectedCompany, selectedYear } = useAuth();
  const companyId = selectedCompany?.id;

  const { warehouses, isLoading: whLoading } = useWarehouses(companyId);

  const saved = useRef(loadState()).current;
  const yearEnd = selectedYear ? `${selectedYear.year}-12-31` : "";
  const today = format(new Date(), "yyyy-MM-dd");
  const defaultTo = yearEnd && yearEnd < today ? yearEnd : today;

  const [warehouseId, setWarehouseId] = useState(saved.warehouseId || "");
  const [dateTo, setDateTo] = useState(saved.dateTo || defaultTo);
  const [search, setSearch] = useState(saved.search || "");
  const [exporting, setExporting] = useState(false);
  const scrollRestoredRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(saved.scrollTop ?? 0);

  const { data: stockData, isLoading } = useStockWithReservations(companyId, warehouseId || undefined, dateTo || undefined);

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);
  const warehouseName = selectedWarehouse ? `${selectedWarehouse.code} — ${selectedWarehouse.name}` : "";

  const filtered = useMemo(() => {
    if (!stockData) return [];
    if (!search) return stockData;
    const q = search.toLowerCase();
    return stockData.filter(
      (r) => r.article_code.toLowerCase().includes(q) || r.article_name.toLowerCase().includes(q)
    );
  }, [stockData, search]);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort(
    (saved.sortColumn as any) || "article_code",
    (saved.sortDirection as any) || "asc"
  );

  const sorted = useMemo(() => {
    return sortItems(filtered, (item: StockWithReservationsRow, col: string) => {
      switch (col) {
        case "article_code": return item.article_code;
        case "article_name": return item.article_name;
        case "unit": return item.unit;
        case "balance_qty": return Number(item.balance_qty);
        case "total_reserved": return Number(item.total_reserved);
        case "reserved_delivery_notes": return Number(item.reserved_delivery_notes);
        case "reserved_delivery_orders": return Number(item.reserved_delivery_orders);
        case "reserved_other": return Number(item.reserved_other);
        case "available_qty": return Number(item.available_qty);
        case "unit_price": return Number(item.unit_price);
        case "value": return Number(item.balance_qty) * Number(item.unit_price);
        default: return "";
      }
    });
  }, [filtered, sortItems]);

  // Persist state
  const persistState = useCallback(() => {
    saveState({ warehouseId, dateTo, search, sortColumn, sortDirection, scrollTop: lastScrollTopRef.current });
  }, [warehouseId, dateTo, search, sortColumn, sortDirection]);

  useEffect(() => { persistState(); }, [persistState]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => { lastScrollTopRef.current = el.scrollTop; };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isLoading]);

  useEffect(() => {
    return () => {
      const prev = loadState();
      saveState({ ...prev, scrollTop: lastScrollTopRef.current });
    };
  }, []);

  useEffect(() => {
    if (!isLoading && sorted.length > 0 && !scrollRestoredRef.current && saved.scrollTop) {
      scrollRestoredRef.current = true;
      requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo({ top: saved.scrollTop });
      });
    }
  }, [isLoading, sorted.length, saved.scrollTop]);

  const totals = useMemo(() => {
    return sorted.reduce(
      (acc, r) => ({
        balanceValue: acc.balanceValue + Number(r.balance_qty) * Number(r.unit_price),
        totalReserved: acc.totalReserved + Number(r.total_reserved),
      }),
      { balanceValue: 0, totalReserved: 0 }
    );
  }, [sorted]);

  const exportMeta = { warehouseName, dateTo: dateTo || undefined };

  const handleExcelExport = () => {
    if (sorted.length === 0) return;
    exportStockReservationsToExcel(sorted, exportMeta);
    toast.success("Excel fajl je kreiran.");
  };

  const handlePdfExport = async () => {
    if (sorted.length === 0) return;
    setExporting(true);
    try {
      await exportStockReservationsToPdf(sorted, exportMeta, totals);
      toast.success("PDF fajl je kreiran.");
    } finally { setExporting(false); }
  };

  const handlePrint = async () => {
    if (sorted.length === 0) return;
    setExporting(true);
    try {
      await printStockReservations(sorted, exportMeta, totals);
    } finally { setExporting(false); }
  };

  return (
    <MainLayout title="Stanje sa rezervacijama">
      <div className="flex flex-col h-full min-h-0 gap-4">
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
          <div className="space-y-1">
            <Label className="text-xs">Magacin</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Izaberite magacin..." />
              </SelectTrigger>
              <SelectContent>
                {warehouses.filter((w) => w.is_active).map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>{wh.code} — {wh.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Na dan</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[170px]" />
          </div>

          <div className="relative flex-1 min-w-[200px] space-y-1">
            <Label className="text-xs">Artikal</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pretraži po šifri ili nazivu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>

          {sorted.length > 0 && (
            <div className="flex items-center gap-1 ml-auto">
              <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={exporting}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handlePdfExport} disabled={exporting}>
                <FileText className="h-4 w-4 mr-1" />PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={exporting}>
                <Printer className="h-4 w-4 mr-1" />Štampaj
              </Button>
            </div>
          )}
        </div>

        {!warehouseId ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Warehouse className="h-12 w-12" />
            <p>Izaberite magacin da biste videli stanje sa rezervacijama.</p>
          </div>
        ) : isLoading || whLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TableScrollContainer ref={scrollContainerRef} className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortableHeader label="Šifra" column="article_code" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead><SortableHeader label="Naziv artikla" column="article_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[60px]"><SortableHeader label="JM" column="unit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Na zalihama" column="balance_qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Ukupno rez." column="total_reserved" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Rez. otpr." column="reserved_delivery_notes" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Rez. nal.isp." column="reserved_delivery_orders" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Rez. ostalo" column="reserved_other" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Raspoloživo" column="available_qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Cena" column="unit_price" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Vrednost" column="value" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      {search ? "Nema rezultata za zadati filter." : "Nema podataka za izabrani magacin."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((row) => (
                    <TableRow key={row.article_id}>
                      <TableCell className="font-medium">{row.article_code}</TableCell>
                      <TableCell>{row.article_name}</TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell className="text-right">{formatDecimal(Number(row.balance_qty))}</TableCell>
                      <TableCell className="text-right font-medium">{formatDecimal(Number(row.total_reserved))}</TableCell>
                      <TableCell className="text-right">{formatDecimal(Number(row.reserved_delivery_notes))}</TableCell>
                      <TableCell className="text-right">{formatDecimal(Number(row.reserved_delivery_orders))}</TableCell>
                      <TableCell className="text-right">{formatDecimal(Number(row.reserved_other))}</TableCell>
                      <TableCell className={`text-right font-medium ${Number(row.available_qty) < 0 ? "text-destructive" : ""}`}>
                        {formatDecimal(Number(row.available_qty))}
                      </TableCell>
                      <TableCell className="text-right">{formatPrice(Number(row.unit_price))}</TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(Number(row.balance_qty) * Number(row.unit_price))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {sorted.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-semibold">Ukupno:</TableCell>
                    <TableCell className="text-right font-semibold">{formatDecimal(totals.totalReserved)}</TableCell>
                    <TableCell colSpan={5} />
                    <TableCell className="text-right font-semibold">{formatPrice(totals.balanceValue)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </TableScrollContainer>
        )}
      </div>
    </MainLayout>
  );
}
