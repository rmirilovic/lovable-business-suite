import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useBankStatements, useBankStatementMutations } from "@/hooks/useBankStatements";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { LocaleDateInput } from "@/components/ui/locale-date-input";

const STATUS_LABELS: Record<string, string> = { draft: "Nacrt", posted: "Proknjižen" };
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  posted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
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

  const filtered = statements.filter((s: any) =>
    s.statement_number.toLowerCase().includes(filter.toLowerCase()) ||
    s.bank_accounts?.account_number?.includes(filter) ||
    s.bank_accounts?.bank_name?.toLowerCase().includes(filter.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newData.bank_account_id) return;
    const result = await create.mutateAsync(newData);
    setDialogOpen(false);
    navigate(`/racunovodstvo/izvodi/${result.id}`);
  };

  return (
    <MainLayout title="Izvodi">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Input
            placeholder="Pretraži po broju, računu..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
            autoComplete="off"
          />
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novi izvod
          </Button>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Broj</TableHead>
                <TableHead className="w-[110px]">Datum</TableHead>
                <TableHead>Tekući račun</TableHead>
                <TableHead className="w-[130px] text-right">Duguje</TableHead>
                <TableHead className="w-[130px] text-right">Potražuje</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nema izvoda</TableCell>
                </TableRow>
              ) : (
                filtered.map((s: any) => (
                  <TableRow key={s.id} className="relative cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono font-medium">
                      <a
                        href={`/racunovodstvo/izvodi/${s.id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/racunovodstvo/izvodi/${s.id}`); }}
                        className="absolute inset-0 z-0"
                      />
                      {s.statement_number}
                    </TableCell>
                    <TableCell>{format(new Date(s.statement_date), "dd.MM.yyyy.")}</TableCell>
                    <TableCell>{s.bank_accounts?.account_number} - {s.bank_accounts?.bank_name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(s.total_debit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(s.total_credit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", STATUS_COLORS[s.status] || "")}>
                        {STATUS_LABELS[s.status] || s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="relative z-10">
                      {s.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Obrisati izvod?")) remove.mutate(s.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
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
    </MainLayout>
  );
}
