import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Warehouse } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useWarehouseStockByVariant, type WarehouseStockByVariantRow } from "@/hooks/useWarehouseStockByVariant";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { formatPrice, formatDecimal } from "@/lib/formatting";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function StanjePoVarijantama() {
  const { selectedCompany, selectedYear } = useAuth();
  const companyId = selectedCompany?.id;
  const { warehouses, isLoading: whLoading } = useWarehouses(companyId);

  const defaultFrom = selectedYear ? `${selectedYear.year}-01-01` : "";
  const yearEnd = selectedYear ? `${selectedYear.year}-12-31` : "";
  const today = format(new Date(), "yyyy-MM-dd");
  const defaultTo = yearEnd && yearEnd < today ? yearEnd : today;

  const [warehouseId, setWarehouseId] = useState("");
  const [dateTo, setDateTo] = useState(defaultTo);
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: stockData, isLoading: stockLoading } = useWarehouseStockByVariant(
    companyId, warehouseId || undefined, undefined, dateTo || undefined
  );

  const filtered = useMemo(() => {
    if (!stockData) return [];
    return stockData.filter((row) => {
      const hasActivity = Number(row.balance_qty) !== 0 || Number(row.total_in_qty) !== 0 || Number(row.total_out_qty) !== 0;
      if (!hasActivity) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return row.article_code.toLowerCase().includes(q) || row.article_name.toLowerCase().includes(q) || row.variant_code.toLowerCase().includes(q) || row.variant_description.toLowerCase().includes(q);
    });
  }, [stockData, search]);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("article_code", "asc");

  const sorted = useMemo(() => {
    return sortItems(filtered, (item, col) => {
      switch (col) {
        case "article_code": return item.article_code;
        case "article_name": return item.article_name;
        case "variant_code": return item.variant_code;
        case "variant_description": return item.variant_description;
        case "balance_qty": return item.balance_qty;
        case "balance_value": return item.balance_value;
        case "total_in_qty": return item.total_in_qty;
        case "total_out_qty": return item.total_out_qty;
        default: return "";
      }
    });
  }, [filtered, sortItems]);

  const totals = useMemo(() => {
    return sorted.reduce(
      (acc, r) => ({
        inValue: acc.inValue + r.total_in_value,
        outValue: acc.outValue + r.total_out_value,
        balanceValue: acc.balanceValue + r.balance_value,
      }),
      { inValue: 0, outValue: 0, balanceValue: 0 }
    );
  }, [sorted]);

  return (
    <MainLayout title="Stanje po varijantama">
      <div className="flex flex-col h-full min-h-0 gap-4">
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
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

          <LocaleDateInput value={dateTo} onChange={setDateTo} placeholder="Datum do" className="w-[150px]" />

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pretraži po šifri, nazivu ili varijanti..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" autoComplete="off" />
          </div>
        </div>

        {!warehouseId ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Warehouse className="h-12 w-12" />
            <p>Izaberite magacin da biste videli stanje po varijantama.</p>
          </div>
        ) : stockLoading || whLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <TableScrollContainer ref={scrollRef} className="flex-1">
            <Table className="table-fixed min-w-[1300px]">
              <colgroup>
                <col className="w-[120px]" />
                <col />
                <col className="w-[100px]" />
                <col className="w-[160px]" />
                <col className="w-[60px]" />
                <col className="w-[100px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[120px]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead><SortableHeader label="Šifra" column="article_code" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead><SortableHeader label="Naziv" column="article_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead><SortableHeader label="Varijanta" column="variant_code" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead><SortableHeader label="Opis varijante" column="variant_description" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead>JM</TableHead>
                  <TableHead className="text-right"><SortableHeader label="Ulaz kol." column="total_in_qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right">Duguje</TableHead>
                  <TableHead className="text-right"><SortableHeader label="Izlaz kol." column="total_out_qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right">Potražuje</TableHead>
                  <TableHead className="text-right"><SortableHeader label="Stanje" column="balance_qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortableHeader label="Saldo" column="balance_value" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">{search ? "Nema rezultata." : "Nema promena."}</TableCell></TableRow>
                ) : (
                  sorted.map((row, i) => (
                    <TableRow key={`${row.article_id}-${row.variant_id || "none"}-${i}`} className="hover:bg-muted/50">
                      <TableCell className="font-medium truncate">{row.article_code}</TableCell>
                      <TableCell className="truncate">{row.article_name}</TableCell>
                      <TableCell>
                        {row.variant_code ? (
                          <Badge variant="outline" className="text-xs">{row.variant_code}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">bez var.</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate">{row.variant_description}</TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.total_in_qty)}</TableCell>
                      <TableCell className="text-right">{formatPrice(row.total_in_value)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.total_out_qty)}</TableCell>
                      <TableCell className="text-right">{formatPrice(row.total_out_value)}</TableCell>
                      <TableCell className="text-right font-medium">{formatDecimal(row.balance_qty)}</TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(row.balance_value)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {sorted.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={6} className="text-right font-semibold">Ukupno:</TableCell>
                    <TableCell className="text-right font-semibold">{formatPrice(totals.inValue)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold">{formatPrice(totals.outValue)}</TableCell>
                    <TableCell />
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
