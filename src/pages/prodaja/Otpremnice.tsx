import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Trash2,
  Package,
  Truck,
  FileSpreadsheet,
  FileText,
  Printer,
} from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDeliveryNotes,
  useDeleteDeliveryNote,
  DeliveryNote,
} from "@/hooks/useDeliveryNotes";
import { CreateDeliveryNoteFromQuoteDialog } from "@/components/prodaja/CreateDeliveryNoteFromQuoteDialog";
import { CreateDeliveryNoteFromOrderDialog } from "@/components/prodaja/CreateDeliveryNoteFromOrderDialog";
import { exportDeliveryNotesToExcel, exportDeliveryNotesToPdf, printDeliveryNotes } from "@/lib/deliveryNoteListExportUtils";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";

const STATUS_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Nacrt", variant: "secondary" },
  posted: { label: "Proknjižena", variant: "default" },
  cancelled: { label: "Stornirana", variant: "destructive" },
};

export default function Otpremnice() {
  const navigate = useNavigate();
  const { selectedCompany, selectedYear } = useAuth();
  const { data: deliveryNotes, isLoading } = useDeliveryNotes(
    selectedCompany?.id,
    selectedYear?.id
  );
  const deleteMutation = useDeleteDeliveryNote();
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [issuedByFilter, setIssuedByFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFromQuoteDialog, setShowFromQuoteDialog] = useState(false);
  const [showFromOrderDialog, setShowFromOrderDialog] = useState(false);

  const filteredDeliveryNotes = (deliveryNotes || []).filter((dn) => {
    const matchesSearch =
      dn.delivery_number.toLowerCase().includes(search.toLowerCase()) ||
      dn.partner?.name?.toLowerCase().includes(search.toLowerCase()) ||
      dn.partner?.code?.toLowerCase().includes(search.toLowerCase());
    const matchesDateFrom = !dateFrom || dn.delivery_date >= dateFrom;
    const matchesDateTo = !dateTo || dn.delivery_date <= dateTo;
    const matchesIssuedBy = issuedByFilter === "all" || (dn.issued_by ?? "") === issuedByFilter;
    const matchesStatus = statusFilter === "all" || dn.status === statusFilter;
    return matchesSearch && matchesDateFrom && matchesDateTo && matchesIssuedBy && matchesStatus;
  });

  const sortedDeliveryNotes = sortItems(filteredDeliveryNotes, (dn: DeliveryNote, column: string) => {
    switch (column) {
      case "delivery_number": return dn.delivery_number;
      case "delivery_date": return dn.delivery_date;
      case "partner": return dn.partner?.name ?? "";
      case "warehouse": return dn.warehouse ? `${dn.warehouse.code} - ${dn.warehouse.name}` : "";
      case "invoice": return dn.invoice?.invoice_number ?? "";
      case "issued_by": return dn.issued_by ?? "";
      case "status": return STATUS_LABELS[dn.status]?.label ?? dn.status;
      default: return null;
    }
  });

  const handleNavigate = (dn: DeliveryNote) => {
    navigate(`/prodaja/otpremnice/${dn.id}`);
  };

  const handleDelete = async (dn: DeliveryNote) => {
    if (window.confirm(`Da li ste sigurni da želite da obrišete otpremnicu ${dn.delivery_number}?`)) {
      await deleteMutation.mutateAsync(dn.id);
    }
  };

  const handleFromSuccess = (deliveryNoteId: string) => {
    navigate(`/prodaja/otpremnice/${deliveryNoteId}`);
  };

  return (
    <MainLayout title="Otpremnice">
      <div className="flex-1 min-h-0 overflow-auto space-y-4">
        {/* Actions row */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => exportDeliveryNotesToExcel(filteredDeliveryNotes, { companyName: selectedCompany?.name || "", dateFrom, dateTo })}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportDeliveryNotesToPdf(filteredDeliveryNotes, { companyName: selectedCompany?.name || "", dateFrom, dateTo })}>
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => printDeliveryNotes(filteredDeliveryNotes, { companyName: selectedCompany?.name || "", dateFrom, dateTo })}>
            <Printer className="w-4 h-4 mr-2" /> Štampa
          </Button>
          <Button variant="outline" onClick={() => setShowFromOrderDialog(true)}>
            <Truck className="h-4 w-4 mr-2" />
            Iz naloga
          </Button>
          <Button variant="outline" onClick={() => setShowFromQuoteDialog(true)}>
            <Package className="h-4 w-4 mr-2" />
            Iz ponude
          </Button>
          <Button onClick={() => navigate("/prodaja/otpremnice/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Nova otpremnica
          </Button>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži otpremnice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Robu izdao</Label>
            <Select value={issuedByFilter} onValueChange={setIssuedByFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi</SelectItem>
                {[...new Set((deliveryNotes || []).map(dn => dn.issued_by).filter(Boolean))].sort().map(name => (
                  <SelectItem key={name!} value={name!}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi</SelectItem>
                <SelectItem value="draft">Nacrt</SelectItem>
                <SelectItem value="posted">Proknjižena</SelectItem>
                <SelectItem value="cancelled">Stornirana</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]"><SortableHeader column="delivery_number" label="Broj" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[90px]"><SortableHeader column="delivery_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader column="partner" label="Kupac" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[300px]"><SortableHeader column="warehouse" label="Magacin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[80px]"><SortableHeader column="invoice" label="Faktura" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[150px]"><SortableHeader column="issued_by" label="Robu izdao" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[80px]"><SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : sortedDeliveryNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nema otpremnica
                  </TableCell>
                </TableRow>
              ) : (
                sortedDeliveryNotes.map((dn) => (
                  <TableRow
                    key={dn.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleNavigate(dn)}
                  >
                    <TableCell className="font-medium">{dn.delivery_number}</TableCell>
                    <TableCell>
                      {format(new Date(dn.delivery_date), "dd.MM.yyyy", { locale: sr })}
                    </TableCell>
                    <TableCell>
                      {dn.partner?.code} - {dn.partner?.name}
                    </TableCell>
                    <TableCell>
                      {dn.warehouse?.code} - {dn.warehouse?.name}
                    </TableCell>
                    <TableCell>
                      {dn.invoice?.invoice_number || "-"}
                    </TableCell>
                    <TableCell>
                      {dn.issued_by || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_LABELS[dn.status].variant}>
                        {STATUS_LABELS[dn.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleNavigate(dn)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Prikaži
                          </DropdownMenuItem>
                          {dn.status === "draft" && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(dn)}
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
        </div>
      </div>

      <CreateDeliveryNoteFromQuoteDialog
        open={showFromQuoteDialog}
        onOpenChange={setShowFromQuoteDialog}
        onSuccess={handleFromSuccess}
      />

      <CreateDeliveryNoteFromOrderDialog
        open={showFromOrderDialog}
        onOpenChange={setShowFromOrderDialog}
        onSuccess={handleFromSuccess}
      />
    </MainLayout>
  );
}
