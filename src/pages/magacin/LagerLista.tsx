import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Warehouse, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [onlyWithTurnover, setOnlyWithTurnover] = useState(false);

  const { warehouses, isLoading: whLoading } = useWarehouses(companyId);
  const { data: inventoryData, isLoading } = useWarehouseInventoryList(
    companyId, warehouseId || undefined, dateFrom || undefined, dateTo || undefined
  );

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);
  const warehouseName = selectedWarehouse ? `${selectedWarehouse.code} — ${selectedWarehouse.name}` : "";

  // Filter
  const filtered = useMemo(() => {
    if (!inventoryData) return [];
    return inventoryData.filter((row) => {
      if (onlyWithTurnover) {
        const hasMovement = Number(row.in_qty) !== 0 || Number(row.out_qty) !== 0;
        if (!hasMovement) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!row.article_code.toLowerCase().includes(q) && !row.article_name.toLowerCase().includes(q)) return false;
      }
      if (!matchesQtyFilter(Number(row.opening_qty), donosFilter)) return false;
      if (!matchesQtyFilter(Number(row.turnover_qty), prometFilter)) return false;
      if (!matchesQtyFilter(Number(row.closing_qty), stanjeFilter)) return false;
      return true;
    });
  }, [inventoryData, search, donosFilter, prometFilter, stanjeFilter, onlyWithTurnover]);

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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pretraži po šifri ili nazivu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Filters Row 2 */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
          <div className="flex items-center gap-2 pb-1">
            <Checkbox
              id="onlyWithTurnover"
              checked={onlyWithTurnover}
              onCheckedChange={(v) => setOnlyWithTurnover(!!v)}
            />
            <label htmlFor="onlyWithTurnover" className="text-sm cursor-pointer select-none">
              Samo sa prometom u periodu
            </label>
          </div>
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
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search ? "Nema rezultata za zadati filter." : "Nema podataka za izabrani period."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((row) => (
                    <TableRow key={row.article_id}>
                      <TableCell className="font-medium">{row.article_code}</TableCell>
                      <TableCell>{row.article_name}</TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell className="text-right">{formatDecimal(Number(row.opening_qty))}</TableCell>
                      <TableCell className="text-right">{formatDecimal(Number(row.in_qty))}</TableCell>
                      <TableCell className="text-right">{formatDecimal(Number(row.out_qty))}</TableCell>
                      <TableCell className="text-right font-medium">{formatDecimal(Number(row.turnover_qty))}</TableCell>
                      <TableCell className="text-right font-medium">{formatDecimal(Number(row.closing_qty))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableScrollContainer>
        )}
      </div>
    </MainLayout>
  );
}
