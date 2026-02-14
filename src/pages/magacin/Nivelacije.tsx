import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { usePriceAdjustments, PriceAdjustment } from "@/hooks/usePriceAdjustments";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { PriceAdjustmentDialog } from "@/components/magacin/PriceAdjustmentDialog";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { formatDecimal } from "@/lib/formatting";

const STATUS_OPTIONS = [
  { value: "all", label: "Svi statusi" },
  { value: "draft", label: "Nacrt" },
  { value: "posted", label: "Proknjiženo" },
];

export default function Nivelacije() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("robno.prijemnice", "write");
  const canPost = hasAccess("robno.prijemnice", "admin");

  const { adjustments, isLoading, createAdjustment, deleteAdjustment, postAdjustment, unpostAdjustment } = usePriceAdjustments();
  const { warehouses } = useWarehouses(selectedCompany?.id);

  // Only SVK=1 warehouses for filter
  const svk1Warehouses = warehouses.filter((w) => w.warehouse_type === "1");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<PriceAdjustment | null>(null);
  const [postConfirm, setPostConfirm] = useState<PriceAdjustment | null>(null);
  const [unpostConfirm, setUnpostConfirm] = useState<PriceAdjustment | null>(null);

  const filteredData = useMemo(() => {
    return adjustments.filter((a) => {
      const matchesSearch =
        a.adjustment_number.toLowerCase().includes(search.toLowerCase()) ||
        a.warehouse?.name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || a.status === statusFilter;
      const matchesWarehouse = warehouseFilter === "all" || a.warehouse_id === warehouseFilter;
      return matchesSearch && matchesStatus && matchesWarehouse;
    });
  }, [adjustments, search, statusFilter, warehouseFilter]);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("adjustment_number", "desc");
  const sortedData = useMemo(() => {
    return sortItems(filteredData, (item, column) => {
      switch (column) {
        case "adjustment_number": return item.adjustment_number;
        case "adjustment_date": return item.adjustment_date;
        case "warehouse.name": return item.warehouse?.name || "";
        default: return "";
      }
    });
  }, [filteredData, sortItems]);

  if (isLoading) {
    return (
      <MainLayout title="Nivelacije cena">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Nivelacije cena">
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
              {svk1Warehouses.map((wh) => <SelectItem key={wh.id} value={wh.id}>{wh.code} - {wh.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {canEdit && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Nova nivelacija
            </Button>
          )}
        </div>

        <TableScrollContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortableHeader label="Broj" column="adjustment_number" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader label="Datum" column="adjustment_date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader label="Magacin" column="warehouse.name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="text-right">Povećanje</TableHead>
                <TableHead className="text-right">Smanjenje</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {adjustments.length === 0 ? "Nema nivelacija. Kliknite 'Nova nivelacija'." : "Nema rezultata."}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((a) => (
                  <TableRow key={a.id} className="relative cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <a
                        href={`/magacin/nivelacije/${a.id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/magacin/nivelacije/${a.id}`); }}
                        className="absolute inset-0 z-0"
                        aria-hidden="true"
                      />
                      <span className="relative z-[1]">{a.adjustment_number}</span>
                    </TableCell>
                    <TableCell>{format(new Date(a.adjustment_date), "dd.MM.yyyy", { locale: sr })}</TableCell>
                    <TableCell>{a.warehouse?.code} - {a.warehouse?.name}</TableCell>
                    <TableCell className="text-right text-green-600">{a.total_increase > 0 ? formatDecimal(a.total_increase, 2) : ""}</TableCell>
                    <TableCell className="text-right text-destructive">{a.total_decrease > 0 ? formatDecimal(a.total_decrease, 2) : ""}</TableCell>
                    <TableCell>
                      {a.status === "posted" ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">Proknjiženo</Badge>
                      ) : (
                        <Badge variant="outline">Nacrt</Badge>
                      )}
                    </TableCell>
                    <TableCell className="relative z-10" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a href={`/magacin/nivelacije/${a.id}`} onClick={(e) => { e.preventDefault(); navigate(`/magacin/nivelacije/${a.id}`); }}>
                              <Eye className="h-4 w-4 mr-2" />Prikaži
                            </a>
                          </DropdownMenuItem>
                          {a.status === "draft" && canPost && (
                            <DropdownMenuItem onClick={() => setPostConfirm(a)}>
                              <BookCheck className="h-4 w-4 mr-2" />Proknjiži
                            </DropdownMenuItem>
                          )}
                          {a.status === "posted" && canPost && (
                            <DropdownMenuItem onClick={() => setUnpostConfirm(a)}>
                              <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
                            </DropdownMenuItem>
                          )}
                          {a.status === "draft" && canEdit && (
                            <DropdownMenuItem onClick={() => setDeleteConfirm(a)} className="text-destructive">
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

      <PriceAdjustmentDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={async (data) => {
          const created = await createAdjustment.mutateAsync(data);
          setIsCreateDialogOpen(false);
          navigate(`/magacin/nivelacije/${created.id}`);
        }}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisati nivelaciju?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete nivelaciju <strong>{deleteConfirm?.adjustment_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteConfirm) { await deleteAdjustment.mutateAsync(deleteConfirm.id); setDeleteConfirm(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Obriši</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!postConfirm} onOpenChange={() => setPostConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjižiti nivelaciju?</AlertDialogTitle>
            <AlertDialogDescription>
              Knjiženje nivelacije <strong>{postConfirm?.adjustment_number}</strong> će ažurirati prodajne cene artikala i kreirati nalog za knjiženje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (postConfirm) { await postAdjustment.mutateAsync(postConfirm.id); setPostConfirm(null); } }}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!unpostConfirm} onOpenChange={() => setUnpostConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništiti knjiženje?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje nivelacije <strong>{unpostConfirm?.adjustment_number}</strong>? Prodajne cene će biti vraćene na prethodne vrednosti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (unpostConfirm) { await unpostAdjustment.mutateAsync(unpostConfirm.id); setUnpostConfirm(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Poništi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
