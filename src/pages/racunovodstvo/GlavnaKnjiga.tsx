import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Filter, CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";

interface LedgerEntry {
  id: string;
  entry_date: string;
  document_date: string | null;
  item_document_date: string | null;
  entry_number: number;
  description: string;
  account_code: string;
  item_description: string | null;
  debit_amount: number;
  credit_amount: number;
  analytics: string | null;
}

export default function GlavnaKnjiga() {
  const { selectedCompany, selectedYear } = useAuth();
  const { data: accounts = [] } = useChartOfAccounts();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedAccount, setSelectedAccount] = useState<string>(searchParams.get("account") || "");
  const [dateFrom, setDateFrom] = useState<string>(searchParams.get("from") || "");
  const [dateTo, setDateTo] = useState<string>(searchParams.get("to") || "");
  const [analyticsFilter, setAnalyticsFilter] = useState<string>("");

  const postingAccounts = accounts.filter((a) => a.is_posting_allowed);

  const { data: ledgerData = [], isLoading } = useQuery({
    queryKey: ["general-ledger", selectedCompany?.id, selectedYear?.id, selectedAccount, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];

      let query = supabase
        .from("journal_entry_items")
        .select(`
          id,
          account_code,
          description,
          debit_amount,
          credit_amount,
          document_date,
          cost_center_code,
          partner_id,
          partners(code),
          journal_entries!inner (
            id,
            entry_number,
            entry_date,
            document_date,
            description,
            status,
            business_year_id
          )
        `)
        .eq("company_id", selectedCompany.id)
        .eq("journal_entries.business_year_id", selectedYear.id)
        .eq("journal_entries.status", "posted")
        .order("journal_entries(entry_date)", { ascending: true });

      if (selectedAccount) {
        query = query.eq("account_code", selectedAccount);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform data
      const getAnalytics = (item: any) => {
        if (item.cost_center_code) return item.cost_center_code;
        if (item.partners?.code) return item.partners.code;
        return null;
      };

      return (data || []).map((item: any) => ({
        id: item.id,
        entry_date: item.journal_entries.entry_date,
        document_date: item.journal_entries.document_date,
        item_document_date: item.document_date,
        entry_number: item.journal_entries.entry_number,
        description: item.journal_entries.description,
        account_code: item.account_code,
        item_description: item.description,
        debit_amount: Number(item.debit_amount),
        credit_amount: Number(item.credit_amount),
        analytics: getAnalytics(item),
      })) as LedgerEntry[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  // Collect unique analytics values for the selected account
  const analyticsOptions = useMemo(() => {
    if (!selectedAccount) return [];
    const set = new Set<string>();
    ledgerData.forEach((e) => {
      if (e.analytics) set.add(e.analytics);
    });
    return Array.from(set).sort();
  }, [ledgerData, selectedAccount]);

  // Reset analytics filter when account changes
  const handleAccountChange = (val: string) => {
    setSelectedAccount(val === "__all__" ? "" : val);
    setAnalyticsFilter("");
  };

  // Filter by date, analytics and calculate running balance
  const filteredData = useMemo(() => {
    let data = ledgerData;

    if (dateFrom) {
      data = data.filter((e) => e.entry_date >= dateFrom);
    }
    if (dateTo) {
      data = data.filter((e) => e.entry_date <= dateTo);
    }
    if (analyticsFilter) {
      data = data.filter((e) => e.analytics === analyticsFilter);
    }

    // Calculate running balance
    let balance = 0;
    return data.map((entry) => {
      balance += entry.debit_amount - entry.credit_amount;
      return { ...entry, balance };
    });
  }, [ledgerData, dateFrom, dateTo, analyticsFilter]);

  // Summary calculations
  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, entry) => ({
        debit: acc.debit + entry.debit_amount,
        credit: acc.credit + entry.credit_amount,
      }),
      { debit: 0, credit: 0 }
    );
  }, [filteredData]);

  const getAccountName = (code: string) => {
    const account = accounts.find((a) => a.code === code);
    return account?.name || code;
  };

  return (
    <MainLayout title="Glavna knjiga">
      <div className="flex flex-col gap-4 h-full min-h-0">
        {/* Filters */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filteri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Konto</Label>
                <Select 
                  value={selectedAccount || "__all__"} 
                  onValueChange={handleAccountChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Svi konta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Svi konta</SelectItem>
                    {postingAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.code}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Analitika</Label>
                <Select
                  value={analyticsFilter || "__all__"}
                  onValueChange={(val) => setAnalyticsFilter(val === "__all__" ? "" : val)}
                  disabled={!selectedAccount}
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
              <div className="space-y-2">
                <Label>Datum od</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Datum do</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                {selectedAccount && (() => {
                    const params = new URLSearchParams();
                    if (dateFrom) params.set('from', dateFrom);
                    if (dateTo) params.set('to', dateTo);
                    params.set('account', selectedAccount);
                    const href = `/racunovodstvo/kartica-konta/${selectedAccount}?${params.toString()}`;
                    return (
                      <Button
                        variant="secondary"
                        asChild
                      >
                        <a
                          href={href}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(href);
                          }}
                          title="Levi klik: otvori ovde | Desni klik → Otvori u novom tabu"
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Kartica
                        </a>
                      </Button>
                    );
                  })()}
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Izvezi
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Ukupno duguje</div>
              <div className="text-2xl font-bold font-mono text-green-600">
                {formatNumber(totals.debit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Ukupno potražuje</div>
              <div className="text-2xl font-bold font-mono text-red-600">
                {formatNumber(totals.credit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Saldo</div>
              <div className={`text-2xl font-bold font-mono ${totals.debit - totals.credit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatNumber(totals.debit - totals.credit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ledger table */}
        <TableScrollContainer className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Datum</TableHead>
                <TableHead className="w-[100px]">Valuta</TableHead>
                <TableHead className="w-[80px]">Nalog</TableHead>
                <TableHead className="w-[100px]">Konto</TableHead>
                <TableHead className="w-[80px]">Analitika</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead className="w-[120px] text-right">Duguje</TableHead>
                <TableHead className="w-[120px] text-right">Potražuje</TableHead>
                <TableHead className="w-[120px] text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    Nema proknjiženih stavki za prikaz.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{format(new Date(entry.entry_date), "dd.MM.yyyy")}</TableCell>
                    <TableCell>{entry.item_document_date ? format(new Date(entry.item_document_date), "dd.MM.yyyy") : (entry.document_date ? format(new Date(entry.document_date), "dd.MM.yyyy") : "-")}</TableCell>
                    <TableCell className="font-medium">{entry.entry_number}</TableCell>
                    <TableCell className="font-mono">{entry.account_code}</TableCell>
                    <TableCell className="font-mono text-xs">{entry.analytics || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{entry.description}</span>
                        {entry.item_description && (
                          <span className="text-sm text-muted-foreground">{entry.item_description}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.debit_amount !== 0 ? formatNumber(entry.debit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.credit_amount !== 0 ? formatNumber(entry.credit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-medium ${entry.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatNumber(entry.balance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {filteredData.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6} className="text-right font-medium">
                    Ukupno:
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatNumber(totals.debit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatNumber(totals.credit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-bold ${totals.debit - totals.credit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatNumber(totals.debit - totals.credit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableScrollContainer>
      </div>
    </MainLayout>
  );
}
