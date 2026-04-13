import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import React from "react";
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
import { Search, Loader2, Warehouse, FileSpreadsheet, FileText, Printer, ChevronRight, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useWarehouseStock, type WarehouseStockRow } from "@/hooks/useWarehouseStock";
import { ArticleWarehouseCardDialog } from "@/components/magacin/ArticleWarehouseCardDialog";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { formatPrice, formatDecimal } from "@/lib/formatting";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { format } from "date-fns";
import { exportStockToExcel, exportStockToPdf, printStock } from "@/lib/warehouseExportUtils";
import { toast } from "sonner";
import { BarcodeScannerButton } from "@/components/sifarnici/BarcodeScannerButton";
import { supabase } from "@/integrations/supabase/client";

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

interface VariantStockRow {
  variant_id: string | null;
  variant_code: string;
  variant_description: string;
  total_in_qty: number;
  total_in_value: number;
  total_out_qty: number;
  total_out_value: number;
  balance_qty: number;
  balance_value: number;
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
  const { selectedCompany, selectedYear } = useAuth();
  const companyId = selectedCompany?.id;

  const { warehouses, isLoading: whLoading } = useWarehouses(companyId);

  const saved = useRef(loadState()).current;

  const defaultFrom = selectedYear ? `${selectedYear.year}-01-01` : "";
  const yearEnd = selectedYear ? `${selectedYear.year}-12-31` : "";
  const today = format(new Date(), "yyyy-MM-dd");
  const defaultTo = yearEnd && yearEnd < today ? yearEnd : today;

  const [warehouseId, setWarehouseId] = useState<string>(saved.warehouseId || "");
  const [dateFrom, setDateFrom] = useState(saved.dateFrom || defaultFrom);
  const [dateTo, setDateTo] = useState(saved.dateTo || defaultTo);
  const [search, setSearch] = useState(saved.search || "");
  const [exporting, setExporting] = useState(false);
  const scrollRestoredRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(saved.scrollTop ?? 0);

  const {
    data: stockData,
    isLoading: stockLoading,
  } = useWarehouseStock(companyId, warehouseId || undefined, undefined, dateTo || undefined);

  // Selected article for card dialog
  const [selectedArticle, setSelectedArticle] = useState<WarehouseStockRow | null>(null);

  // Expandable variant rows
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());
  const [variantStockByArticle, setVariantStockByArticle] = useState<Record<string, VariantStockRow[]>>({});
  const [articlesWithVariants, setArticlesWithVariants] = useState<Set<string>>(new Set());

  // Fetch which articles have variant assignments
  useEffect(() => {
    if (!companyId) return;
    const fetchArticleIdsWithVariants = async () => {
      try {
        const ids = new Set<string>();
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("article_variant_assignments")
            .select("article_id")
            .eq("company_id", companyId)
            .range(from, from + 999);
          if (error) break;
          if (!data || data.length === 0) break;
          data.forEach((d: any) => ids.add(d.article_id));
          if (data.length < 1000) break;
          from += 1000;
        }
        setArticlesWithVariants(ids);
      } catch (err) {
        console.error("Error fetching variant assignments:", err);
      }
    };
    fetchArticleIdsWithVariants();
  }, [companyId]);

  const toggleArticleExpand = async (articleId: string) => {
    setExpandedArticles(prev => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
        // Fetch variant stock if not already loaded
        if (!variantStockByArticle[articleId] && companyId && warehouseId) {
          supabase.rpc("get_warehouse_stock_by_variant", {
            p_company_id: companyId,
            p_warehouse_id: warehouseId,
            p_date_from: dateFrom || null,
            p_date_to: dateTo || null,
          }).then(({ data, error }) => {
            if (error) {
              console.error("Error fetching variant stock:", error);
              return;
            }
            const rows = ((data as any[]) || [])
              .filter((r: any) => r.article_id === articleId)
              .map((r: any) => ({
                variant_id: r.variant_id,
                variant_code: r.variant_code || "",
                variant_description: r.variant_description || "",
                total_in_qty: r.total_in_qty,
                total_in_value: r.total_in_value,
                total_out_qty: r.total_out_qty,
                total_out_value: r.total_out_value,
                balance_qty: r.balance_qty,
                balance_value: r.balance_value,
              }))
              .sort((a, b) => a.variant_code.localeCompare(b.variant_code, "sr"));
            setVariantStockByArticle(prev => ({ ...prev, [articleId]: rows }));
          });
        }
      }
      return next;
    });
  };

  // Clear cached variant stock when filters change
  useEffect(() => {
    setExpandedArticles(new Set());
    setVariantStockByArticle({});
  }, [warehouseId, dateFrom, dateTo]);

  // Get warehouse name for display
  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);
  const warehouseName = selectedWarehouse ? `${selectedWarehouse.code} — ${selectedWarehouse.name}` : "";

  // Filter by search
  const filteredStock = useMemo(() => {
    if (!stockData) return [];
    return stockData.filter((row) => {
      const hasActivity = Number(row.total_in_qty) !== 0 || Number(row.total_out_qty) !== 0 || Number(row.balance_qty) !== 0;
      if (!hasActivity) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        row.article_code.toLowerCase().includes(q) ||
        row.article_name.toLowerCase().includes(q)
      );
    });
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
          <BarcodeScannerButton onScan={(code) => setSearch(code)} />

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
            <Table className="table-fixed min-w-[1250px]">
              <colgroup>
                <col className="w-[32px]" />
                <col className="w-[140px]" />
                <col />
                <col className="w-[60px]" />
                <col className="w-[110px]" />
                <col className="w-[120px]" />
                <col className="w-[110px]" />
                <col className="w-[120px]" />
                <col className="w-[110px]" />
                <col className="w-[120px]" />
                <col className="w-[110px]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[32px]"></TableHead>
                  <TableHead>
                    <SortableHeader label="Šifra" column="article_code" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Naziv artikla" column="article_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>JM</TableHead>
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
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      {search
                        ? "Nema rezultata za zadati filter."
                        : "Nema proknjiženih promena u ovom magacinu."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((row) => {
                    const hasVariants = articlesWithVariants.has(row.article_id);
                    const isExpanded = expandedArticles.has(row.article_id);
                    const variantRows = variantStockByArticle[row.article_id];

                    return (
                      <React.Fragment key={row.article_id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedArticle(row)}
                        >
                          <TableCell className="px-1" onClick={(e) => e.stopPropagation()}>
                            {hasVariants && (
                              <button
                                className="p-1 rounded hover:bg-secondary transition-colors"
                                onClick={() => toggleArticleExpand(row.article_id)}
                                title="Prikaži varijante"
                              >
                                {isExpanded
                                  ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                }
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="font-medium truncate">{row.article_code}</TableCell>
                          <TableCell className="truncate">{row.article_name}</TableCell>
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
                        {isExpanded && (
                          !variantRows ? (
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={11} className="py-2 text-center text-xs text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin inline mr-1" />Učitavanje varijanti...
                              </TableCell>
                            </TableRow>
                          ) : variantRows.length === 0 ? (
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={11} className="py-2 pl-12 text-xs text-muted-foreground">
                                Nema stanja po varijantama
                              </TableCell>
                            </TableRow>
                          ) : variantRows.map((v, vi) => (
                            <TableRow key={v.variant_id || vi} className="bg-muted/20 border-t border-border/50">
                              <TableCell />
                              <TableCell className="pl-6 font-mono text-xs text-muted-foreground">{v.variant_code}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{v.variant_description}</TableCell>
                              <TableCell />
                              <TableCell className="text-right text-xs text-muted-foreground">{formatDecimal(v.total_in_qty)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{formatPrice(v.total_in_value)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{formatDecimal(v.total_out_qty)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{formatPrice(v.total_out_value)}</TableCell>
                              <TableCell className="text-right text-xs font-medium text-muted-foreground">{formatDecimal(v.balance_qty)}</TableCell>
                              <TableCell className="text-right text-xs font-medium text-muted-foreground">{formatPrice(v.balance_value)}</TableCell>
                              <TableCell className="text-right text-xs font-medium text-muted-foreground">
                                {v.balance_qty !== 0 ? formatPrice(v.balance_value / v.balance_qty) : "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
              {sortedData.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-semibold">
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

      {/* Article Warehouse Card Dialog - always rendered to prevent unmount on tab switch */}
      <ArticleWarehouseCardDialog
        open={!!selectedArticle}
        onOpenChange={(open) => { if (!open) setSelectedArticle(null); }}
        companyId={companyId || ""}
        warehouseId={warehouseId}
        warehouseName={warehouseName}
        articleId={selectedArticle?.article_id || ""}
        articleCode={selectedArticle?.article_code || ""}
        articleName={selectedArticle?.article_name || ""}
        unit={selectedArticle?.unit || ""}
        dateFrom={dateFrom || undefined}
        dateTo={dateTo || undefined}
      />
    </MainLayout>
  );
}
