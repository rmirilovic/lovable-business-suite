import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWarehouseTurnover, type WarehouseTurnoverRow } from "@/hooks/useWarehouseTurnover";
import { useWarehouses } from "@/hooks/useWarehouses";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { formatPrice } from "@/lib/formatting";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { format } from "date-fns";

const DOCUMENT_TYPES = [
  "Prijemnica",
  "Kalkulacija",
  "Nivelacija",
  "Popis - višak",
  "Popis - manjak",
  "MMP - ulaz",
  "MMP - izlaz",
  "Zamena artikla",
  "Otpremnica",
];

export default function PrometMagacina() {
  const { selectedCompany, selectedYear } = useAuth();
  const companyId = selectedCompany?.id;

  // Default date range: Jan 1 of business year to today
  const defaultFrom = selectedYear ? `${selectedYear.year}-01-01` : "";
  const defaultTo = format(new Date(), "yyyy-MM-dd");

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [warehouseFilter, setWarehouseFilter] = useState("__all__");
  const [docTypeFilter, setDocTypeFilter] = useState("__all__");

  const { warehouses } = useWarehouses(companyId);
  const { data: turnoverData, isLoading } = useWarehouseTurnover(
    companyId, dateFrom || undefined, dateTo || undefined
  );

  // Filter
  const filtered = useMemo(() => {
    if (!turnoverData) return [];
    return turnoverData.filter((row) => {
      if (warehouseFilter !== "__all__" && row.warehouse_id !== warehouseFilter) return false;
      if (docTypeFilter !== "__all__" && row.document_type !== docTypeFilter) return false;
      return true;
    });
  }, [turnoverData, warehouseFilter, docTypeFilter]);

  // Sorting
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("warehouse_code", "asc");

  const sorted = useMemo(() => {
    return sortItems(filtered, (item: WarehouseTurnoverRow, column: string) => {
      switch (column) {
        case "warehouse_code": return item.warehouse_code;
        case "warehouse_name": return item.warehouse_name;
        case "document_type": return item.document_type;
        case "debit_value": return item.debit_value;
        case "credit_value": return item.credit_value;
        case "balance_value": return item.balance_value;
        default: return "";
      }
    });
  }, [filtered, sortItems]);

  // Totals
  const totals = useMemo(() => {
    return sorted.reduce(
      (acc, row) => ({
        debit: acc.debit + Number(row.debit_value),
        credit: acc.credit + Number(row.credit_value),
        balance: acc.balance + Number(row.balance_value),
      }),
      { debit: 0, credit: 0, balance: 0 }
    );
  }, [sorted]);

  return (
    <MainLayout title="Promet magacina">
      <div className="flex flex-col h-full min-h-0 gap-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
          <div className="space-y-1">
            <Label className="text-xs">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[170px]" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Magacin</Label>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Svi magacini</SelectItem>
                {warehouses.filter((w) => w.is_active).map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.code} — {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Vrsta dokumenta</Label>
            <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Sve vrste</SelectItem>
                {DOCUMENT_TYPES.map((dt) => (
                  <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TableScrollContainer className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader label="Šifra mag." column="warehouse_code" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Magacin" column="warehouse_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Vrsta dokumenta" column="document_type" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Duguje" column="debit_value" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Potražuje" column="credit_value" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Saldo" column="balance_value" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nema podataka za izabrani period.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((row, idx) => (
                    <TableRow key={`${row.warehouse_id}-${row.document_type}-${idx}`}>
                      <TableCell className="font-medium">{row.warehouse_code}</TableCell>
                      <TableCell>{row.warehouse_name}</TableCell>
                      <TableCell>{row.document_type}</TableCell>
                      <TableCell className="text-right">{formatPrice(Number(row.debit_value))}</TableCell>
                      <TableCell className="text-right">{formatPrice(Number(row.credit_value))}</TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(Number(row.balance_value))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {sorted.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-semibold">Ukupno:</TableCell>
                    <TableCell className="text-right font-semibold">{formatPrice(totals.debit)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatPrice(totals.credit)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatPrice(totals.balance)}</TableCell>
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
