import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Download, CalendarIcon } from "lucide-react";
import { format, startOfYear } from "date-fns";
import { sr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/formatting";
import { useAccountCard } from "@/hooks/useAccountCard";
import { useAuth } from "@/contexts/AuthContext";

interface AccountCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountCode: string;
  accountName: string;
}

export function AccountCardDialog({
  open,
  onOpenChange,
  accountCode,
  accountName,
}: AccountCardDialogProps) {
  const { selectedYear } = useAuth();
  
  // Initialize dates based on business year
  const getInitialDateFrom = () => {
    if (selectedYear?.year) {
      return `${selectedYear.year}-01-01`;
    }
    return new Date().getFullYear() + "-01-01";
  };
  
  const getInitialDateTo = () => {
    return new Date().toISOString().split("T")[0];
  };

  const [dateFrom, setDateFrom] = useState<string>(getInitialDateFrom());
  const [dateTo, setDateTo] = useState<string>(getInitialDateTo());
  const [analyticsFilter, setAnalyticsFilter] = useState<string>("__all__");

  // Reset dates when dialog opens or year changes
  useEffect(() => {
    if (open) {
      setDateFrom(getInitialDateFrom());
      setDateTo(getInitialDateTo());
      setAnalyticsFilter("__all__");
    }
  }, [open, selectedYear?.year]);

  // Map UI filter value to actual filter value for hook
  const actualAnalyticsFilter = analyticsFilter === "__all__" ? null : analyticsFilter;

  const { data, isLoading } = useAccountCard(
    open ? accountCode : null,
    dateFrom || null,
    dateTo || null,
    actualAnalyticsFilter
  );

  // Get unique analytics values from hook data (before filtering)
  const analyticsOptions = data?.allAnalytics || [];

  // Calculate running balance
  const itemsWithBalance = useMemo(() => {
    if (!data?.items) return [];
    let balance = data.openingBalance;
    return data.items.map((item) => {
      balance += item.debit_amount - item.credit_amount;
      return { ...item, balance };
    });
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Kartica konta: {accountCode} - {accountName}
          </DialogTitle>
        </DialogHeader>

        {/* Date and Analytics filters */}
        <div className="grid grid-cols-4 gap-4 py-2">
          <div className="space-y-1">
            <Label className="text-sm">Datum od</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom
                    ? format(new Date(dateFrom), "dd.MM.yyyy", { locale: sr })
                    : "Izaberite datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom ? new Date(dateFrom) : undefined}
                  onSelect={(date) =>
                    setDateFrom(date?.toISOString().split("T")[0] || "")
                  }
                  locale={sr}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Datum do</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo
                    ? format(new Date(dateTo), "dd.MM.yyyy", { locale: sr })
                    : "Izaberite datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo ? new Date(dateTo) : undefined}
                  onSelect={(date) =>
                    setDateTo(date?.toISOString().split("T")[0] || "")
                  }
                  locale={sr}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Analitika</Label>
            <Select
              value={analyticsFilter}
              onValueChange={setAnalyticsFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sve analitike" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Sve analitike</SelectItem>
                {analyticsOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Izvezi
            </Button>
          </div>
        </div>

        {/* Summary */}
        {data && (
          <div className="grid grid-cols-4 gap-4 text-sm border-y py-2">
            <div>
              <span className="text-muted-foreground">Početno stanje:</span>{" "}
              <span className="font-mono font-medium">
                {formatNumber(data.openingBalance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Duguje:</span>{" "}
              <span className="font-mono font-medium text-green-600">
                {formatNumber(data.totalDebit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Potražuje:</span>{" "}
              <span className="font-mono font-medium text-red-600">
                {formatNumber(data.totalCredit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Krajnje stanje:</span>{" "}
              <span className={`font-mono font-medium ${data.closingBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatNumber(data.closingBalance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Datum</TableHead>
                <TableHead className="w-[90px]">Valuta</TableHead>
                <TableHead className="w-[70px]">Nalog</TableHead>
                <TableHead className="w-[100px]">Dokument</TableHead>
                <TableHead className="w-[80px]">Analitika</TableHead>
                <TableHead>Partner / Opis</TableHead>
                <TableHead className="w-[100px] text-right">Duguje</TableHead>
                <TableHead className="w-[100px] text-right">Potražuje</TableHead>
                <TableHead className="w-[100px] text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : itemsWithBalance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nema stavki za prikaz
                  </TableCell>
                </TableRow>
              ) : (
                itemsWithBalance.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{format(new Date(item.entry_date), "dd.MM.yyyy")}</TableCell>
                    <TableCell>
                      {item.document_date ? format(new Date(item.document_date), "dd.MM.yyyy") : "-"}
                    </TableCell>
                    <TableCell className="font-medium">{item.entry_number}</TableCell>
                    <TableCell>{item.document_number || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.analytics || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {item.partner_name && (
                          <span className="font-medium">{item.partner_name}</span>
                        )}
                        {item.description && (
                          <span className={item.partner_name ? "text-sm text-muted-foreground" : ""}>
                            {item.description}
                          </span>
                        )}
                        {!item.partner_name && !item.description && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.debit_amount > 0
                        ? formatNumber(item.debit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.credit_amount > 0
                        ? formatNumber(item.credit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : ""}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-medium ${
                        item.balance >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatNumber(item.balance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {data && itemsWithBalance.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-medium">
                    Ukupno:
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatNumber(data.totalDebit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatNumber(data.totalCredit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-bold ${
                      data.closingBalance >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatNumber(data.closingBalance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
