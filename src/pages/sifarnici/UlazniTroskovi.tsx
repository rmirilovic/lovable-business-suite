import { useState, useMemo, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useInputCosts, useInputCostsMutations, InputCost, InputCostFormData } from "@/hooks/useInputCosts";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { usePermissions } from "@/hooks/usePermissions";
import { Textarea } from "@/components/ui/textarea";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";

const VAT_RATES = [0, 10, 20];

export default function UlazniTroskovi() {
  const { data: costs = [], isLoading } = useInputCosts();
  const { data: accounts = [] } = useChartOfAccounts();
  const { createInputCost, updateInputCost, deleteInputCost } = useInputCostsMutations();
  const { hasAccess } = usePermissions();
  
  // Check if user has write access to input costs module
  const canEdit = hasAccess("sifarnici.ulazni_troskovi", "write");

  const TROSKOVI_KEY = "ulazni_troskovi_view_state";
  const savedTr = (() => { try { const r = sessionStorage.getItem(TROSKOVI_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; } })();

  const [search, setSearch] = useState(savedTr.search ?? "");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<InputCost | null>(null);
  const [formData, setFormData] = useState<InputCostFormData>({
    code: "",
    account_code: "",
    name: "",
    vat_rate: 20,
    is_vat_deductible: true,
    is_active: true,
    is_procurement_cost: false,
    is_import_cost: false,
    description: "",
  });

  // Filter posting-allowed accounts for selection
  const postingAccounts = accounts.filter((a) => a.is_posting_allowed && a.is_active);

  // Sorting
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort(savedTr.sortColumn ?? null, savedTr.sortDirection ?? "asc");

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);

  useEffect(() => {
    sessionStorage.setItem(TROSKOVI_KEY, JSON.stringify({
      search, sortColumn, sortDirection, scrollTop: tableScrollRef.current?.scrollTop ?? 0,
    }));
  }, [search, sortColumn, sortDirection]);

  useEffect(() => {
    if (!isLoading && !restoredScrollRef.current && tableScrollRef.current && savedTr.scrollTop) {
      restoredScrollRef.current = true;
      requestAnimationFrame(() => { if (tableScrollRef.current) tableScrollRef.current.scrollTop = savedTr.scrollTop; });
    }
  }, [isLoading]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const h = () => { try { const c = JSON.parse(sessionStorage.getItem(TROSKOVI_KEY) || "{}"); sessionStorage.setItem(TROSKOVI_KEY, JSON.stringify({ ...c, scrollTop: el.scrollTop })); } catch {} };
    el.addEventListener("scroll", h, { passive: true });
    return () => el.removeEventListener("scroll", h);
  }, []);

  const filteredCosts = useMemo(() => {
    return costs.filter(
      (c) =>
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.account_code.includes(search)
    );
  }, [costs, search]);

  // Sorted costs
  const sortedCosts = useMemo(() => {
    const sorted = sortItems(filteredCosts, (item, column) => {
      switch (column) {
        case 'code': return item.code;
        case 'account_code': return item.account_code;
        case 'name': return item.name;
        case 'vat_rate': return item.vat_rate;
        case 'is_vat_deductible': return item.is_vat_deductible;
        case 'is_procurement_cost': return item.is_procurement_cost;
        case 'is_import_cost': return item.is_import_cost;
        case 'is_active': return item.is_active;
        default: return null;
      }
    });
    // If no sort applied, default to numeric code sort
    if (!sortColumn) {
      return [...sorted].sort((a, b) => a.code.localeCompare(b.code, 'sr', { numeric: true }));
    }
    return sorted;
  }, [filteredCosts, sortItems, sortColumn]);

  const getAccountName = (code: string) => {
    const account = accounts.find((a) => a.code === code);
    return account ? account.name : "";
  };

  const handleNew = () => {
    setEditingCost(null);
    setFormData({
      code: "",
      account_code: "",
      name: "",
      vat_rate: 20,
      is_vat_deductible: true,
      is_active: true,
      is_procurement_cost: false,
      is_import_cost: false,
      description: "",
    });
    setDialogOpen(true);
  };

  const handleEdit = (cost: InputCost) => {
    setEditingCost(cost);
    setFormData({
      code: cost.code,
      account_code: cost.account_code,
      name: cost.name,
      vat_rate: cost.vat_rate,
      is_vat_deductible: cost.is_vat_deductible,
      is_active: cost.is_active,
      is_procurement_cost: cost.is_procurement_cost,
      is_import_cost: cost.is_import_cost,
      description: cost.description || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Da li ste sigurni da želite da obrišete ovaj trošak?")) {
      await deleteInputCost.mutateAsync(id);
    }
  };

  const handleSubmit = async () => {
    if (!formData.code || !formData.account_code || !formData.name) {
      return;
    }

    // Check for duplicate code
    const existingWithCode = costs.find(
      (c) => c.code.toLowerCase() === formData.code.toLowerCase() && c.id !== editingCost?.id
    );
    if (existingWithCode) {
      toast.error(`Trošak sa šifrom "${formData.code}" već postoji!`);
      return;
    }

    if (editingCost) {
      await updateInputCost.mutateAsync({ id: editingCost.id, ...formData });
    } else {
      await createInputCost.mutateAsync(formData);
    }
    setDialogOpen(false);
  };

  const handleAccountChange = (code: string) => {
    const account = accounts.find((a) => a.code === code);
    setFormData({
      ...formData,
      account_code: code,
      name: formData.name || (account?.name || ""),
    });
  };

  return (
    <MainLayout title="Ulazni troškovi">
      <div className="flex flex-col flex-1 min-h-0 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po šifri, nazivu ili kontu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {canEdit && (
            <Button onClick={handleNew}>
              <Plus className="w-4 h-4 mr-2" />
              Novi trošak
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="border rounded-lg flex-1 min-h-0 flex flex-col">
          <TableScrollContainer ref={tableScrollRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">
                    <SortableHeader column="code" label="Šifra" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="w-28">
                    <SortableHeader column="account_code" label="Konto" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="name" label="Naziv" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="w-24 text-right">
                    <SortableHeader column="vat_rate" label="PDV %" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                  </TableHead>
                  <TableHead className="w-28 text-center">
                    <SortableHeader column="is_vat_deductible" label="PDV odbitni" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-center" />
                  </TableHead>
                  <TableHead className="w-20 text-center">
                    <SortableHeader column="is_procurement_cost" label="ZTN" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-center" />
                  </TableHead>
                  <TableHead className="w-20 text-center">
                    <SortableHeader column="is_import_cost" label="ZTU" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-center" />
                  </TableHead>
                  <TableHead className="w-20 text-center">
                    <SortableHeader column="is_active" label="Aktivan" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-center" />
                  </TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Učitavanje...
                    </TableCell>
                  </TableRow>
                ) : filteredCosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {search ? "Nema rezultata pretrage" : "Nema definisanih troškova"}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCosts.map((cost) => (
                    <TableRow key={cost.id}>
                      <TableCell className="font-mono">{cost.code}</TableCell>
                      <TableCell className="font-mono">{cost.account_code}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{cost.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {getAccountName(cost.account_code)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{cost.vat_rate}%</TableCell>
                      <TableCell className="text-center">
                        {cost.is_vat_deductible ? "Da" : "Ne"}
                      </TableCell>
                      <TableCell className="text-center">
                        {cost.is_procurement_cost ? "✓" : "–"}
                      </TableCell>
                      <TableCell className="text-center">
                        {cost.is_import_cost ? "✓" : "–"}
                      </TableCell>
                      <TableCell className="text-center">
                        {cost.is_active ? "✓" : "–"}
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(cost)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(cost.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableScrollContainer>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCost ? "Izmena troška" : "Novi ulazni trošak"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Šifra troška *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="npr. T01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_code">Konto *</Label>
                <Select
                  value={formData.account_code}
                  onValueChange={handleAccountChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite konto" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {postingAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.code}>
                        {acc.code} - {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Naziv troška *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Naziv troška"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vat_rate">Stopa PDV-a</Label>
                <Select
                  value={String(formData.vat_rate)}
                  onValueChange={(v) => setFormData({ ...formData, vat_rate: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VAT_RATES.map((rate) => (
                      <SelectItem key={rate} value={String(rate)}>
                        {rate}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 flex items-end gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is_vat_deductible"
                    checked={formData.is_vat_deductible}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_vat_deductible: !!checked })
                    }
                  />
                  <Label htmlFor="is_vat_deductible">PDV odbitni</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is_procurement_cost"
                    checked={formData.is_procurement_cost}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_procurement_cost: !!checked })
                    }
                  />
                  <Label htmlFor="is_procurement_cost">ZTN</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is_import_cost"
                    checked={formData.is_import_cost}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_import_cost: !!checked })
                    }
                  />
                  <Label htmlFor="is_import_cost">ZTU</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: !!checked })
                    }
                  />
                  <Label htmlFor="is_active">Aktivan</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Opis</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Otkaži
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.code || !formData.account_code || !formData.name}
            >
              {editingCost ? "Sačuvaj" : "Kreiraj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
