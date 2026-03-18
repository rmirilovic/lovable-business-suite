import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Button } from "@/components/ui/button";
import { FileDown, Printer, FileSpreadsheet, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { formatDecimal } from "@/lib/formatting";
import {
  usePartnerBalances,
  ACCOUNT_TYPES,
  type DateMode,
  type PartnerBalanceRow,
} from "@/hooks/usePartnerBalances";
import { useTableSort } from "@/hooks/useTableSort";
import { exportPartnerBalancesToPdf, printPartnerBalances } from "@/lib/partnerBalancesExportUtils";
import * as XLSX from "xlsx";

interface Props {
  dateMode: DateMode;
  title: string;
}

export default function PartnerBalancesReport({ dateMode, title }: Props) {
  const { selectedCompany, selectedYear } = useAuth();
  const currentYear = selectedYear?.year || new Date().getFullYear();

  const [accountPrefix, setAccountPrefix] = useState<string>("204");
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);

  // Column filters
  const [filterCode, setFilterCode] = useState("");
  const [filterName, setFilterName] = useState("");

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("partner_code", "asc");

  const { data: rows = [], isLoading } = usePartnerBalances(
    accountPrefix,
    dateFrom || null,
    dateTo || null,
    dateMode
  );

  // Apply filters
  const filtered = rows.filter((r) => {
    if (filterCode && !r.partner_code.toLowerCase().includes(filterCode.toLowerCase())) return false;
    if (filterName && !r.partner_name.toLowerCase().includes(filterName.toLowerCase())) return false;
    return true;
  });

  // Apply sort
  const sorted = sortItems(filtered, (item: PartnerBalanceRow, col: string) => {
    switch (col) {
      case "partner_code": return item.partner_code;
      case "partner_name": return item.partner_name;
      case "debit": return item.debit;
      case "credit": return item.credit;
      case "balance": return item.balance;
      default: return null;
    }
  });

  const totals = sorted.reduce(
    (acc, r) => ({
      debit: acc.debit + r.debit,
      credit: acc.credit + r.credit,
      balance: acc.balance + r.balance,
    }),
    { debit: 0, credit: 0, balance: 0 }
  );

  const selectedLabel = ACCOUNT_TYPES.find(t => t.code === accountPrefix)?.label || "";

  const exportMeta = {
    companyName: selectedCompany?.name || "",
    title,
    accountLabel: selectedLabel,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const handleExportExcel = () => {
    if (!sorted.length) return;
    const data = sorted.map(r => ({
      "Šifra": r.partner_code,
      "Naziv partnera": r.partner_name,
      "Duguje": Number(r.debit.toFixed(2)),
      "Potražuje": Number(r.credit.toFixed(2)),
      "Saldo": Number(r.balance.toFixed(2)),
    }));
    data.push({
      "Šifra": "",
      "Naziv partnera": "UKUPNO",
      "Duguje": Number(totals.debit.toFixed(2)),
      "Potražuje": Number(totals.credit.toFixed(2)),
      "Saldo": Number(totals.balance.toFixed(2)),
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 10 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedLabel);
    XLSX.writeFile(wb, `${title.replace(/\s+/g, "_")}_${selectedLabel}.xlsx`);
  };

  return (
    <MainLayout title={title}>
      <div className="flex flex-col h-full gap-4">
        {/* Filters */}
        <div className="erp-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Vrsta</Label>
              <Select value={accountPrefix} onValueChange={setAccountPrefix}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.label} ({t.code}*)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Datum od</Label>
              <LocaleDateInput value={dateFrom} onChange={setDateFrom} />
            </div>

            <div className="space-y-2">
              <Label>Datum do</Label>
              <LocaleDateInput value={dateTo} onChange={setDateTo} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!sorted.length}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportPartnerBalancesToPdf(sorted, exportMeta)} disabled={!sorted.length}>
                <FileDown className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => printPartnerBalances(sorted, exportMeta)} disabled={!sorted.length}>
                <Printer className="h-4 w-4 mr-1" />
                Štampa
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="erp-card p-8 text-center text-muted-foreground">Učitavanje...</div>
        ) : rows.length === 0 ? (
          <div className="erp-card p-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nema podataka za izabrane parametre</p>
          </div>
        ) : (
          <TableScrollContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">
                    <SortableHeader column="partner_code" label="Šifra" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="partner_name" label="Naziv partnera" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right w-[140px]">
                    <SortableHeader column="debit" label="Duguje" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                  </TableHead>
                  <TableHead className="text-right w-[140px]">
                    <SortableHeader column="credit" label="Potražuje" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                  </TableHead>
                  <TableHead className="text-right w-[140px]">
                    <SortableHeader column="balance" label="Saldo" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                  </TableHead>
                </TableRow>
                {/* Column filters row */}
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-1 top-12 z-20">
                    <Input
                      placeholder="Filter..."
                      value={filterCode}
                      onChange={(e) => setFilterCode(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </TableHead>
                  <TableHead className="py-1 top-12 z-20">
                    <Input
                      placeholder="Filter..."
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </TableHead>
                  <TableHead className="top-12 z-20" />
                  <TableHead className="top-12 z-20" />
                  <TableHead className="top-12 z-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(r => (
                  <TableRow key={r.partner_id}>
                    <TableCell className="font-mono text-sm">{r.partner_code}</TableCell>
                    <TableCell>{r.partner_name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {r.debit !== 0 ? formatDecimal(r.debit, 2) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.credit !== 0 ? formatDecimal(r.credit, 2) : ""}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono font-medium",
                        r.balance < 0 && "text-destructive"
                      )}
                    >
                      {formatDecimal(r.balance, 2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">Ukupno</TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatDecimal(totals.debit, 2)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatDecimal(totals.credit, 2)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono font-semibold",
                      totals.balance < 0 && "text-destructive"
                    )}
                  >
                    {formatDecimal(totals.balance, 2)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableScrollContainer>
        )}
      </div>
    </MainLayout>
  );
}
