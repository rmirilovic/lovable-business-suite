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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Search, Loader2, MoreHorizontal, Eye, BookCheck, Undo2, Trash2,
} from "lucide-react";
import {
  useInterWarehouseTransfers, InterWarehouseTransfer,
} from "@/hooks/useInterWarehouseTransfers";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { TransferDialog } from "@/components/magacin/TransferDialog";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";

const STATUS_OPTIONS = [
  { value: "all", label: "Svi statusi" },
  { value: "draft", label: "Nacrt" },
  { value: "posted", label: "Proknjiženo" },
];

export default function MedjumagacinskiPrenosi() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("robno.prijemnice", "write");
  const canPost = hasAccess("robno.prijemnice", "admin");

  const {
    transfers, isLoading, createTransfer, deleteTransfer, postTransfer, unpostTransfer,
  } = useInterWarehouseTransfers();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<InterWarehouseTransfer | null>(null);
  const [postConfirm, setPostConfirm] = useState<InterWarehouseTransfer | null>(null);
  const [unpostConfirm, setUnpostConfirm] = useState<InterWarehouseTransfer | null>(null);

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const matchesSearch =
        t.transfer_number.toLowerCase().includes(search.toLowerCase()) ||
        t.source_warehouse?.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.destination_warehouse?.name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesDateFrom = !dateFrom || t.transfer_date >= dateFrom;
      const matchesDateTo = !dateTo || t.transfer_date <= dateTo;
      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [transfers, search, statusFilter]);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("transfer_number", "desc");

  const sortedData = useMemo(() => {
    return sortItems(filteredTransfers, (item, column) => {
      switch (column) {
        case "transfer_number": return item.transfer_number;
        case "transfer_date": return item.transfer_date;
        case "source_warehouse": return item.source_warehouse?.name || "";
        case "destination_warehouse": return item.destination_warehouse?.name || "";
        default: return "";
      }
    });
  }, [filteredTransfers, sortItems]);

  if (isLoading) {
    return (
      <MainLayout title="Međumagacinski prenosi">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Međumagacinski prenosi">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po broju ili magacinu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
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
              <Plus className="h-4 w-4 mr-2" />
              Novi prenos
            </Button>
          )}
        </div>

        <TableScrollContainer>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader label="Broj" column="transfer_number" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Datum" column="transfer_date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Iz magacina" column="source_warehouse" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="U magacin" column="destination_warehouse" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <p className="text-muted-foreground">
                      {transfers.length === 0
                        ? "Nema prenosa. Kliknite 'Novi prenos' da kreirate prvi."
                        : "Nema rezultata za zadati filter."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((transfer) => (
                  <TableRow key={transfer.id} className="relative cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <a
                        href={`/magacin/prenosi/${transfer.id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/magacin/prenosi/${transfer.id}`); }}
                        className="absolute inset-0 z-0"
                        aria-hidden="true"
                      />
                      <span className="relative z-[1]">{transfer.transfer_number}</span>
                    </TableCell>
                    <TableCell>
                      {format(new Date(transfer.transfer_date), "dd.MM.yyyy", { locale: sr })}
                    </TableCell>
                    <TableCell>
                      {transfer.source_warehouse?.code} - {transfer.source_warehouse?.name}
                    </TableCell>
                    <TableCell>
                      {transfer.destination_warehouse?.code} - {transfer.destination_warehouse?.name}
                    </TableCell>
                    <TableCell>
                      {transfer.status === "posted" ? (
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
                            <a href={`/magacin/prenosi/${transfer.id}`} onClick={(e) => { e.preventDefault(); navigate(`/magacin/prenosi/${transfer.id}`); }}>
                              <Eye className="h-4 w-4 mr-2" />Prikaži
                            </a>
                          </DropdownMenuItem>
                          {transfer.status === "draft" && canPost && (
                            <DropdownMenuItem onClick={() => setPostConfirm(transfer)}>
                              <BookCheck className="h-4 w-4 mr-2" />Proknjiži
                            </DropdownMenuItem>
                          )}
                          {transfer.status === "posted" && canPost && (
                            <DropdownMenuItem onClick={() => setUnpostConfirm(transfer)}>
                              <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
                            </DropdownMenuItem>
                          )}
                          {transfer.status === "draft" && canEdit && (
                            <DropdownMenuItem onClick={() => setDeleteConfirm(transfer)} className="text-destructive">
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

      <TransferDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={async (data) => {
          const result = await createTransfer.mutateAsync(data);
          setIsCreateDialogOpen(false);
          navigate(`/magacin/prenosi/${result.id}`);
        }}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisati prenos?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete prenos <strong>{deleteConfirm?.transfer_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteConfirm) { await deleteTransfer.mutateAsync(deleteConfirm.id); setDeleteConfirm(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Obriši</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!postConfirm} onOpenChange={() => setPostConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjižiti prenos?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da proknjižite prenos <strong>{postConfirm?.transfer_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (postConfirm) { await postTransfer.mutateAsync(postConfirm.id); setPostConfirm(null); } }}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!unpostConfirm} onOpenChange={() => setUnpostConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništiti knjiženje?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje prenosa <strong>{unpostConfirm?.transfer_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (unpostConfirm) { await unpostTransfer.mutateAsync(unpostConfirm.id); setUnpostConfirm(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Poništi knjiženje</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
