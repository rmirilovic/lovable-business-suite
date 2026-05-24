import { useState, useMemo, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
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
import { Loader2, Download, CalendarIcon, Printer, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/formatting";
import { useAccountCard } from "@/hooks/useAccountCard";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useAccountsWithEntries } from "@/hooks/useAccountsWithEntries";
import { useAuth } from "@/contexts/AuthContext";

export default function KarticaKonta() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedYear, selectedCompany } = useAuth();
  const { data: accounts = [] } = useChartOfAccounts();
  const { data: accountsWithEntries = [] } = useAccountsWithEntries();
  const entryCountByCode = useMemo(() => {
    const map = new Map<string, number>();
    accountsWithEntries.forEach((a) => map.set(a.code, a.count));
    return map;
  }, [accountsWithEntries]);

  // Get account name from code
  const account = accounts.find((a) => a.code === code);
  const accountName = account?.name || code || "";

  // Initialize dates from URL params or defaults
  const getInitialDateFrom = () => {
    const paramDate = searchParams.get("from");
    if (paramDate) return paramDate;
    if (selectedYear?.year) return `${selectedYear.year}-01-01`;
    return new Date().getFullYear() + "-01-01";
  };

  const getInitialDateTo = () => {
    const paramDate = searchParams.get("to");
    if (paramDate) return paramDate;
    return new Date().toISOString().split("T")[0];
  };

  const [dateFrom, setDateFrom] = useState<string>(getInitialDateFrom());
  const [dateTo, setDateTo] = useState<string>(getInitialDateTo());
  const [analyticsFilter, setAnalyticsFilter] = useState<string>("__all__");
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>("");

  // Update document title
  useEffect(() => {
    if (code) {
      document.title = `Kartica konta ${code} - ${accountName}`;
    }
    return () => {
      document.title = "Mini ERP";
    };
  }, [code, accountName]);

  // Map UI filter value to actual filter value for hook
  const actualAnalyticsFilter = analyticsFilter === "__all__" ? null : analyticsFilter;

  const { data, isLoading } = useAccountCard(
    code || null,
    dateFrom || null,
    dateTo || null,
    actualAnalyticsFilter
  );

  // Get unique analytics values from hook data
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

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    const ref = searchParams.get("ref");
    if (ref === "menu") {
      navigate("/");
      return;
    }
    // Podrazumevano vrati se u Glavnu knjigu
    const params = new URLSearchParams();
    const accountParam = searchParams.get("account");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    if (accountParam) params.set('account', accountParam);
    if (fromParam) params.set('from', fromParam);
    if (toParam) params.set('to', toParam);
    navigate(`/racunovodstvo/glavna-knjiga${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const contextReady = !!selectedCompany && !!selectedYear;

  if (!code) {
    const postingAccounts = accounts.filter(
      (a) => a.is_posting_allowed && entryCountByCode.has(a.code)
    );
    return (
      <MainLayout title="Kartica konta">
        <div className="flex-1 min-h-0 overflow-auto flex items-start justify-center pt-16">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Izaberite konto</h2>
              <p className="text-muted-foreground text-sm">
                Odaberite konto i period za prikaz kartice
              </p>
            </div>
            <div className="border rounded-lg p-6 space-y-4 bg-card">
              <div className="space-y-2">
                <Label>Konto</Label>
                <Select value={selectedAccountCode} onValueChange={setSelectedAccountCode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite konto" />
                  </SelectTrigger>
                  <SelectContent>
                    {postingAccounts.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        Nema konta sa uknjiženim promenama
                      </div>
                    ) : (
                      postingAccounts.map((a) => (
                        <SelectItem key={a.code} value={a.code}>
                          <span className="flex items-center justify-between w-full gap-4">
                            <span>{a.code} - {a.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({entryCountByCode.get(a.code)} prom.)
                            </span>
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Datum od</Label>
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
              <div className="space-y-2">
                <Label>Datum do</Label>
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
              <Button
                className="w-full"
                disabled={!selectedAccountCode}
                onClick={() => {
                  const params = new URLSearchParams();
                  if (dateFrom) params.set("from", dateFrom);
                  if (dateTo) params.set("to", dateTo);
                  params.set("ref", "menu");
                  navigate(`/racunovodstvo/kartica-konta/${selectedAccountCode}?${params.toString()}`);
                }}
              >
                Prikaži karticu
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!contextReady) {
    return (
      <MainLayout title={`Kartica konta: ${code}`}> 
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-muted-foreground">Učitavanje...</div>
        </div>
      </MainLayout>
    );
  }
  return (
    <MainLayout title={`Kartica konta: ${code} - ${accountName}`}>
      <div className="flex-1 min-h-0 overflow-auto space-y-4 print:space-y-2">
        {/* Date and Analytics filters */}
        <div className="grid grid-cols-5 gap-4 print:hidden">
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {searchParams.get("ref") === "menu" ? "Nazad na meni" : "Glavna knjiga"}
            </Button>
          </div>
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
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Štampaj
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Izvezi
            </Button>
          </div>
        </div>

        {/* Print header - only visible in print */}
        <div className="hidden print:block text-center mb-4">
          <h1 className="text-xl font-bold">Kartica konta: {code} - {accountName}</h1>
          <p className="text-sm">
            Period: {dateFrom ? format(new Date(dateFrom), "dd.MM.yyyy") : ""} - {dateTo ? format(new Date(dateTo), "dd.MM.yyyy") : ""}
          </p>
        </div>

        {/* Summary */}
        {data && (
          <div className="grid grid-cols-4 gap-4 text-sm border-y py-2 print:text-xs">
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
        <div className="border rounded-md print:border-none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Datum</TableHead>
                <TableHead className="w-[90px]">Valuta</TableHead>
                <TableHead className="w-[70px]">Nalog</TableHead>
                <TableHead className="w-[110px]">Dokument</TableHead>
                <TableHead className="w-[90px]">Datum dok.</TableHead>
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
                  <TableCell colSpan={10} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : itemsWithBalance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
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
                    <TableCell>
                      {item.item_document_date ? format(new Date(item.item_document_date), "dd.MM.yyyy") : "-"}
                    </TableCell>
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
                      {item.debit_amount !== 0
                        ? formatNumber(item.debit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.credit_amount !== 0
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
                  <TableCell colSpan={7} className="text-right font-medium">
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
      </div>
    </MainLayout>
  );
}
