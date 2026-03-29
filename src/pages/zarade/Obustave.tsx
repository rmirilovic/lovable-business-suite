import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Plus, Search, Pencil, Trash2, History } from "lucide-react";
import { toast } from "sonner";
import {
  useEmployeeDeductions,
  useEmployeeDeductionMutations,
  DEDUCTION_TYPE_LABELS,
  CREDIT_DEDUCTION_TYPES,
  EmployeeDeduction,
} from "@/hooks/useEmployeeDeductions";
import { useEmployees } from "@/hooks/useEmployees";
import { formatPrice } from "@/lib/formatting";
import { DeductionDialog } from "@/components/zarade/DeductionDialog";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";

export default function Obustave() {
  const { data: deductions, isLoading } = useEmployeeDeductions();
  const { data: employees } = useEmployees();
  const { deleteDeduction } = useEmployeeDeductionMutations();
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<EmployeeDeduction | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<EmployeeDeduction | null>(null);

  const empMap = useMemo(() => {
    const m: Record<string, string> = {};
    employees?.forEach((e) => (m[e.id] = `${e.employee_number} - ${e.last_name} ${e.first_name}`));
    return m;
  }, [employees]);

  const filtered = useMemo(() => {
    if (!deductions) return [];
    const list = deductions.filter((d) => {
      const empName = empMap[d.employee_id] || "";
      const matchSearch =
        !search ||
        empName.toLowerCase().includes(search.toLowerCase()) ||
        d.description.toLowerCase().includes(search.toLowerCase()) ||
        (d.creditor_name || "").toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || d.deduction_type === typeFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && d.is_active) ||
        (statusFilter === "inactive" && !d.is_active) ||
        (statusFilter === "paid_off" && d.is_credit && d.paid_installments >= d.total_installments && d.total_installments > 0);
      return matchSearch && matchType && matchStatus;
    });
    return sortItems(list, (item, col) => {
      switch (col) {
        case "employee": return empMap[item.employee_id] || "";
        case "type": return DEDUCTION_TYPE_LABELS[item.deduction_type] || item.deduction_type;
        case "description": return item.description;
        case "creditor": return item.creditor_name || "";
        case "installment": return item.amount_per_installment;
        case "paid": return item.paid_installments;
        case "total_inst": return item.total_installments;
        case "total_amount": return item.total_amount;
        case "status": return item.is_active ? 1 : 0;
        default: return null;
      }
    });
  }, [deductions, search, typeFilter, statusFilter, empMap, sortItems]);

  const handleDelete = async (id: string) => {
    if (!confirm("Da li ste sigurni?")) return;
    deleteDeduction.mutate(id);
  };

  return (
    <MainLayout title="Obustave od zarada">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Pretraži..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tip obustave" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi tipovi</SelectItem>
              {Object.entries(DEDUCTION_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi</SelectItem>
              <SelectItem value="active">Aktivne</SelectItem>
              <SelectItem value="inactive">Neaktivne</SelectItem>
              <SelectItem value="paid_off">Otplaćene</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button onClick={() => { setEditItem(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Nova obustava
          </Button>
        </div>

        <TableScrollContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Zaposleni</TableHead>
                <TableHead className="min-w-[150px]">Tip</TableHead>
                <TableHead className="min-w-[150px]">Opis</TableHead>
                <TableHead className="min-w-[130px]">Kreditor</TableHead>
                <TableHead className="min-w-[100px] text-right">Rata</TableHead>
                <TableHead className="min-w-[80px] text-center">Otplaćeno</TableHead>
                <TableHead className="min-w-[80px] text-center">Ukupno rata</TableHead>
                <TableHead className="min-w-[100px] text-right">Ukupan iznos</TableHead>
                <TableHead className="min-w-[80px] text-center">Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell></TableRow>
              ) : !filtered.length ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nema obustava</TableCell></TableRow>
              ) : filtered.map((d) => {
                const isPaidOff = d.is_credit && d.total_installments > 0 && d.paid_installments >= d.total_installments;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-sm">{empMap[d.employee_id] || d.employee_id}</TableCell>
                    <TableCell>
                      <Badge variant={d.is_credit ? "default" : "secondary"} className="text-xs">
                        {DEDUCTION_TYPE_LABELS[d.deduction_type] || d.deduction_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{d.description}</TableCell>
                    <TableCell className="text-sm">{d.creditor_name || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatPrice(d.amount_per_installment)}</TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {d.is_credit ? `${d.paid_installments}` : "—"}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {d.is_credit ? `${d.total_installments}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {d.is_credit ? formatPrice(d.total_amount) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {isPaidOff ? (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">Otplaćen</Badge>
                      ) : d.is_active ? (
                        <Badge variant="outline" className="text-xs">Aktivan</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Neaktivan</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditItem(d); setDialogOpen(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>

      <DeductionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        deduction={editItem}
      />
    </MainLayout>
  );
}
