import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Plus,
  Search,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCircle,
  Undo2,
} from "lucide-react";
import { useGoodsReceipts, GoodsReceipt } from "@/hooks/useGoodsReceipts";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { GoodsReceiptDialog } from "@/components/magacin/GoodsReceiptDialog";
import { GoodsReceiptDetailDialog } from "@/components/magacin/GoodsReceiptDetailDialog";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";

const STATUS_OPTIONS = [
  { value: "all", label: "Svi statusi" },
  { value: "draft", label: "Nacrt" },
  { value: "posted", label: "Proknjiženo" },
];

export default function Prijemnice() {
  const { selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("robno.prijemnice", "write");
  const canPost = hasAccess("robno.prijemnice", "admin");

  const {
    receipts,
    isLoading,
    createReceipt,
    updateReceipt,
    deleteReceipt,
    postReceipt,
    unpostReceipt,
  } = useGoodsReceipts();

  const { warehouses } = useWarehouses(selectedCompany?.id);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);
  const [detailReceipt, setDetailReceipt] = useState<GoodsReceipt | null>(null);
  const [deleteConfirmReceipt, setDeleteConfirmReceipt] = useState<GoodsReceipt | null>(null);
  const [postConfirmReceipt, setPostConfirmReceipt] = useState<GoodsReceipt | null>(null);
  const [unpostConfirmReceipt, setUnpostConfirmReceipt] = useState<GoodsReceipt | null>(null);

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      const matchesSearch =
        receipt.receipt_number.toLowerCase().includes(search.toLowerCase()) ||
        receipt.partner?.name?.toLowerCase().includes(search.toLowerCase()) ||
        receipt.warehouse?.name?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || receipt.status === statusFilter;

      const matchesWarehouse =
        warehouseFilter === "all" || receipt.warehouse_id === warehouseFilter;

      return matchesSearch && matchesStatus && matchesWarehouse;
    });
  }, [receipts, search, statusFilter, warehouseFilter]);

  // Sorting
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("receipt_number", "desc");

  const sortedData = useMemo(() => {
    return sortItems(filteredReceipts, (item, column) => {
      switch (column) {
        case "receipt_number":
          return item.receipt_number;
        case "receipt_date":
          return item.receipt_date;
        case "warehouse.name":
          return item.warehouse?.name || "";
        case "partner.name":
          return item.partner?.name || "";
        default:
          return "";
      }
    });
  }, [filteredReceipts, sortItems]);

  const handleDelete = async () => {
    if (!deleteConfirmReceipt) return;
    await deleteReceipt.mutateAsync(deleteConfirmReceipt.id);
    setDeleteConfirmReceipt(null);
  };

  const handlePost = async () => {
    if (!postConfirmReceipt) return;
    await postReceipt.mutateAsync(postConfirmReceipt.id);
    setPostConfirmReceipt(null);
  };

  const handleUnpost = async () => {
    if (!unpostConfirmReceipt) return;
    await unpostReceipt.mutateAsync(unpostConfirmReceipt.id);
    setUnpostConfirmReceipt(null);
  };

  const getStatusBadge = (status: string, sourceInvoiceId: string | null) => {
    if (status === "posted") {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          Proknjiženo
        </Badge>
      );
    }
    if (sourceInvoiceId) {
      return (
        <Badge variant="secondary">
          Iz fakture
        </Badge>
      );
    }
    return <Badge variant="outline">Nacrt</Badge>;
  };

  if (isLoading) {
    return (
      <MainLayout title="Prijemnice">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Prijemnice">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po broju, partneru ili magacinu..."
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
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Svi magacini" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi magacini</SelectItem>
              {warehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>
                  {wh.code} - {wh.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova prijemnica
            </Button>
          )}
        </div>

        {/* Table */}
        <TableScrollContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    label="Broj"
                    column="receipt_number"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Datum"
                    column="receipt_date"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Magacin"
                    column="warehouse.name"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Partner"
                    column="partner.name"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <p className="text-muted-foreground">
                      {receipts.length === 0
                        ? "Nema prijemnica. Kliknite 'Nova prijemnica' da kreirate prvu."
                        : "Nema rezultata za zadati filter."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((receipt) => (
                  <TableRow
                    key={receipt.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetailReceipt(receipt)}
                  >
                    <TableCell className="font-medium">
                      {receipt.receipt_number}
                      {receipt.source_invoice_id && (
                        <ExternalLink className="inline ml-1 h-3 w-3 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(receipt.receipt_date), "dd.MM.yyyy", {
                        locale: sr,
                      })}
                    </TableCell>
                    <TableCell>
                      {receipt.warehouse?.code} - {receipt.warehouse?.name}
                    </TableCell>
                    <TableCell>
                      {receipt.partner?.name || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(receipt.status, receipt.source_invoice_id)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {receipt.status === "draft" && canPost && !receipt.source_invoice_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPostConfirmReceipt(receipt)}
                            title="Proknjiži"
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {receipt.status === "posted" && canPost && !receipt.source_invoice_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setUnpostConfirmReceipt(receipt)}
                            title="Poništi knjiženje"
                          >
                            <Undo2 className="h-4 w-4 text-orange-600" />
                          </Button>
                        )}
                        {receipt.status === "draft" && canEdit && !receipt.source_invoice_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmReceipt(receipt)}
                            title="Obriši"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>

      {/* Create Dialog */}
      <GoodsReceiptDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={async (data) => {
          await createReceipt.mutateAsync(data);
          setIsCreateDialogOpen(false);
        }}
      />

      {/* Edit Dialog */}
      {selectedReceipt && (
        <GoodsReceiptDialog
          open={!!selectedReceipt}
          onOpenChange={() => setSelectedReceipt(null)}
          receipt={selectedReceipt}
          onSave={async (data) => {
            await updateReceipt.mutateAsync({ id: selectedReceipt.id, ...data });
            setSelectedReceipt(null);
          }}
        />
      )}

      {/* Detail Dialog */}
      {detailReceipt && (
        <GoodsReceiptDetailDialog
          receipt={detailReceipt}
          open={!!detailReceipt}
          onOpenChange={() => setDetailReceipt(null)}
          onEdit={canEdit && detailReceipt.status === "draft" && !detailReceipt.source_invoice_id
            ? () => {
                setDetailReceipt(null);
                setSelectedReceipt(detailReceipt);
              }
            : undefined}
          onPost={canPost && detailReceipt.status === "draft" && !detailReceipt.source_invoice_id
            ? () => {
                setDetailReceipt(null);
                setPostConfirmReceipt(detailReceipt);
              }
            : undefined}
          onUnpost={canPost && detailReceipt.status === "posted" && !detailReceipt.source_invoice_id
            ? () => {
                setDetailReceipt(null);
                setUnpostConfirmReceipt(detailReceipt);
              }
            : undefined}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirmReceipt}
        onOpenChange={() => setDeleteConfirmReceipt(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisati prijemnicu?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete prijemnicu{" "}
              <strong>{deleteConfirmReceipt?.receipt_number}</strong>? Ova akcija
              se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Post Confirmation */}
      <AlertDialog
        open={!!postConfirmReceipt}
        onOpenChange={() => setPostConfirmReceipt(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjižiti prijemnicu?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da proknjižite prijemnicu{" "}
              <strong>{postConfirmReceipt?.receipt_number}</strong>? Knjiženje će
              ažurirati zalihe artikala.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={handlePost}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unpost Confirmation */}
      <AlertDialog
        open={!!unpostConfirmReceipt}
        onOpenChange={() => setUnpostConfirmReceipt(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništiti knjiženje?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje prijemnice{" "}
              <strong>{unpostConfirmReceipt?.receipt_number}</strong>? Zalihe
              artikala će biti vraćene na prethodno stanje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnpost}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Poništi knjiženje
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
