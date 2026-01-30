import { useState } from "react";
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
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { useInputCosts, useInputCostsMutations, InputCost, InputCostFormData } from "@/hooks/useInputCosts";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { Textarea } from "@/components/ui/textarea";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";

const VAT_RATES = [0, 10, 20];

export default function UlazniTroskovi() {
  const { data: costs = [], isLoading } = useInputCosts();
  const { data: accounts = [] } = useChartOfAccounts();
  const { createInputCost, updateInputCost, deleteInputCost } = useInputCostsMutations();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<InputCost | null>(null);
  const [formData, setFormData] = useState<InputCostFormData>({
    code: "",
    account_code: "",
    name: "",
    vat_rate: 20,
    is_vat_deductible: true,
    is_active: true,
    description: "",
  });

  // Filter posting-allowed accounts for selection
  const postingAccounts = accounts.filter((a) => a.is_posting_allowed && a.is_active);

  const filteredCosts = costs
    .filter(
      (c) =>
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.account_code.includes(search)
    )
    .sort((a, b) => a.code.localeCompare(b.code, 'sr', { numeric: true }));

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
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4 mr-2" />
            Novi trošak
          </Button>
        </div>

        {/* Table */}
        <div className="border rounded-lg flex-1 min-h-0 flex flex-col">
          <TableScrollContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Šifra</TableHead>
                  <TableHead className="w-28">Konto</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead className="w-24 text-right">PDV %</TableHead>
                  <TableHead className="w-28 text-center">PDV odbitni</TableHead>
                  <TableHead className="w-20 text-center">Aktivan</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Učitavanje...
                    </TableCell>
                  </TableRow>
                ) : filteredCosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {search ? "Nema rezultata pretrage" : "Nema definisanih troškova"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCosts.map((cost) => (
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
                        {cost.is_active ? "✓" : "–"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(cost)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(cost.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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
