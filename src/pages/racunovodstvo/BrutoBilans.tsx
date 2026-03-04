import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, FileSpreadsheet, Loader2 } from "lucide-react";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";

const CLASS_NAMES: Record<string, string> = {
  "0": "Neuplaćeni upisani kapital i stalna imovina",
  "1": "Zalihe",
  "2": "Kratkoročna potraživanja, plasmani i gotovina",
  "3": "Kapital",
  "4": "Dugoročna rezervisanja i obaveze",
  "5": "Rashodi",
  "6": "Prihodi",
  "7": "Otvaranje i zaključak računa",
  "8": "Vanbilansna aktiva",
  "9": "Vanbilansna pasiva",
};

interface TrialBalanceRow {
  code: string;
  name: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export default function BrutoBilans() {
  const { selectedCompany, selectedYear } = useAuth();
  const { data: accounts = [] } = useChartOfAccounts();
  
  const currentYear = selectedYear?.year || new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(
    new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"])
  );

  // Fetch journal entry items for the period
  const { data: journalItems = [], isLoading } = useQuery({
    queryKey: ["trial-balance", selectedCompany?.id, selectedYear?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];

      const { data, error } = await supabase
        .from("journal_entry_items")
        .select(`
          account_code,
          debit_amount,
          credit_amount,
          journal_entries!inner(
            entry_date,
            status,
            business_year_id,
            company_id
          )
        `)
        .eq("company_id", selectedCompany.id)
        .eq("journal_entries.business_year_id", selectedYear.id)
        .eq("journal_entries.status", "posted");

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  // Calculate trial balance
  const trialBalance = useMemo(() => {
    const balanceMap = new Map<string, TrialBalanceRow>();

    // Initialize all accounts
    accounts.forEach((acc) => {
      balanceMap.set(acc.code, {
        code: acc.code,
        name: acc.name,
        openingDebit: 0,
        openingCredit: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingDebit: 0,
        closingCredit: 0,
      });
    });

    // Process journal items
    journalItems.forEach((item: any) => {
      const entryDate = item.journal_entries?.entry_date;
      if (!entryDate) return;

      const row = balanceMap.get(item.account_code);
      if (!row) return;

      if (entryDate < dateFrom) {
        // Opening balance
        row.openingDebit += Number(item.debit_amount) || 0;
        row.openingCredit += Number(item.credit_amount) || 0;
      } else if (entryDate >= dateFrom && entryDate <= dateTo) {
        // Period turnover
        row.periodDebit += Number(item.debit_amount) || 0;
        row.periodCredit += Number(item.credit_amount) || 0;
      }
    });

    // Calculate closing balance
    balanceMap.forEach((row) => {
      const totalDebit = row.openingDebit + row.periodDebit;
      const totalCredit = row.openingCredit + row.periodCredit;
      const netBalance = totalDebit - totalCredit;
      
      if (netBalance > 0) {
        row.closingDebit = netBalance;
        row.closingCredit = 0;
      } else {
        row.closingDebit = 0;
        row.closingCredit = Math.abs(netBalance);
      }
    });

    return balanceMap;
  }, [accounts, journalItems, dateFrom, dateTo]);

  // Group accounts by class
  const accountsByClass = useMemo(() => {
    const grouped = new Map<string, TrialBalanceRow[]>();
    
    for (let i = 0; i <= 9; i++) {
      grouped.set(String(i), []);
    }

    trialBalance.forEach((row, code) => {
      const classCode = code[0];
      const hasActivity = row.openingDebit > 0 || row.openingCredit > 0 || 
                         row.periodDebit > 0 || row.periodCredit > 0;
      
      if (hasActivity && grouped.has(classCode)) {
        grouped.get(classCode)!.push(row);
      }
    });

    // Sort each class by code
    grouped.forEach((rows) => {
      rows.sort((a, b) => a.code.localeCompare(b.code));
    });

    return grouped;
  }, [trialBalance]);

  // Calculate class totals
  const classTotals = useMemo(() => {
    const totals = new Map<string, TrialBalanceRow>();
    
    accountsByClass.forEach((rows, classCode) => {
      const total: TrialBalanceRow = {
        code: classCode,
        name: CLASS_NAMES[classCode] || "",
        openingDebit: 0,
        openingCredit: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingDebit: 0,
        closingCredit: 0,
      };

      rows.forEach((row) => {
        total.openingDebit += row.openingDebit;
        total.openingCredit += row.openingCredit;
        total.periodDebit += row.periodDebit;
        total.periodCredit += row.periodCredit;
        total.closingDebit += row.closingDebit;
        total.closingCredit += row.closingCredit;
      });

      totals.set(classCode, total);
    });

    return totals;
  }, [accountsByClass]);

  // Grand total
  const grandTotal = useMemo(() => {
    const total: TrialBalanceRow = {
      code: "",
      name: "UKUPNO",
      openingDebit: 0,
      openingCredit: 0,
      periodDebit: 0,
      periodCredit: 0,
      closingDebit: 0,
      closingCredit: 0,
    };

    classTotals.forEach((classTotal) => {
      total.openingDebit += classTotal.openingDebit;
      total.openingCredit += classTotal.openingCredit;
      total.periodDebit += classTotal.periodDebit;
      total.periodCredit += classTotal.periodCredit;
      total.closingDebit += classTotal.closingDebit;
      total.closingCredit += classTotal.closingCredit;
    });

    return total;
  }, [classTotals]);

  const toggleClass = (classCode: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classCode)) {
        next.delete(classCode);
      } else {
        next.add(classCode);
      }
      return next;
    });
  };

  const formatAmount = (amount: number) => {
    if (amount === 0) return "";
    return formatNumber(amount, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <MainLayout title="Bruto bilans">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <Label>Datum od</Label>
            <LocaleDateInput
              value={dateFrom}
              onChange={setDateFrom}
              className="w-48"
            />
          </div>
          <div className="space-y-2">
            <Label>Datum do</Label>
            <LocaleDateInput
              value={dateTo}
              onChange={setDateTo}
              className="w-48"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              if (expandedClasses.size === 10) {
                setExpandedClasses(new Set());
              } else {
                setExpandedClasses(new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]));
              }
            }}
          >
            {expandedClasses.size === 10 ? "Skupi sve" : "Proširi sve"}
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-[100px]">Konto</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead className="text-right w-[120px]">Poč. duguje</TableHead>
                <TableHead className="text-right w-[120px]">Poč. potražuje</TableHead>
                <TableHead className="text-right w-[120px]">Promet duguje</TableHead>
                <TableHead className="text-right w-[120px]">Promet potražuje</TableHead>
                <TableHead className="text-right w-[120px]">Saldo duguje</TableHead>
                <TableHead className="text-right w-[120px]">Saldo potražuje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {Array.from(accountsByClass.entries()).map(([classCode, rows]) => {
                    const classTotal = classTotals.get(classCode);
                    const isExpanded = expandedClasses.has(classCode);
                    const hasData = rows.length > 0;

                    if (!hasData) return null;

                    return (
                      <Collapsible key={classCode} open={isExpanded} asChild>
                        <>
                          <TableRow 
                            className="bg-muted/50 font-medium cursor-pointer hover:bg-muted"
                            onClick={() => toggleClass(classCode)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                                <span className="font-mono">{classCode}</span>
                              </div>
                            </TableCell>
                            <TableCell>{CLASS_NAMES[classCode]}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(classTotal?.openingDebit || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(classTotal?.openingCredit || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(classTotal?.periodDebit || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(classTotal?.periodCredit || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(classTotal?.closingDebit || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(classTotal?.closingCredit || 0)}
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <>
                              {rows.map((row) => (
                                <TableRow key={row.code}>
                                  <TableCell className="font-mono pl-8">{row.code}</TableCell>
                                  <TableCell>{row.name}</TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatAmount(row.openingDebit)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatAmount(row.openingCredit)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatAmount(row.periodDebit)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatAmount(row.periodCredit)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatAmount(row.closingDebit)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatAmount(row.closingCredit)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                  
                  {/* Grand Total */}
                  <TableRow className="bg-primary/10 font-bold border-t-2">
                    <TableCell></TableCell>
                    <TableCell>UKUPNO</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(grandTotal.openingDebit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(grandTotal.openingCredit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(grandTotal.periodDebit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(grandTotal.periodCredit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(grandTotal.closingDebit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(grandTotal.closingCredit)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Balance check */}
        {!isLoading && (
          <div className="flex gap-4 text-sm">
            <div className={cn(
              "px-3 py-1.5 rounded-md",
              Math.abs(grandTotal.openingDebit - grandTotal.openingCredit) < 0.01 
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            )}>
              Početno stanje: {Math.abs(grandTotal.openingDebit - grandTotal.openingCredit) < 0.01 ? "✓ Balansirano" : "✗ Nebalansirano"}
            </div>
            <div className={cn(
              "px-3 py-1.5 rounded-md",
              Math.abs(grandTotal.periodDebit - grandTotal.periodCredit) < 0.01 
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            )}>
              Promet: {Math.abs(grandTotal.periodDebit - grandTotal.periodCredit) < 0.01 ? "✓ Balansirano" : "✗ Nebalansirano"}
            </div>
            <div className={cn(
              "px-3 py-1.5 rounded-md",
              Math.abs(grandTotal.closingDebit - grandTotal.closingCredit) < 0.01 
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            )}>
              Saldo: {Math.abs(grandTotal.closingDebit - grandTotal.closingCredit) < 0.01 ? "✓ Balansirano" : "✗ Nebalansirano"}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
