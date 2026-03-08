import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Loader2,
  MoreHorizontal,
  Eye,
  BookCheck,
  Undo2,
  FileDown,
  Trash2,
} from "lucide-react";
import { useGoodsReceipts, GoodsReceipt } from "@/hooks/useGoodsReceipts";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { GoodsReceiptDialog } from "@/components/magacin/GoodsReceiptDialog";

import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { supabase } from "@/integrations/supabase/client";
import { exportGoodsReceiptPdf } from "@/lib/goodsReceiptPdfGenerator";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "all", label: "Svi statusi" },
  { value: "draft", label: "Nacrt" },
  { value: "posted", label: "Proknjižena" },
];

export default function Prijemnice() {
  const navigate = useNavigate();
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);
  
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

      const matchesDateFrom = !dateFrom || receipt.receipt_date >= dateFrom;
      const matchesDateTo = !dateTo || receipt.receipt_date <= dateTo;

      return matchesSearch && matchesStatus && matchesWarehouse && matchesDateFrom && matchesDateTo;
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

  const handleDownloadPdf = async (receipt: GoodsReceipt) => {
    if (!selectedCompany?.id) return;
    try {
      const [{ data: items }, { data: company }] = await Promise.all([
        supabase
          .from("goods_receipt_items")
          .select("*")
          .eq("goods_receipt_id", receipt.id)
          .order("item_order"),
        supabase
          .from("companies")
          .select("name, address, city, postal_code, pib, mb")
          .eq("id", selectedCompany.id)
          .single(),
      ]);
      if (!items || !company) throw new Error("Greška pri učitavanju podataka");
      await exportGoodsReceiptPdf(receipt, items as any, company);
    } catch (err: any) {
      toast.error(err.message || "Greška pri generisanju PDF-a");
    }
  };

  const getStatusBadge = (status: string, sourceInvoiceId: string | null) => {
    if (status === "posted") {
      return (
        <Badge variant="default">
          Proknjižena
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
    return <Badge variant="secondary">Nacrt</Badge>;
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
                <TableHead className="w-16"></TableHead>
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
                    className="relative cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">
                      <a
                        href={`/magacin/prijemnice/${receipt.id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/magacin/prijemnice/${receipt.id}`); }}
                        className="absolute inset-0 z-0"
                        aria-hidden="true"
                      />
                      <span className="relative z-[1]">
                        {receipt.receipt_number}
                      </span>
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
                    <TableCell className="relative z-10" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a
                              href={`/magacin/prijemnice/${receipt.id}`}
                              onClick={(e) => { e.preventDefault(); navigate(`/magacin/prijemnice/${receipt.id}`); }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Prikaži
                            </a>
                          </DropdownMenuItem>
                          {receipt.status === "draft" && canPost && !receipt.source_invoice_id && (
                            <DropdownMenuItem onClick={() => setPostConfirmReceipt(receipt)}>
                              <BookCheck className="h-4 w-4 mr-2" />
                              Proknjiži
                            </DropdownMenuItem>
                          )}
                          {receipt.status === "posted" && canPost && !receipt.source_invoice_id && (
                            <DropdownMenuItem onClick={() => setUnpostConfirmReceipt(receipt)}>
                              <Undo2 className="h-4 w-4 mr-2" />
                              Poništi knjiženje
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDownloadPdf(receipt)}>
                            <FileDown className="h-4 w-4 mr-2" />
                            PDF
                          </DropdownMenuItem>
                          {receipt.status === "draft" && canEdit && !receipt.source_invoice_id && (
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirmReceipt(receipt)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Obriši
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
