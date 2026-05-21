import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
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
import { FileText, Download, Filter, CreditCard, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useTableSort, SortDirection } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { format } from "date-fns";
import { formatNumber, formatPrice } from "@/lib/formatting";
import { generateGlavnaKnjigaPdf } from "@/lib/glavnaKnjigaPdfGenerator";
import { printPdfBlob } from "@/lib/printPdf";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const GL_STORAGE_KEY = "glavna_knjiga_view_state";

interface GLViewState {
  selectedAccount: string;
  dateFrom: string;
  dateTo: string;
  analyticsFilter: string;
  docTypeFilter: string;
  sortColumn: string | null;
  sortDirection: SortDirection;
}

function loadGLState(): Partial<GLViewState> {
  try {
    const raw = sessionStorage.getItem(GL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveGLState(state: GLViewState) {
  sessionStorage.setItem(GL_STORAGE_KEY, JSON.stringify(state));
}

interface LedgerEntry {
  id: string;
  entry_date: string;
  // "Valuta": prikazuje item.document_date (valuta stavke) ili entry.document_date kao fallback
  document_date: string | null;
  item_document_date: string | null;
  // Datum dokumenta (novi): prioritet item.item_document_date, fallback entry.document_date
  doc_date: string | null;
  entry_number: string;
  document_number: string | null;
  description: string;
  account_code: string;
  item_description: string | null;
  debit_amount: number;
  credit_amount: number;
  analytics: string | null;
  doc_type_prefix: string;
}

const extractDocTypePrefix = (entryNumber: string): string => {
  const s = String(entryNumber);
  const match = s.match(/^([A-Za-z]+-?)/);
  return match ? match[1] : "Ostalo";
};

export default function GlavnaKnjiga() {
  const { selectedCompany, selectedYear } = useAuth();
  const { data: accounts = [] } = useChartOfAccounts();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const saved = loadGLState();

  const [selectedAccount, setSelectedAccount] = useState<string>(searchParams.get("account") || saved.selectedAccount || "");
  const [dateFrom, setDateFrom] = useState<string>(searchParams.get("from") || saved.dateFrom || "");
  const [dateTo, setDateTo] = useState<string>(searchParams.get("to") || saved.dateTo || "");
  const [analyticsFilter, setAnalyticsFilter] = useState<string>(saved.analyticsFilter || "");
  const [docTypeFilter, setDocTypeFilter] = useState<string>(saved.docTypeFilter || "");

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort(
    saved.sortColumn ?? "entry_date",
    saved.sortDirection ?? "asc"
  );

  // Persist state to sessionStorage
  useEffect(() => {
    saveGLState({
      selectedAccount,
      dateFrom,
      dateTo,
      analyticsFilter,
      docTypeFilter,
      sortColumn,
      sortDirection,
    });
  }, [selectedAccount, dateFrom, dateTo, analyticsFilter, docTypeFilter, sortColumn, sortDirection]);

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
          item_document_number,
          item_document_date,
          cost_center_code,
          partner_id,
          partners(code),
          journal_entries!inner (
            id,
            entry_number,
            entry_date,
            document_date,
            document_number,
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

      return (data || []).map((item: any) => {
        const en = String(item.journal_entries.entry_number);
        return {
          id: item.id,
          entry_date: item.journal_entries.entry_date,
          document_date: item.journal_entries.document_date,
          item_document_date: item.document_date,
          doc_date: item.item_document_date || item.journal_entries.document_date,
          entry_number: en,
          // Prioritet: broj dokumenta na stavci, fallback na zaglavlje naloga
          document_number: item.item_document_number || item.journal_entries.document_number || null,
          description: item.journal_entries.description,
          account_code: item.account_code,
          item_description: item.description,
          debit_amount: Number(item.debit_amount),
          credit_amount: Number(item.credit_amount),
          analytics: getAnalytics(item),
          doc_type_prefix: extractDocTypePrefix(en),
        };
      }) as LedgerEntry[];
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

  // Collect unique doc type prefixes
  const docTypeOptions = useMemo(() => {
    const set = new Set<string>();
    ledgerData.forEach((e) => set.add(e.doc_type_prefix));
    return Array.from(set).sort();
  }, [ledgerData]);

  // Reset analytics filter when account changes
  const handleAccountChange = (val: string) => {
    setSelectedAccount(val === "__all__" ? "" : val);
    setAnalyticsFilter("");
  };

  // Filter, sort, then calculate running balance
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
    if (docTypeFilter) {
      data = data.filter((e) => e.doc_type_prefix === docTypeFilter);
    }

    // Sort
    const sorted = sortItems(data, (item, col) => {
      switch (col) {
        case "entry_date": return item.entry_date;
        case "document_date": return item.item_document_date || item.document_date || "";
        case "entry_number": return item.entry_number;
        case "document_number": return item.document_number || "";
        case "doc_date": return item.doc_date || "";
        case "account_code": return item.account_code;
        case "analytics": return item.analytics || "";
        case "description": return item.description;
        case "debit_amount": return item.debit_amount;
        case "credit_amount": return item.credit_amount;
        default: return null;
      }
    });

    // Calculate running balance
    let balance = 0;
    return sorted.map((entry) => {
      balance += entry.debit_amount - entry.credit_amount;
      return { ...entry, balance };
    });
  }, [ledgerData, dateFrom, dateTo, analyticsFilter, docTypeFilter, sortItems]);

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

  const handleExportExcel = () => {
    const data = filteredData.map((e) => ({
      "Datum": format(new Date(e.entry_date), "dd.MM.yyyy"),
      "Valuta": e.item_document_date ? format(new Date(e.item_document_date), "dd.MM.yyyy") : (e.document_date ? format(new Date(e.document_date), "dd.MM.yyyy") : ""),
      "Nalog": e.entry_number,
      "Dokument": e.document_number || "",
      "Datum dok.": e.doc_date ? format(new Date(e.doc_date), "dd.MM.yyyy") : "",
      "Konto": e.account_code,
      "Analitika": e.analytics || "",
      "Opis": e.item_description ? `${e.description} - ${e.item_description}` : e.description,
      "Duguje": e.debit_amount,
      "Potražuje": e.credit_amount,
      "Saldo": e.balance,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Glavna knjiga");
    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
      { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    ];
    const date = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `glavna_knjiga_${date}.xlsx`);
    toast.success(`Izvezeno ${filteredData.length} stavki`);
  };

  const getPdfOptions = () => ({
    rows: filteredData,
    companyName: selectedCompany?.name,
    accountCode: selectedAccount || undefined,
    accountName: selectedAccount ? getAccountName(selectedAccount) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const handlePdf = async () => {
    const doc = await generateGlavnaKnjigaPdf(getPdfOptions());
    doc.save(`glavna_knjiga_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handlePrint = async () => {
    const doc = await generateGlavnaKnjigaPdf(getPdfOptions());
    const blob = doc.output("blob");
    printPdfBlob(blob);
  };

  return (
    <MainLayout title="Glavna knjiga">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-4 h-full min-h-0">
        {/* Filters */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filteri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
                <Label>Vrsta dokumenta</Label>
                <Select
                  value={docTypeFilter || "__all__"}
                  onValueChange={(val) => setDocTypeFilter(val === "__all__" ? "" : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sve vrste" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Sve vrste</SelectItem>
                    {docTypeOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Datum od</Label>
                <LocaleDateInput
                  value={dateFrom}
                  onChange={setDateFrom}
                />
              </div>
              <div className="space-y-2">
                <Label>Datum do</Label>
                <LocaleDateInput
                  value={dateTo}
                  onChange={setDateTo}
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
                <Button variant="outline" size="sm" onClick={handleExportExcel} title="Izvezi u Excel">
                  <Download className="w-4 h-4 mr-2" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handlePdf} title="Izvezi u PDF">
                  <FileText className="w-4 h-4 mr-2" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} title="Štampaj">
                  <Printer className="w-4 h-4 mr-2" /> Štampa
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
                <TableHead className="w-[100px]">
                  <SortableHeader column="entry_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px]">
                  <SortableHeader column="document_date" label="Valuta" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[80px]">
                  <SortableHeader column="entry_number" label="Nalog" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[110px]">
                  <SortableHeader column="document_number" label="Dokument" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px]">
                  <SortableHeader column="doc_date" label="Datum dok." sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px]">
                  <SortableHeader column="account_code" label="Konto" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[80px]">
                  <SortableHeader column="analytics" label="Analitika" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="description" label="Opis" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[120px]">
                  <SortableHeader column="debit_amount" label="Duguje" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                </TableHead>
                <TableHead className="w-[120px]">
                  <SortableHeader column="credit_amount" label="Potražuje" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                </TableHead>
                <TableHead className="w-[120px] text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
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
                    <TableCell>{entry.document_number || "-"}</TableCell>
                    <TableCell>{entry.doc_date ? format(new Date(entry.doc_date), "dd.MM.yyyy") : "-"}</TableCell>
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
                  <TableCell colSpan={8} className="text-right font-medium">
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
