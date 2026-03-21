import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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
import {
  Plus, Search, Loader2, MoreHorizontal, Eye, BookCheck, Undo2, Trash2,
} from "lucide-react";
import { useInventoryCounts, InventoryCount } from "@/hooks/useInventoryCounts";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { InventoryCountDialog } from "@/components/magacin/InventoryCountDialog";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";

const STATUS_OPTIONS = [
  { value: "all", label: "Svi statusi" },
  { value: "draft", label: "Nacrt" },
  { value: "posted", label: "Proknjiženo" },
];

export default function Popisi() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("robno.prijemnice", "write");
  const canPost = hasAccess("robno.prijemnice", "admin");

  const { counts, isLoading, createCount, deleteCount, postCount, unpostCount } = useInventoryCounts();
  const { warehouses } = useWarehouses(selectedCompany?.id);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<InventoryCount | null>(null);
  const [postConfirm, setPostConfirm] = useState<InventoryCount | null>(null);
  const [unpostConfirm, setUnpostConfirm] = useState<InventoryCount | null>(null);

  const filteredCounts = useMemo(() => {
    return counts.filter((c) => {
      const matchesSearch =
        c.count_number.toLowerCase().includes(search.toLowerCase()) ||
        c.warehouse?.name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesWarehouse = warehouseFilter === "all" || c.warehouse_id === warehouseFilter;
      const matchesDateFrom = !dateFrom || c.count_date >= dateFrom;
      const matchesDateTo = !dateTo || c.count_date <= dateTo;
      return matchesSearch && matchesStatus && matchesWarehouse && matchesDateFrom && matchesDateTo;
    });
  }, [counts, search, statusFilter, warehouseFilter]);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("count_number", "desc");
  const sortedData = useMemo(() => {
    return sortItems(filteredCounts, (item, column) => {
      switch (column) {
        case "count_number": return item.count_number;
        case "count_date": return item.count_date;
        case "warehouse.name": return item.warehouse?.name || "";
        default: return "";
      }
    });
  }, [filteredCounts, sortItems]);

  if (isLoading) {
    return (
      <MainLayout title="Popisi">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Popisi">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pretraži po broju ili magacinu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Svi magacini" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi magacini</SelectItem>
              {warehouses.map((wh) => <SelectItem key={wh.id} value={wh.id}>{wh.code} - {wh.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label className="text-xs">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[170px]" />
          </div>
          {canEdit && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Nova popisna lista
            </Button>
          )}
        </div>

        <TableScrollContainer>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead><SortableHeader label="Broj" column="count_number" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader label="Datum" column="count_date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader label="Magacin" column="warehouse.name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {counts.length === 0 ? "Nema popisa. Kliknite 'Nova popisna lista'." : "Nema rezultata."}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((c) => (
                  <TableRow key={c.id} className="relative cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <a
                        href={`/magacin/popisi/${c.id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/magacin/popisi/${c.id}`); }}
                        className="absolute inset-0 z-0"
                        aria-hidden="true"
                      />
                      <span className="relative z-[1]">{c.count_number}</span>
                    </TableCell>
                    <TableCell>{format(new Date(c.count_date), "dd.MM.yyyy", { locale: sr })}</TableCell>
                    <TableCell>{c.warehouse?.code} - {c.warehouse?.name}</TableCell>
                    <TableCell>
                      {c.status === "posted" ? (
                        <Badge variant="default">Proknjiženo</Badge>
                      ) : (
                        <Badge variant="secondary">Nacrt</Badge>
                      )}
                    </TableCell>
                    <TableCell className="relative z-10" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a href={`/magacin/popisi/${c.id}`} onClick={(e) => { e.preventDefault(); navigate(`/magacin/popisi/${c.id}`); }}>
                              <Eye className="h-4 w-4 mr-2" />Prikaži
                            </a>
                          </DropdownMenuItem>
                          {c.status === "draft" && canPost && (
                            <DropdownMenuItem onClick={() => setPostConfirm(c)}>
                              <BookCheck className="h-4 w-4 mr-2" />Proknjiži
                            </DropdownMenuItem>
                          )}
                          {c.status === "posted" && canPost && (
                            <DropdownMenuItem onClick={() => setUnpostConfirm(c)}>
                              <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
                            </DropdownMenuItem>
                          )}
                          {c.status === "draft" && canEdit && (
                            <DropdownMenuItem onClick={() => setDeleteConfirm(c)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />Obriši
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
        </TableScrollContainer>
      </div>

      <InventoryCountDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={async (data) => {
          const created = await createCount.mutateAsync(data);
          setIsCreateDialogOpen(false);
          navigate(`/magacin/popisi/${created.id}`);
        }}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisati popisnu listu?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete popis <strong>{deleteConfirm?.count_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteConfirm) { await deleteCount.mutateAsync(deleteConfirm.id); setDeleteConfirm(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Obriši</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!postConfirm} onOpenChange={() => setPostConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjižiti popis?</AlertDialogTitle>
            <AlertDialogDescription>
              Knjiženje popisa <strong>{postConfirm?.count_number}</strong> će kreirati nalog za knjiženje i ažurirati magacinsko stanje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (postConfirm) { await postCount.mutateAsync(postConfirm.id); setPostConfirm(null); } }}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!unpostConfirm} onOpenChange={() => setUnpostConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništiti knjiženje?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje popisa <strong>{unpostConfirm?.count_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (unpostConfirm) { await unpostCount.mutateAsync(unpostConfirm.id); setUnpostConfirm(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Poništi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
