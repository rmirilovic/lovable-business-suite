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
import { Plus, Trash2, Search, Loader2, Warehouse } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineEditCell } from "@/components/sifarnici/InlineEditCell";
import { InlineSelectCell } from "@/components/sifarnici/InlineSelectCell";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface WarehouseFormData {
  code: string;
  name: string;
  address: string;
  warehouse_type: "1" | "2" | "6" | "9" | "12";
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
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [addressFilter, setAddressFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<WarehouseFormData>(emptyForm);

  // Get unique addresses for filter
  const uniqueAddresses = Array.from(
    new Set(warehouses.map((w) => w.address).filter(Boolean))
  ).sort() as string[];

  const filteredWarehouses = warehouses.filter((w) => {
    const matchesSearch =
      w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.address && w.address.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = typeFilter === "all" || w.warehouse_type === typeFilter;
    
    const matchesAddress =
      addressFilter === "all" || w.address === addressFilter;
    
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && w.is_active) ||
      (statusFilter === "inactive" && !w.is_active);

    return matchesSearch && matchesType && matchesAddress && matchesStatus;
  });

  const handleAdd = () => {
    setForm(emptyForm);
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

    setDialogOpen(false);
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

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po šifri, nazivu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Tip magacina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi tipovi</SelectItem>
              <SelectItem value="1">1 - Magacin robe</SelectItem>
              <SelectItem value="2">2 - Magacin repromaterijala</SelectItem>
              <SelectItem value="6">6 - Magacin rezervnih delova</SelectItem>
              <SelectItem value="9">9 - Magacin gotovih proizvoda</SelectItem>
              <SelectItem value="12">12 - Magacin materijala za gradnju</SelectItem>
            </SelectContent>
          </Select>

          <Select value={addressFilter} onValueChange={setAddressFilter}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Adresa / Lokacija" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Sve adrese</SelectItem>
              {uniqueAddresses.map((addr) => (
                <SelectItem key={addr} value={addr}>
                  {addr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi statusi</SelectItem>
              <SelectItem value="active">Aktivni</SelectItem>
              <SelectItem value="inactive">Neaktivni</SelectItem>
            </SelectContent>
          </Select>

          {(typeFilter !== "all" || addressFilter !== "all" || statusFilter !== "active") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTypeFilter("all");
                setAddressFilter("all");
                setStatusFilter("active");
              }}
            >
              Poništi filtere
            </Button>
          )}
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
                <TableHead className="w-[80px] text-center">Status</TableHead>
                <TableHead className="w-[80px] text-right">Akcije</TableHead>
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
                    <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredWarehouses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    {searchTerm || statusFilter !== "active" ? "Nema rezultata pretrage" : "Nema magacina. Kliknite 'Novi magacin' da dodate."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredWarehouses.map((warehouse) => (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-medium">
                      <InlineEditCell
                        value={warehouse.code}
                        onSave={async (val) => {
                          await updateWarehouse({ id: warehouse.id, updates: { code: val } });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={warehouse.name}
                        onSave={async (val) => {
                          await updateWarehouse({ id: warehouse.id, updates: { name: val } });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={warehouse.address || ""}
                        displayValue={warehouse.address || "—"}
                        onSave={async (val) => {
                          await updateWarehouse({ id: warehouse.id, updates: { address: val || null } });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineSelectCell
                        value={warehouse.warehouse_type}
                        displayValue={WAREHOUSE_TYPE_LABELS[warehouse.warehouse_type]}
                        options={[
                          { value: "1", label: "1 - Magacin robe" },
                          { value: "2", label: "2 - Magacin repromaterijala" },
                          { value: "6", label: "6 - Magacin rezervnih delova" },
                          { value: "9", label: "9 - Magacin gotovih proizvoda" },
                          { value: "12", label: "12 - Magacin materijala za gradnju" },
                        ]}
                        onSave={async (val) => {
                          await updateWarehouse({ 
                            id: warehouse.id, 
                            updates: { warehouse_type: val as "1" | "2" | "6" | "9" | "12" } 
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={warehouse.accountant || ""}
                        displayValue={warehouse.accountant || "—"}
                        onSave={async (val) => {
                          await updateWarehouse({ id: warehouse.id, updates: { accountant: val || null } });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={warehouse.inventory_account || ""}
                        displayValue={warehouse.inventory_account || "—"}
                        onSave={async (val) => {
                          await updateWarehouse({ id: warehouse.id, updates: { inventory_account: val || null } });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={warehouse.is_active}
                        onCheckedChange={async (checked) => {
                          await updateWarehouse({ id: warehouse.id, updates: { is_active: checked } });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(warehouse.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
            <DialogTitle>Novi magacin</DialogTitle>
            <DialogDescription>
              Unesite podatke za novi magacin
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
                onValueChange={(value: "1" | "2" | "6" | "9" | "12") =>
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
                  <SelectItem value="12">12 - Magacin materijala za gradnju</SelectItem>
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
              Kreiraj
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
