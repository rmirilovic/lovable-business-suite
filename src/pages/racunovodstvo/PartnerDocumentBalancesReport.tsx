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
import { FileDown, Printer, FileSpreadsheet, Users, FilterX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { formatDecimal } from "@/lib/formatting";
import { format } from "date-fns";
import {
  usePartnerDocumentBalances,
  DOC_ACCOUNT_TYPES,
  type PartnerDocumentRow,
} from "@/hooks/usePartnerDocumentBalances";
import { useTableSort } from "@/hooks/useTableSort";
import {
  exportPartnerDocumentsToPdf,
  printPartnerDocuments,
} from "@/lib/partnerDocumentBalancesExportUtils";
import {
  SmartFilterInput,
  applySmartNumericFilter,
  applySmartDateFilter,
} from "@/components/ui/smart-filter-input";
import * as XLSX from "xlsx";

export default function PartnerDocumentBalancesReport() {
  const { selectedCompany, selectedYear } = useAuth();
  const currentYear = selectedYear?.year || new Date().getFullYear();

  const [accountPrefix, setAccountPrefix] = useState<string>("204");
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);

  // Text filters
  const [filterCode, setFilterCode] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterDoc, setFilterDoc] = useState("");

  // Smart filters (operator typed inline: >100, 50-200, etc.)
  const [filterValuta, setFilterValuta] = useState("");
  const [filterKasni, setFilterKasni] = useState("");
  const [filterDebit, setFilterDebit] = useState("");
  const [filterCredit, setFilterCredit] = useState("");
  const [filterSaldo, setFilterSaldo] = useState("");

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort(
    "partner_code",
    "asc"
  );

  const { data: rows = [], isLoading } = usePartnerDocumentBalances(
    accountPrefix,
    dateFrom || null,
    dateTo || null
  );

  const filtered = rows.filter((r) => {
    if (filterCode && !r.partner_code.toLowerCase().includes(filterCode.toLowerCase()))
      return false;
    if (filterName && !r.partner_name.toLowerCase().includes(filterName.toLowerCase()))
      return false;
    if (filterDoc && !r.document_number.toLowerCase().includes(filterDoc.toLowerCase()))
      return false;
    if (!applySmartDateFilter(r.document_date, filterValuta)) return false;
    if (!applySmartNumericFilter(r.days_overdue ?? -1, filterKasni)) return false;
    if (!applySmartNumericFilter(r.debit, filterDebit)) return false;
    if (!applySmartNumericFilter(r.credit, filterCredit)) return false;
    if (!applySmartNumericFilter(r.saldo, filterSaldo)) return false;
    return true;
  });

  const sorted = sortItems(filtered, (item: PartnerDocumentRow, col: string) => {
    switch (col) {
      case "partner_code": return item.partner_code;
      case "partner_name": return item.partner_name;
      case "document_number": return item.document_number;
      case "document_date": return item.document_date || "";
      case "days_overdue": return item.days_overdue ?? -1;
      case "debit": return item.debit;
      case "credit": return item.credit;
      case "saldo": return item.saldo;
      default: return null;
    }
  });

  const totals = sorted.reduce(
    (acc, r) => ({
      debit: acc.debit + r.debit,
      credit: acc.credit + r.credit,
      saldo: acc.saldo + r.saldo,
    }),
    { debit: 0, credit: 0, saldo: 0 }
  );

  const selectedLabel =
    DOC_ACCOUNT_TYPES.find((t) => t.code === accountPrefix)?.label || "";

  const exportMeta = {
    companyName: selectedCompany?.name || "",
    title: "Dokumenti partnera",
    accountLabel: selectedLabel,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const handleExportExcel = () => {
    if (!sorted.length) return;
    const data = sorted.map((r) => ({
      Šifra: r.partner_code,
      "Naziv partnera": r.partner_name,
      "Broj dokumenta": r.document_number,
      Valuta: r.document_date
        ? format(new Date(r.document_date), "dd.MM.yyyy")
        : "",
      Kasni: r.days_overdue !== null ? r.days_overdue : "-",
      Duguje: Number(r.debit.toFixed(2)),
      Potražuje: Number(r.credit.toFixed(2)),
      Saldo: Number(r.saldo.toFixed(2)),
    }));
    data.push({
      Šifra: "",
      "Naziv partnera": "UKUPNO",
      "Broj dokumenta": "",
      Valuta: "",
      Kasni: "" as any,
      Duguje: Number(totals.debit.toFixed(2)),
      Potražuje: Number(totals.credit.toFixed(2)),
      Saldo: Number(totals.saldo.toFixed(2)),
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 10 },
      { wch: 35 },
      { wch: 18 },
      { wch: 12 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedLabel);
    XLSX.writeFile(wb, `Dokumenti_partnera_${selectedLabel}.xlsx`);
  };

  return (
    <MainLayout title="Dokumenti partnera">
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
                  {DOC_ACCOUNT_TYPES.map((t) => (
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={!sorted.length}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportPartnerDocumentsToPdf(sorted, exportMeta)
                }
                disabled={!sorted.length}
              >
                <FileDown className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => printPartnerDocuments(sorted, exportMeta)}
                disabled={!sorted.length}
              >
                <Printer className="h-4 w-4 mr-1" />
                Štampa
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="erp-card p-8 text-center text-muted-foreground">
            Učitavanje...
          </div>
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
                  <TableHead className="w-[90px]">
                    <SortableHeader column="partner_code" label="Šifra" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="partner_name" label="Naziv partnera" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="w-[160px]">
                    <SortableHeader column="document_number" label="Broj dokumenta" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="w-[100px]">
                    <SortableHeader column="document_date" label="Valuta" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right w-[80px]">
                    <SortableHeader column="days_overdue" label="Kasni" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                  </TableHead>
                  <TableHead className="text-right w-[130px]">
                    <SortableHeader column="debit" label="Duguje" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                  </TableHead>
                  <TableHead className="text-right w-[130px]">
                    <SortableHeader column="credit" label="Potražuje" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                  </TableHead>
                  <TableHead className="text-right w-[130px]">
                    <SortableHeader column="saldo" label="Saldo" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                  </TableHead>
                </TableRow>
                {/* Filter row */}
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-1 top-12 z-20">
                    <Input placeholder="Filter..." value={filterCode} onChange={(e) => setFilterCode(e.target.value)} className="h-7 text-xs" />
                  </TableHead>
                  <TableHead className="py-1 top-12 z-20">
                    <Input placeholder="Filter..." value={filterName} onChange={(e) => setFilterName(e.target.value)} className="h-7 text-xs" />
                  </TableHead>
                  <TableHead className="py-1 top-12 z-20">
                    <Input placeholder="Filter..." value={filterDoc} onChange={(e) => setFilterDoc(e.target.value)} className="h-7 text-xs" />
                  </TableHead>
                  <TableHead className="py-1 top-12 z-20">
                    <SmartFilterInput value={filterValuta} onChange={setFilterValuta} type="date" placeholder=">dd.MM.yyyy" showHelp />
                  </TableHead>
                  <TableHead className="py-1 top-12 z-20">
                    <SmartFilterInput value={filterKasni} onChange={setFilterKasni} type="number" placeholder=">0, 10-30" showHelp />
                  </TableHead>
                  <TableHead className="py-1 top-12 z-20">
                    <SmartFilterInput value={filterDebit} onChange={setFilterDebit} type="number" placeholder=">100" />
                  </TableHead>
                  <TableHead className="py-1 top-12 z-20">
                    <SmartFilterInput value={filterCredit} onChange={setFilterCredit} type="number" placeholder=">100" />
                  </TableHead>
                  <TableHead className="py-1 top-12 z-20">
                    <SmartFilterInput value={filterSaldo} onChange={setFilterSaldo} type="number" placeholder=">0" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">
                      {r.partner_code}
                    </TableCell>
                    <TableCell>{r.partner_name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {r.document_number}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.document_date
                        ? format(new Date(r.document_date), "dd.MM.yyyy")
                        : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {r.days_overdue !== null ? r.days_overdue : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.debit !== 0 ? formatDecimal(r.debit, 2) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.credit !== 0 ? formatDecimal(r.credit, 2) : ""}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono font-medium",
                        r.saldo < 0 && "text-destructive"
                      )}
                    >
                      {formatDecimal(r.saldo, 2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="font-semibold">
                    Ukupno
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatDecimal(totals.debit, 2)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatDecimal(totals.credit, 2)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono font-semibold",
                      totals.saldo < 0 && "text-destructive"
                    )}
                  >
                    {formatDecimal(totals.saldo, 2)}
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
