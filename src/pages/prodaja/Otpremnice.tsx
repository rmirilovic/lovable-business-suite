import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
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

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFromQuoteDialog, setShowFromQuoteDialog] = useState(false);
  const [showFromOrderDialog, setShowFromOrderDialog] = useState(false);

  const filteredDeliveryNotes = (deliveryNotes || []).filter((dn) => {
    const matchesSearch =
      dn.delivery_number.toLowerCase().includes(search.toLowerCase()) ||
      dn.partner?.name?.toLowerCase().includes(search.toLowerCase()) ||
      dn.partner?.code?.toLowerCase().includes(search.toLowerCase());
    const matchesDateFrom = !dateFrom || dn.delivery_date >= dateFrom;
    const matchesDateTo = !dateTo || dn.delivery_date <= dateTo;
    return matchesSearch && matchesDateFrom && matchesDateTo;
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
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
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
          </div>
          <div className="flex items-center gap-2">
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
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Broj</TableHead>
                <TableHead className="w-[90px]">Datum</TableHead>
                <TableHead>Kupac</TableHead>
                <TableHead className="w-[300px]">Magacin</TableHead>
                <TableHead className="w-[80px]">Faktura</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : filteredDeliveryNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nema otpremnica
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeliveryNotes.map((dn) => (
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

      {/* Create from quote dialog */}
      <CreateDeliveryNoteFromQuoteDialog
        open={showFromQuoteDialog}
        onOpenChange={setShowFromQuoteDialog}
        onSuccess={handleFromSuccess}
      />

      {/* Create from delivery order dialog */}
      <CreateDeliveryNoteFromOrderDialog
        open={showFromOrderDialog}
        onOpenChange={setShowFromOrderDialog}
        onSuccess={handleFromSuccess}
      />
    </MainLayout>
  );
}
