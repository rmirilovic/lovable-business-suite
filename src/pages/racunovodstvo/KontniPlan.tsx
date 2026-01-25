import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, ChevronRight, ChevronDown, Upload } from "lucide-react";
import {
  useChartOfAccounts,
  useChartOfAccountsMutations,
  ChartOfAccountsRow,
  AccountType,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_CLASS_TYPES,
} from "@/hooks/useChartOfAccounts";
import { cn } from "@/lib/utils";

interface AccountFormData {
  code: string;
  name: string;
  account_type: AccountType;
  parent_code: string;
  is_active: boolean;
  is_posting_allowed: boolean;
  description: string;
}

const initialFormData: AccountFormData = {
  code: "",
  name: "",
  account_type: "asset",
  parent_code: "",
  is_active: true,
  is_posting_allowed: false,
  description: "",
};

export default function KontniPlan() {
  const { data: accounts = [], isLoading } = useChartOfAccounts();
  const { createAccount, updateAccount, deleteAccount } = useChartOfAccountsMutations();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccountsRow | null>(null);
  const [formData, setFormData] = useState<AccountFormData>(initialFormData);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]));

  // Build tree structure
  const accountTree = useMemo(() => {
    const filtered = accounts.filter(
      (a) =>
        a.code.toLowerCase().includes(search.toLowerCase()) ||
        a.name.toLowerCase().includes(search.toLowerCase())
    );

    // Group by parent
    const byParent = new Map<string, ChartOfAccountsRow[]>();
    filtered.forEach((acc) => {
      const parent = acc.parent_code || "";
      if (!byParent.has(parent)) {
        byParent.set(parent, []);
      }
      byParent.get(parent)!.push(acc);
    });

    return { accounts: filtered, byParent };
  }, [accounts, search]);

  const toggleNode = (code: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleAdd = () => {
    setEditingAccount(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  const handleEdit = (account: ChartOfAccountsRow) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      parent_code: account.parent_code || "",
      is_active: account.is_active,
      is_posting_allowed: account.is_posting_allowed,
      description: account.description || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (account: ChartOfAccountsRow) => {
    if (confirm(`Da li ste sigurni da želite da obrišete konto ${account.code}?`)) {
      await deleteAccount.mutateAsync(account.id);
    }
  };

  const handleSubmit = async () => {
    const level = formData.code.length;
    const accountType = ACCOUNT_CLASS_TYPES[formData.code[0]] || formData.account_type;

    if (editingAccount) {
      await updateAccount.mutateAsync({
        id: editingAccount.id,
        ...formData,
        account_type: accountType,
        level,
        parent_code: formData.parent_code || null,
      });
    } else {
      await createAccount.mutateAsync({
        ...formData,
        account_type: accountType,
        level,
        parent_code: formData.parent_code || null,
      });
    }
    setDialogOpen(false);
  };

  const renderAccountRow = (account: ChartOfAccountsRow, depth: number = 0) => {
    const hasChildren = accountTree.byParent.has(account.code);
    const isExpanded = expandedNodes.has(account.code);
    const children = accountTree.byParent.get(account.code) || [];

    return (
      <>
        <TableRow key={account.id} className={cn(!account.is_active && "opacity-50")}>
          <TableCell>
            <div className="flex items-center" style={{ paddingLeft: `${depth * 20}px` }}>
              {hasChildren ? (
                <button
                  onClick={() => toggleNode(account.code)}
                  className="p-1 hover:bg-muted rounded mr-1"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <span className="w-6" />
              )}
              <span className="font-mono font-medium">{account.code}</span>
            </div>
          </TableCell>
          <TableCell>{account.name}</TableCell>
          <TableCell>
            <Badge variant="outline">{ACCOUNT_TYPE_LABELS[account.account_type]}</Badge>
          </TableCell>
          <TableCell className="text-center">
            {account.is_posting_allowed ? (
              <Badge variant="default">Da</Badge>
            ) : (
              <Badge variant="secondary">Ne</Badge>
            )}
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => handleEdit(account)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(account)}
                disabled={deleteAccount.isPending}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && children.map((child) => renderAccountRow(child, depth + 1))}
      </>
    );
  };

  const rootAccounts = accountTree.byParent.get("") || [];

  return (
    <MainLayout title="Kontni plan">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po šifri ili nazivu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Učitaj standardni
            </Button>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Novi konto
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Šifra</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead className="w-[120px]">Tip</TableHead>
                <TableHead className="w-[100px] text-center">Knjiženje</TableHead>
                <TableHead className="w-[100px]">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : rootAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nema konta. Dodajte prvi konto ili učitajte standardni kontni plan.
                  </TableCell>
                </TableRow>
              ) : (
                rootAccounts.map((account) => renderAccountRow(account))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Izmeni konto" : "Novi konto"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Šifra *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="101"
                  disabled={!!editingAccount}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent_code">Nadređeni konto</Label>
                <Input
                  id="parent_code"
                  value={formData.parent_code}
                  onChange={(e) => setFormData({ ...formData, parent_code: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Naziv *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Naziv konta"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_type">Tip konta</Label>
              <Select
                value={formData.account_type}
                onValueChange={(v) => setFormData({ ...formData, account_type: v as AccountType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Opis</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked as boolean })
                  }
                />
                <Label htmlFor="is_active">Aktivan</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_posting_allowed"
                  checked={formData.is_posting_allowed}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_posting_allowed: checked as boolean })
                  }
                />
                <Label htmlFor="is_posting_allowed">Dozvoljeno knjiženje</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Otkaži
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.code || !formData.name || createAccount.isPending || updateAccount.isPending}
            >
              {editingAccount ? "Sačuvaj" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
