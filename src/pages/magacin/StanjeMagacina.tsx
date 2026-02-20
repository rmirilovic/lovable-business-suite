import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, Warehouse, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useWarehouseStock, type WarehouseStockRow } from "@/hooks/useWarehouseStock";
import { ArticleWarehouseCardDialog } from "@/components/magacin/ArticleWarehouseCardDialog";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { formatPrice, formatDecimal } from "@/lib/formatting";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { exportStockToExcel, exportStockToPdf, printStock } from "@/lib/warehouseExportUtils";
import { toast } from "sonner";

const STORAGE_KEY = "stanje_magacina_view_state";

interface ViewState {
  warehouseId: string;
  dateFrom: string;
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

export default function StanjeMagacina() {
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;

  const { warehouses, isLoading: whLoading } = useWarehouses(companyId);

  const saved = useRef(loadState()).current;

  const [warehouseId, setWarehouseId] = useState<string>(saved.warehouseId || "");
  const [dateFrom, setDateFrom] = useState(saved.dateFrom || "");
  const [dateTo, setDateTo] = useState(saved.dateTo || "");
  const [search, setSearch] = useState(saved.search || "");
  const [exporting, setExporting] = useState(false);
  const scrollRestoredRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(saved.scrollTop ?? 0);

  const {
    data: stockData,
    isLoading: stockLoading,
  } = useWarehouseStock(companyId, warehouseId || undefined, dateFrom || undefined, dateTo || undefined);

  // Selected article for card dialog
  const [selectedArticle, setSelectedArticle] = useState<WarehouseStockRow | null>(null);

  // Get warehouse name for display
  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);
  const warehouseName = selectedWarehouse ? `${selectedWarehouse.code} — ${selectedWarehouse.name}` : "";

  // Filter by search
  const filteredStock = useMemo(() => {
    if (!stockData) return [];
    if (!search) return stockData;
    const q = search.toLowerCase();
    return stockData.filter(
      (row) =>
        row.article_code.toLowerCase().includes(q) ||
        row.article_name.toLowerCase().includes(q)
    );
  }, [stockData, search]);

  // Sorting
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort(
    (saved.sortColumn as any) || "article_code",
    (saved.sortDirection as any) || "asc"
  );

  const sortedData = useMemo(() => {
    return sortItems(filteredStock, (item, column) => {
      switch (column) {
        case "article_code": return item.article_code;
        case "article_name": return item.article_name;
        case "total_in_qty": return item.total_in_qty;
        case "total_in_value": return item.total_in_value;
        case "total_out_qty": return item.total_out_qty;
        case "total_out_value": return item.total_out_value;
        case "balance_qty": return item.balance_qty;
        case "balance_value": return item.balance_value;
        case "unit_price": return item.balance_qty !== 0 ? item.balance_value / item.balance_qty : 0;
        default: return "";
      }
    });
  }, [filteredStock, sortItems]);

  // Persist state on changes
  const persistState = useCallback(() => {
    saveState({
      warehouseId,
      dateFrom,
      dateTo,
      search,
      sortColumn,
      sortDirection,
      scrollTop: lastScrollTopRef.current,
    });
  }, [warehouseId, dateFrom, dateTo, search, sortColumn, sortDirection]);

  useEffect(() => {
    persistState();
  }, [persistState]);

  // Track scroll position continuously
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => { lastScrollTopRef.current = el.scrollTop; };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [stockLoading]);

  // Save scroll position on unmount
  useEffect(() => {
    return () => {
      const prev = loadState();
      saveState({ ...prev, scrollTop: lastScrollTopRef.current });
    };
  }, []);

  // Restore scroll position after data loads
  useEffect(() => {
    if (!stockLoading && sortedData.length > 0 && !scrollRestoredRef.current && saved.scrollTop) {
      scrollRestoredRef.current = true;
      requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo({ top: saved.scrollTop });
      });
    }
  }, [stockLoading, sortedData.length, saved.scrollTop]);

  // Footer totals
  const totals = useMemo(() => {
    return sortedData.reduce(
      (acc, row) => ({
        totalInValue: acc.totalInValue + row.total_in_value,
        totalOutValue: acc.totalOutValue + row.total_out_value,
        balanceValue: acc.balanceValue + row.balance_value,
      }),
      { totalInValue: 0, totalOutValue: 0, balanceValue: 0 }
    );
  }, [sortedData]);

  const exportMeta = { warehouseName, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };

  const handleExcelExport = () => {
    if (sortedData.length === 0) return;
    exportStockToExcel(sortedData, exportMeta);
    toast.success("Excel fajl je kreiran.");
  };

  const handlePdfExport = async () => {
    if (sortedData.length === 0) return;
    setExporting(true);
    try {
      await exportStockToPdf(sortedData, exportMeta, totals);
      toast.success("PDF fajl je kreiran.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    if (sortedData.length === 0) return;
    setExporting(true);
    try {
      await printStock(sortedData, exportMeta, totals);
    } finally {
      setExporting(false);
    }
  };

  return (
    <MainLayout title="Stanje magacina">
      <div className="flex flex-col h-full min-h-0 gap-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Izaberite magacin..." />
            </SelectTrigger>
            <SelectContent>
              {warehouses
                .filter((w) => w.is_active)
                .map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.code} — {wh.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <LocaleDateInput
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="Datum od"
            className="w-[150px]"
          />
          <LocaleDateInput
            value={dateTo}
            onChange={setDateTo}
            placeholder="Datum do"
            className="w-[150px]"
          />

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po šifri ili nazivu artikla..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              autoComplete="off"
            />
          </div>

          {sortedData.length > 0 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={exporting}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handlePdfExport} disabled={exporting}>
                <FileText className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={exporting}>
                <Printer className="h-4 w-4 mr-1" />
                Štampaj
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        {!warehouseId ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Warehouse className="h-12 w-12" />
            <p>Izaberite magacin da biste videli stanje zaliha.</p>
          </div>
        ) : stockLoading || whLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TableScrollContainer ref={scrollContainerRef} className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader label="Šifra" column="article_code" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Naziv artikla" column="article_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="w-[60px]">JM</TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Ulaz kol." column="total_in_qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Duguje" column="total_in_value" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Izlaz kol." column="total_out_qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Potražuje" column="total_out_value" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Stanje kol." column="balance_qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Saldo" column="balance_value" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Cena" column="unit_price" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {search
                        ? "Nema rezultata za zadati filter."
                        : "Nema proknjiženih promena u ovom magacinu."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((row) => (
                    <TableRow
                      key={row.article_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedArticle(row)}
                    >
                      <TableCell className="font-medium">{row.article_code}</TableCell>
                      <TableCell>{row.article_name}</TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.total_in_qty)}</TableCell>
                      <TableCell className="text-right">{formatPrice(row.total_in_value)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.total_out_qty)}</TableCell>
                      <TableCell className="text-right">{formatPrice(row.total_out_value)}</TableCell>
                      <TableCell className="text-right font-medium">{formatDecimal(row.balance_qty)}</TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(row.balance_value)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {row.balance_qty !== 0 ? formatPrice(row.balance_value / row.balance_qty) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {sortedData.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-semibold">
                      Ukupno:
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatPrice(totals.totalInValue)}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold">
                      {formatPrice(totals.totalOutValue)}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold">
                      {formatPrice(totals.balanceValue)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </TableScrollContainer>
        )}
      </div>

      {/* Article Warehouse Card Dialog */}
      {selectedArticle && warehouseId && companyId && (
        <ArticleWarehouseCardDialog
          open={!!selectedArticle}
          onOpenChange={() => setSelectedArticle(null)}
          companyId={companyId}
          warehouseId={warehouseId}
          warehouseName={warehouseName}
          articleId={selectedArticle.article_id}
          articleCode={selectedArticle.article_code}
          articleName={selectedArticle.article_name}
          unit={selectedArticle.unit}
          dateFrom={dateFrom || undefined}
          dateTo={dateTo || undefined}
        />
      )}
    </MainLayout>
  );
}
