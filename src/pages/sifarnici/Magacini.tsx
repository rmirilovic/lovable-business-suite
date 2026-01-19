import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useWarehouses, WAREHOUSE_TYPE_LABELS, WarehouseInsert, WarehouseUpdate } from "@/hooks/useWarehouses";
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
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Loader2, Warehouse } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface WarehouseFormData {
  code: string;
  name: string;
  address: string;
  warehouse_type: "1" | "2" | "6" | "9";
  accountant: string;
  inventory_account: string;
}

const emptyForm: WarehouseFormData = {
  code: "",
  name: "",
  address: "",
  warehouse_type: "1",
  accountant: "",
  inventory_account: "",
};

export default function Magacini() {
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;
  const {
    warehouses,
    isLoading,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    isCreating,
    isUpdating,
    isDeleting,
  } = useWarehouses(companyId);

  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<WarehouseFormData>(emptyForm);

  const filteredWarehouses = warehouses.filter(
    (w) =>
      w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.address && w.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleEdit = (warehouse: typeof warehouses[0]) => {
    setEditingId(warehouse.id);
    setForm({
      code: warehouse.code,
      name: warehouse.name,
      address: warehouse.address ?? "",
      warehouse_type: warehouse.warehouse_type,
      accountant: warehouse.accountant ?? "",
      inventory_account: warehouse.inventory_account ?? "",
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deletingId) {
      await deleteWarehouse(deletingId);
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleSave = async () => {
    if (!companyId) return;

    if (!form.code.trim() || !form.name.trim()) {
      return;
    }

    if (editingId) {
      const updates: WarehouseUpdate = {
        code: form.code.trim(),
        name: form.name.trim(),
        address: form.address.trim() || null,
        warehouse_type: form.warehouse_type,
        accountant: form.accountant.trim() || null,
        inventory_account: form.inventory_account.trim() || null,
      };
      await updateWarehouse({ id: editingId, updates });
    } else {
      const newWarehouse: WarehouseInsert = {
        company_id: companyId,
        code: form.code.trim(),
        name: form.name.trim(),
        address: form.address.trim() || null,
        warehouse_type: form.warehouse_type,
        accountant: form.accountant.trim() || null,
        inventory_account: form.inventory_account.trim() || null,
        is_active: true,
      };
      await createWarehouse(newWarehouse);
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const isSaving = isCreating || isUpdating;
  const canSave = form.code.trim() !== "" && form.name.trim() !== "";

  return (
    <MainLayout title="Magacini">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Warehouse className="h-8 w-8" />
              Magacini
            </h1>
            <p className="text-muted-foreground">
              Upravljanje magacinima kompanije
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Novi magacin
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po šifri, nazivu ili adresi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Šifra</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead>Adresa / Lokacija</TableHead>
                <TableHead>Tip magacina</TableHead>
                <TableHead>Računopolagač</TableHead>
                <TableHead>Konto zaliha</TableHead>
                <TableHead className="w-[100px] text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredWarehouses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {searchTerm ? "Nema rezultata pretrage" : "Nema magacina. Kliknite 'Novi magacin' da dodate."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredWarehouses.map((warehouse) => (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-medium">{warehouse.code}</TableCell>
                    <TableCell>{warehouse.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {warehouse.address || "—"}
                    </TableCell>
                    <TableCell>{WAREHOUSE_TYPE_LABELS[warehouse.warehouse_type]}</TableCell>
                    <TableCell>{warehouse.accountant || "—"}</TableCell>
                    <TableCell>{warehouse.inventory_account || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(warehouse)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(warehouse.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Izmeni magacin" : "Novi magacin"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Izmenite podatke o magacinu"
                : "Unesite podatke za novi magacin"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="code" className="text-right">
                Šifra *
              </Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="col-span-3"
                placeholder="npr. MAG01"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Naziv *
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="col-span-3"
                placeholder="npr. Glavni magacin"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="address" className="text-right">
                Adresa
              </Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="col-span-3"
                placeholder="npr. Ulica i broj, Grad"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="warehouse_type" className="text-right">
                Tip
              </Label>
              <Select
                value={form.warehouse_type}
                onValueChange={(value: "1" | "2" | "6" | "9") =>
                  setForm({ ...form, warehouse_type: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Magacin robe</SelectItem>
                  <SelectItem value="2">2 - Magacin repromaterijala</SelectItem>
                  <SelectItem value="6">6 - Magacin rezervnih delova</SelectItem>
                  <SelectItem value="9">9 - Magacin gotovih proizvoda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="accountant" className="text-right">
                Računopolagač
              </Label>
              <Input
                id="accountant"
                value={form.accountant}
                onChange={(e) => setForm({ ...form, accountant: e.target.value })}
                className="col-span-3"
                placeholder="Ime i prezime"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="inventory_account" className="text-right">
                Konto zaliha
              </Label>
              <Input
                id="inventory_account"
                value={form.inventory_account}
                onChange={(e) =>
                  setForm({ ...form, inventory_account: e.target.value })
                }
                className="col-span-3"
                placeholder="npr. 1320"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              Odustani
            </Button>
            <Button onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Sačuvaj izmene" : "Kreiraj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potvrda brisanja</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete ovaj magacin? Ova akcija se
              ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Odustani</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
