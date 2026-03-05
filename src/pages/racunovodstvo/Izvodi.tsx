import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Search, FileText, FileSpreadsheet, Printer, MoreHorizontal, Eye } from "lucide-react";
import { useBankStatements, useBankStatementMutations } from "@/hooks/useBankStatements";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber, formatDate } from "@/lib/formatting";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  exportBankStatementsToExcel,
  exportBankStatementsToPdf,
  printBankStatements,
} from "@/lib/bankStatementListExportUtils";

const STATUS_LABELS: Record<string, string> = { draft: "Nacrt", posted: "Proknjižen" };
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  posted: "default",
};

export default function Izvodi() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const { data: statements = [], isLoading } = useBankStatements();
  const { bankAccounts } = useBankAccounts(selectedCompany?.id);
  const { create, remove } = useBankStatementMutations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newData, setNewData] = useState({ statement_date: new Date().toISOString().slice(0, 10), bank_account_id: "", opening_balance: 0 });
  const [filter, setFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statementToDelete, setStatementToDelete] = useState<any>(null);
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("statement_number", "desc");

  const filtered = statements.filter((s: any) => {
    const matchesSearch =
      s.statement_number.toLowerCase().includes(filter.toLowerCase()) ||
      s.bank_accounts?.account_number?.includes(filter) ||
      s.bank_accounts?.bank_name?.toLowerCase().includes(filter.toLowerCase());
    const matchesDateFrom = !dateFrom || s.statement_date >= dateFrom;
    const matchesDateTo = !dateTo || s.statement_date <= dateTo;
    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const sorted = sortItems(filtered, (item: any, column: string) => {
    switch (column) {
      case "statement_number": return item.statement_number;
      case "statement_date": return item.statement_date;
      case "bank_account": return `${item.bank_accounts?.account_number || ""} ${item.bank_accounts?.bank_name || ""}`;
      case "total_debit": return Number(item.total_debit);
      case "total_credit": return Number(item.total_credit);
      case "status": return item.status;
      default: return null;
    }
  });

  const handleCreate = async () => {
    if (!newData.bank_account_id) return;
    const result = await create.mutateAsync(newData);
    setDialogOpen(false);
    navigate(`/racunovodstvo/izvodi/${result.id}`);
  };

  const exportMeta = { companyName: selectedCompany?.name ?? "", dateFrom, dateTo };

  return (
    <MainLayout title="Izvodi">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Izvodi</h1>
            <p className="text-muted-foreground">Izvodi iz banke</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportBankStatementsToExcel(sorted, exportMeta)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportBankStatementsToPdf(sorted, exportMeta)}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printBankStatements(sorted, exportMeta)}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novi izvod
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Pretraži po broju, računu..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[170px]" />
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">
                  <SortableHeader column="statement_number" label="Broj" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[110px]">
                  <SortableHeader column="statement_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="bank_account" label="Tekući račun" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[130px] text-right">
                  <SortableHeader column="total_debit" label="Duguje" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                </TableHead>
                <TableHead className="w-[130px] text-right">
                  <SortableHeader column="total_credit" label="Potražuje" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                </TableHead>
                <TableHead className="w-[100px]">
                  <SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {filter || dateFrom || dateTo ? "Nema rezultata pretrage" : "Nema izvoda"}
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((s: any) => (
                  <TableRow key={s.id} className="relative cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono font-medium">
                      <a
                        href={`/racunovodstvo/izvodi/${s.id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/racunovodstvo/izvodi/${s.id}`); }}
                        className="absolute inset-0 z-0"
                      />
                      {s.statement_number}
                    </TableCell>
                    <TableCell>{formatDate(s.statement_date)}</TableCell>
                    <TableCell>{s.bank_accounts?.account_number} - {s.bank_accounts?.bank_name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(s.total_debit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(s.total_credit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[s.status]}>
                        {STATUS_LABELS[s.status] || s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="relative z-10" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a
                              href={`/racunovodstvo/izvodi/${s.id}`}
                              onClick={(e) => { e.preventDefault(); navigate(`/racunovodstvo/izvodi/${s.id}`); }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Prikaži
                            </a>
                          </DropdownMenuItem>
                          {s.status === "draft" && (
                            <DropdownMenuItem
                              onClick={() => { setStatementToDelete(s); setDeleteDialogOpen(true); }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Obriši
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* New statement dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novi izvod</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Datum izvoda</label>
              <LocaleDateInput
                value={newData.statement_date}
                onChange={(v) => setNewData({ ...newData, statement_date: v })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tekući račun</label>
              <Select value={newData.bank_account_id} onValueChange={(v) => setNewData({ ...newData, bank_account_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite tekući račun" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.filter(ba => ba.is_active).map((ba) => (
                    <SelectItem key={ba.id} value={ba.id}>
                      {ba.account_number} - {ba.bank_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={!newData.bank_account_id || create.isPending} className="w-full">
              Kreiraj izvod
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje izvoda</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete izvod{" "}
              <strong>{statementToDelete?.statement_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statementToDelete) {
                  remove.mutate(statementToDelete.id);
                  setDeleteDialogOpen(false);
                  setStatementToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
