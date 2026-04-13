import { useState, useMemo, useEffect } from "react";
import React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Warehouse, FileSpreadsheet, FileText, Printer, ChevronRight, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useWarehouseInventoryList, type InventoryListRow } from "@/hooks/useWarehouseInventoryList";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { formatDecimal } from "@/lib/formatting";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { format } from "date-fns";
import { exportInventoryListToExcel, exportInventoryListToPdf, printInventoryList } from "@/lib/inventoryListExportUtils";
import { toast } from "sonner";
import { ArticleWarehouseCardDialog } from "@/components/magacin/ArticleWarehouseCardDialog";
import { BarcodeScannerButton } from "@/components/sifarnici/BarcodeScannerButton";
import { supabase } from "@/integrations/supabase/client";

type QtyFilter = "__all__" | "positive" | "negative" | "zero" | "nonzero";

const QTY_FILTER_OPTIONS: { value: QtyFilter; label: string }[] = [
  { value: "__all__", label: "Sve" },
  { value: "positive", label: "> 0" },
  { value: "negative", label: "< 0" },
  { value: "zero", label: "= 0" },
  { value: "nonzero", label: "≠ 0" },
];

function matchesQtyFilter(value: number, filter: QtyFilter): boolean {
  switch (filter) {
    case "positive": return value > 0;
    case "negative": return value < 0;
    case "zero": return value === 0;
    case "nonzero": return value !== 0;
    default: return true;
  }
}

interface VariantStockRow {
  variant_id: string | null;
  variant_code: string;
  variant_description: string;
  total_in_qty: number;
  total_out_qty: number;
  balance_qty: number;
}

export default function LagerLista() {
  const { selectedCompany, selectedYear } = useAuth();
  const companyId = selectedCompany?.id;

  const defaultFrom = selectedYear ? `${selectedYear.year}-01-01` : "";
  const yearEnd = selectedYear ? `${selectedYear.year}-12-31` : "";
  const today = format(new Date(), "yyyy-MM-dd");
  const defaultTo = yearEnd && yearEnd < today ? yearEnd : today;

  const [warehouseId, setWarehouseId] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [search, setSearch] = useState("");
  const [donosFilter, setDonosFilter] = useState<QtyFilter>("__all__");
  const [prometFilter, setPrometFilter] = useState<QtyFilter>("__all__");
  const [stanjeFilter, setStanjeFilter] = useState<QtyFilter>("__all__");
  const [exporting, setExporting] = useState(false);
  const [cardArticle, setCardArticle] = useState<InventoryListRow | null>(null);

  // Expandable variant rows
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());
  const [variantStockByArticle, setVariantStockByArticle] = useState<Record<string, VariantStockRow[]>>({});
  const [articlesWithVariants, setArticlesWithVariants] = useState<Set<string>>(new Set());

  const { warehouses, isLoading: whLoading } = useWarehouses(companyId);
  const { data: inventoryData, isLoading } = useWarehouseInventoryList(
    companyId, warehouseId || undefined, dateFrom || undefined, dateTo || undefined
  );

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);
  const warehouseName = selectedWarehouse ? `${selectedWarehouse.code} — ${selectedWarehouse.name}` : "";

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
                total_out_qty: r.total_out_qty,
                balance_qty: r.balance_qty,
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

  // Filter
  const filtered = useMemo(() => {
    if (!inventoryData) return [];
    return inventoryData.filter((row) => {
      const hasActivity = Number(row.in_qty) !== 0 || Number(row.out_qty) !== 0 || Number(row.opening_qty) !== 0;
      if (!hasActivity) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!row.article_code.toLowerCase().includes(q) && !row.article_name.toLowerCase().includes(q)) return false;
      }
      if (!matchesQtyFilter(Number(row.opening_qty), donosFilter)) return false;
      if (!matchesQtyFilter(Number(row.turnover_qty), prometFilter)) return false;
      if (!matchesQtyFilter(Number(row.closing_qty), stanjeFilter)) return false;
      return true;
    });
  }, [inventoryData, search, donosFilter, prometFilter, stanjeFilter]);

  // Sorting
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("article_code", "asc");

  const sorted = useMemo(() => {
    return sortItems(filtered, (item: InventoryListRow, column: string) => {
      switch (column) {
        case "article_code": return item.article_code;
        case "article_name": return item.article_name;
        case "unit": return item.unit;
        case "opening_qty": return Number(item.opening_qty);
        case "in_qty": return Number(item.in_qty);
        case "out_qty": return Number(item.out_qty);
        case "turnover_qty": return Number(item.turnover_qty);
        case "closing_qty": return Number(item.closing_qty);
        default: return "";
      }
    });
  }, [filtered, sortItems]);

  const exportMeta = { warehouseName, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };

  const handleExcelExport = () => {
    if (sorted.length === 0) return;
    exportInventoryListToExcel(sorted, exportMeta);
    toast.success("Excel fajl je kreiran.");
  };

  const handlePdfExport = async () => {
    if (sorted.length === 0) return;
    setExporting(true);
    try {
      await exportInventoryListToPdf(sorted, exportMeta);
      toast.success("PDF fajl je kreiran.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    if (sorted.length === 0) return;
    setExporting(true);
    try {
      await printInventoryList(sorted, exportMeta);
    } finally {
      setExporting(false);
    }
  };

  return (
    <MainLayout title="Lager lista">
      <div className="flex flex-col h-full min-h-0 gap-4">
        {/* Filters Row 1 */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
          <div className="space-y-1">
            <Label className="text-xs">Magacin</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Izaberite magacin..." />
              </SelectTrigger>
              <SelectContent>
                {warehouses.filter((w) => w.is_active).map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.code} — {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[170px]" />
          </div>

          <div className="relative flex-1 min-w-[200px] space-y-1">
            <Label className="text-xs">Artikal</Label>
            <div className="relative flex gap-2 items-end">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pretraži po šifri ili nazivu..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <BarcodeScannerButton onScan={(code) => setSearch(code)} />
            </div>
          </div>
        </div>

        {/* Filters Row 2 */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
          <div className="space-y-1">
            <Label className="text-xs">Donos</Label>
            <Select value={donosFilter} onValueChange={(v) => setDonosFilter(v as QtyFilter)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QTY_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Promet</Label>
            <Select value={prometFilter} onValueChange={(v) => setPrometFilter(v as QtyFilter)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QTY_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Stanje</Label>
            <Select value={stanjeFilter} onValueChange={(v) => setStanjeFilter(v as QtyFilter)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QTY_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sorted.length > 0 && (
            <div className="flex items-center gap-1 ml-auto">
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

        {/* Table */}
        {!warehouseId ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Warehouse className="h-12 w-12" />
            <p>Izaberite magacin da biste videli lager listu.</p>
          </div>
        ) : isLoading || whLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TableScrollContainer className="flex-1">
            <Table className="min-w-[1050px] table-fixed">
              <colgroup>
                <col className="w-[32px]" />
                <col className="w-[140px]" />
                <col />
                <col className="w-[60px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
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
                  <TableHead className="w-[60px]">
                    <SortableHeader label="JM" column="unit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Donos" column="opening_qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Ulaz" column="in_qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Izlaz" column="out_qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Promet" column="turnover_qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Stanje" column="closing_qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {search ? "Nema rezultata za zadati filter." : "Nema podataka za izabrani period."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((row) => {
                    const hasVariants = articlesWithVariants.has(row.article_id);
                    const isExpanded = expandedArticles.has(row.article_id);
                    const variantRows = variantStockByArticle[row.article_id];

                    return (
                      <React.Fragment key={row.article_id}>
                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setCardArticle(row)}>
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
                          <TableCell className="font-medium">{row.article_code}</TableCell>
                          <TableCell>{row.article_name}</TableCell>
                          <TableCell>{row.unit}</TableCell>
                          <TableCell className="text-right">{formatDecimal(Number(row.opening_qty))}</TableCell>
                          <TableCell className="text-right">{formatDecimal(Number(row.in_qty))}</TableCell>
                          <TableCell className="text-right">{formatDecimal(Number(row.out_qty))}</TableCell>
                          <TableCell className="text-right font-medium">{formatDecimal(Number(row.turnover_qty))}</TableCell>
                          <TableCell className="text-right font-medium">{formatDecimal(Number(row.closing_qty))}</TableCell>
                        </TableRow>
                        {isExpanded && (
                          !variantRows ? (
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={9} className="py-2 text-center text-xs text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin inline mr-1" />Učitavanje varijanti...
                              </TableCell>
                            </TableRow>
                          ) : variantRows.length === 0 ? (
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={9} className="py-2 pl-12 text-xs text-muted-foreground">
                                Nema stanja po varijantama
                              </TableCell>
                            </TableRow>
                          ) : variantRows.map((v, vi) => (
                            <TableRow key={v.variant_id || vi} className="bg-muted/20 border-t border-border/50">
                              <TableCell />
                              <TableCell className="pl-6 font-mono text-xs text-muted-foreground">{v.variant_code}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{v.variant_description}</TableCell>
                              <TableCell />
                              <TableCell />
                              <TableCell className="text-right text-xs text-muted-foreground">{formatDecimal(v.total_in_qty)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{formatDecimal(v.total_out_qty)}</TableCell>
                              <TableCell className="text-right text-xs font-medium text-muted-foreground">{formatDecimal(v.total_in_qty - v.total_out_qty)}</TableCell>
                              <TableCell className="text-right text-xs font-medium text-muted-foreground">{formatDecimal(v.balance_qty)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableScrollContainer>
        )}
        <ArticleWarehouseCardDialog
          open={!!cardArticle}
          onOpenChange={(open) => { if (!open) setCardArticle(null); }}
          companyId={companyId || ""}
          warehouseId={warehouseId || ""}
          warehouseName={warehouseName}
          articleId={cardArticle?.article_id || ""}
          articleCode={cardArticle?.article_code || ""}
          articleName={cardArticle?.article_name || ""}
          unit={cardArticle?.unit || ""}
          dateFrom={dateFrom || undefined}
          dateTo={dateTo || undefined}
        />
      </div>
    </MainLayout>
  );
}
