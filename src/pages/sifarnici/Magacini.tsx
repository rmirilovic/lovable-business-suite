import { useState, useMemo, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useWarehouses, WAREHOUSE_TYPE_LABELS, WarehouseInsert, WarehouseUpdate, Warehouse as WarehouseType } from "@/hooks/useWarehouses";
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
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";

interface WarehouseFormData {
  code: string;
  name: string;
  address: string;
  warehouse_type: "1" | "2" | "6" | "9" | "12";
  accountant: string;
  inventory_account: string;
  is_customs_warehouse: boolean;
  customs_office_code: string;
  customs_warehouse_code: string;
}

const emptyForm: WarehouseFormData = {
  code: "",
  name: "",
  address: "",
  warehouse_type: "1",
  accountant: "",
  inventory_account: "",
  is_customs_warehouse: false,
  customs_office_code: "",
  customs_warehouse_code: "",
};

export default function Magacini() {
  const { selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  const companyId = selectedCompany?.id;
  
  // Check if user has write access to warehouses module
  const canEdit = hasAccess("sifarnici.magacini", "write");
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

  const MAGACINI_KEY = "magacini_view_state";
  const savedMag = (() => { try { const r = sessionStorage.getItem(MAGACINI_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; } })();

  const [searchTerm, setSearchTerm] = useState(savedMag.searchTerm ?? "");
  const [typeFilter, setTypeFilter] = useState<string>(savedMag.typeFilter ?? "all");
  const [addressFilter, setAddressFilter] = useState<string>(savedMag.addressFilter ?? "all");
  const [statusFilter, setStatusFilter] = useState<string>(savedMag.statusFilter ?? "active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<WarehouseFormData>(emptyForm);

  // Get unique addresses for filter
  const uniqueAddresses = Array.from(
    new Set(warehouses.map((w) => w.address).filter(Boolean))
  ).sort() as string[];

  // Sorting
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort(savedMag.sortColumn ?? null, savedMag.sortDirection ?? "asc");

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);

  useEffect(() => {
    sessionStorage.setItem(MAGACINI_KEY, JSON.stringify({
      searchTerm, typeFilter, addressFilter, statusFilter, sortColumn, sortDirection,
      scrollTop: tableScrollRef.current?.scrollTop ?? 0,
    }));
  }, [searchTerm, typeFilter, addressFilter, statusFilter, sortColumn, sortDirection]);

  useEffect(() => {
    if (!isLoading && !restoredScrollRef.current && tableScrollRef.current && savedMag.scrollTop) {
      restoredScrollRef.current = true;
      requestAnimationFrame(() => { if (tableScrollRef.current) tableScrollRef.current.scrollTop = savedMag.scrollTop; });
    }
  }, [isLoading]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const h = () => { try { const c = JSON.parse(sessionStorage.getItem(MAGACINI_KEY) || "{}"); sessionStorage.setItem(MAGACINI_KEY, JSON.stringify({ ...c, scrollTop: el.scrollTop })); } catch {} };
    el.addEventListener("scroll", h, { passive: true });
    return () => el.removeEventListener("scroll", h);
  }, []);

  const filteredWarehouses = useMemo(() => {
    return warehouses.filter((w) => {
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
  }, [warehouses, searchTerm, typeFilter, addressFilter, statusFilter]);

  // Sort warehouses
  const sortedWarehouses = useMemo(() => {
    return sortItems(filteredWarehouses, (item, column) => {
      switch (column) {
        case 'code': return item.code;
        case 'name': return item.name;
        case 'address': return item.address || '';
        case 'warehouse_type': return item.warehouse_type;
        case 'accountant': return item.accountant || '';
        case 'inventory_account': return item.inventory_account || '';
        case 'is_active': return item.is_active;
        default: return null;
      }
    });
  }, [filteredWarehouses, sortItems]);

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
      is_customs_warehouse: form.is_customs_warehouse,
      customs_office_code: form.customs_office_code.trim() || null,
      customs_warehouse_code: form.customs_warehouse_code.trim() || null,
    };
    await createWarehouse(newWarehouse);

    setDialogOpen(false);
    setForm(emptyForm);
  };

  const isSaving = isCreating || isUpdating;
  const canSave = form.code.trim() !== "" && form.name.trim() !== "";

  return (
    <MainLayout title="Magacini">
      <div className="flex flex-col flex-1 min-h-0 space-y-6">
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
          {canEdit && (
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Novi magacin
            </Button>
          )}
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

        <div className="border rounded-lg flex-1 min-h-0 flex flex-col">
          <TableScrollContainer ref={tableScrollRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">
                    <SortableHeader column="code" label="Šifra" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="name" label="Naziv" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="address" label="Adresa / Lokacija" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="warehouse_type" label="Tip magacina" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="accountant" label="Računopolagač" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="inventory_account" label="Konto zaliha" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="w-[80px] text-center">
                    <SortableHeader column="is_active" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-center" />
                  </TableHead>
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
                sortedWarehouses.map((warehouse) => (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-medium">
                      {warehouse.code}
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={warehouse.name}
                        onSave={async (val) => {
                          await updateWarehouse({ id: warehouse.id, updates: { name: val } });
                        }}
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={warehouse.address || ""}
                        displayValue={warehouse.address || "—"}
                        onSave={async (val) => {
                          await updateWarehouse({ id: warehouse.id, updates: { address: val || null } });
                        }}
                        disabled={!canEdit}
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
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={warehouse.accountant || ""}
                        displayValue={warehouse.accountant || "—"}
                        onSave={async (val) => {
                          await updateWarehouse({ id: warehouse.id, updates: { accountant: val || null } });
                        }}
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={warehouse.inventory_account || ""}
                        displayValue={warehouse.inventory_account || "—"}
                        onSave={async (val) => {
                          await updateWarehouse({ id: warehouse.id, updates: { inventory_account: val || null } });
                        }}
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={warehouse.is_active}
                        onCheckedChange={async (checked) => {
                          await updateWarehouse({ id: warehouse.id, updates: { is_active: checked } });
                        }}
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(warehouse.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
              </TableBody>
            </Table>
          </TableScrollContainer>
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

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Carinsko</Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Switch
                  checked={form.is_customs_warehouse}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, is_customs_warehouse: checked })
                  }
                />
                <Label className="text-sm">Carinsko skladište</Label>
              </div>
            </div>

            {form.is_customs_warehouse && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="customs_office_code" className="text-right">
                    Šifra car. ispostave
                  </Label>
                  <Input
                    id="customs_office_code"
                    value={form.customs_office_code}
                    onChange={(e) => setForm({ ...form, customs_office_code: e.target.value })}
                    className="col-span-3"
                    placeholder="npr. 12345"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="customs_warehouse_code" className="text-right">
                    Šifra car. skladišta
                  </Label>
                  <Input
                    id="customs_warehouse_code"
                    value={form.customs_warehouse_code}
                    onChange={(e) => setForm({ ...form, customs_warehouse_code: e.target.value })}
                    className="col-span-3"
                    placeholder="npr. CS001"
                  />
                </div>
              </>
            )}
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
