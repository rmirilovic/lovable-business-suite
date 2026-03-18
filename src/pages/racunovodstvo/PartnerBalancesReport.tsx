import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
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
import * as XLSX from "xlsx";

interface Props {
  dateMode: DateMode;
  title: string;
}

export default function PartnerBalancesReport({ dateMode, title }: Props) {
  const { selectedYear } = useAuth();
  const currentYear = selectedYear?.year || new Date().getFullYear();

  const [accountPrefix, setAccountPrefix] = useState<string>("204");
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);

  const { data: rows = [], isLoading } = usePartnerBalances(
    accountPrefix,
    dateFrom || null,
    dateTo || null,
    dateMode
  );

  const totals = rows.reduce(
    (acc, r) => ({
      debit: acc.debit + r.debit,
      credit: acc.credit + r.credit,
      balance: acc.balance + r.balance,
    }),
    { debit: 0, credit: 0, balance: 0 }
  );

  const selectedLabel = ACCOUNT_TYPES.find(t => t.code === accountPrefix)?.label || "";

  const handleExportExcel = () => {
    if (!rows.length) return;
    const data = rows.map(r => ({
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
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!rows.length}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
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
                  <TableHead className="w-[80px]">Šifra</TableHead>
                  <TableHead>Naziv partnera</TableHead>
                  <TableHead className="text-right w-[140px]">Duguje</TableHead>
                  <TableHead className="text-right w-[140px]">Potražuje</TableHead>
                  <TableHead className="text-right w-[140px]">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
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
