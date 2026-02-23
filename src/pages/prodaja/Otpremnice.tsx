import { useState } from "react";
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
  Edit,
  Trash2,
  Send,
  FileText,
  Package,
  Truck,
} from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDeliveryNotes,
  useDeleteDeliveryNote,
  usePostDeliveryNote,
  DeliveryNote,
  DeliveryNoteItemData,
} from "@/hooks/useDeliveryNotes";
import { DeliveryNoteDialog, DeliveryNoteFormData } from "@/components/prodaja/DeliveryNoteDialog";
import { DeliveryNoteDetailDialog } from "@/components/prodaja/DeliveryNoteDetailDialog";
import { DeliveryNoteItemsEditor } from "@/components/prodaja/DeliveryNoteItemsEditor";
import { CreateDeliveryNoteFromQuoteDialog } from "@/components/prodaja/CreateDeliveryNoteFromQuoteDialog";
import { CreateDeliveryNoteFromOrderDialog } from "@/components/prodaja/CreateDeliveryNoteFromOrderDialog";
import { useCreateDeliveryNote, useUpdateDeliveryNote } from "@/hooks/useDeliveryNotes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const STATUS_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Nacrt", variant: "secondary" },
  posted: { label: "Proknjižena", variant: "default" },
  cancelled: { label: "Stornirana", variant: "destructive" },
};

export default function Otpremnice() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const { data: deliveryNotes, isLoading } = useDeliveryNotes(
    selectedCompany?.id,
    selectedYear?.id
  );
  const createMutation = useCreateDeliveryNote();
  const updateMutation = useUpdateDeliveryNote();
  const deleteMutation = useDeleteDeliveryNote();
  const postMutation = usePostDeliveryNote();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showFromQuoteDialog, setShowFromQuoteDialog] = useState(false);
  const [showFromOrderDialog, setShowFromOrderDialog] = useState(false);
  const [selectedDeliveryNote, setSelectedDeliveryNote] = useState<DeliveryNote | null>(null);
  const [pendingFormData, setPendingFormData] = useState<DeliveryNoteFormData | null>(null);
  const [items, setItems] = useState<DeliveryNoteItemData[]>([]);

  const filteredDeliveryNotes = (deliveryNotes || []).filter(
    (dn) => {
      const matchesSearch =
        dn.delivery_number.toLowerCase().includes(search.toLowerCase()) ||
        dn.partner?.name.toLowerCase().includes(search.toLowerCase()) ||
        dn.partner?.code.toLowerCase().includes(search.toLowerCase());
      const matchesDateFrom = !dateFrom || dn.delivery_date >= dateFrom;
      const matchesDateTo = !dateTo || dn.delivery_date <= dateTo;
      return matchesSearch && matchesDateFrom && matchesDateTo;
    }
  );

  const handleCreateNew = () => {
    setSelectedDeliveryNote(null);
    setItems([]);
    setShowDialog(true);
  };

  const handleFormSubmit = (data: DeliveryNoteFormData) => {
    setPendingFormData(data);
    setShowDialog(false);
    setShowItemsDialog(true);
  };

  const handleSaveWithItems = async () => {
    if (!pendingFormData || !selectedCompany || !selectedYear || !user) return;

    const deliveryNoteData = {
      company_id: selectedCompany.id,
      business_year_id: selectedYear.id,
      delivery_number: "", // Will be generated
      delivery_date: pendingFormData.delivery_date,
      partner_id: pendingFormData.partner_id,
      warehouse_id: pendingFormData.warehouse_id,
      org_unit_id: pendingFormData.org_unit_id,
      note: pendingFormData.note || null,
      internal_note: pendingFormData.internal_note || null,
      status: "draft" as const,
      invoice_id: null,
      created_by: user.id,
    };

    const itemsData = items.map((item) => ({
      article_id: item.article_id,
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description || null,
      unit: item.unit,
      quantity: item.quantity,
      item_order: 0, // Will be set in mutation
    }));

    if (selectedDeliveryNote) {
      await updateMutation.mutateAsync({
        id: selectedDeliveryNote.id,
        deliveryNote: {
          delivery_date: pendingFormData.delivery_date,
          partner_id: pendingFormData.partner_id,
          warehouse_id: pendingFormData.warehouse_id,
          org_unit_id: pendingFormData.org_unit_id,
          note: pendingFormData.note || null,
          internal_note: pendingFormData.internal_note || null,
          company_id: selectedCompany.id,
        },
        items: itemsData,
      });
    } else {
      await createMutation.mutateAsync({
        deliveryNote: deliveryNoteData,
        items: itemsData,
      });
    }

    setShowItemsDialog(false);
    setPendingFormData(null);
    setItems([]);
  };

  const handleEdit = (deliveryNote: DeliveryNote) => {
    setSelectedDeliveryNote(deliveryNote);
    setShowDetailDialog(false);
    setShowDialog(true);
  };

  const handleView = (deliveryNote: DeliveryNote) => {
    setSelectedDeliveryNote(deliveryNote);
    setShowDetailDialog(true);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const handlePost = async (deliveryNote: DeliveryNote) => {
    if (!user) return;
    await postMutation.mutateAsync({
      deliveryNoteId: deliveryNote.id,
      userId: user.id,
    });
  };

  const handleFromQuoteSuccess = (deliveryNoteId: string) => {
    // Could navigate to detail view
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
            <Button variant="outline" onClick={() => setShowFromOrderDialog(true)}>
              <Truck className="h-4 w-4 mr-2" />
              Iz naloga
            </Button>
            <Button variant="outline" onClick={() => setShowFromQuoteDialog(true)}>
              <Package className="h-4 w-4 mr-2" />
              Iz ponude
            </Button>
            <Button onClick={handleCreateNew}>
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
                <TableHead>Broj</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Kupac</TableHead>
                <TableHead>Magacin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fakturisano</TableHead>
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
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Nema otpremnica
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeliveryNotes.map((dn) => (
                  <TableRow
                    key={dn.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleView(dn)}
                  >
                    <TableCell className="font-medium">
                      {dn.delivery_number}
                    </TableCell>
                    <TableCell>
                      {format(new Date(dn.delivery_date), "dd.MM.yyyy", {
                        locale: sr,
                      })}
                    </TableCell>
                    <TableCell>
                      {dn.partner?.code} - {dn.partner?.name}
                    </TableCell>
                    <TableCell>
                      {dn.warehouse?.code} - {dn.warehouse?.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_LABELS[dn.status].variant}>
                        {STATUS_LABELS[dn.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dn.invoice_id ? (
                        <Badge variant="outline">Da</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(dn)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Pregled
                          </DropdownMenuItem>
                          {dn.status === "draft" && (
                            <>
                              <DropdownMenuItem onClick={() => handleEdit(dn)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Izmeni
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePost(dn)}>
                                <Send className="h-4 w-4 mr-2" />
                                Proknjiži
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(dn.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Obriši
                              </DropdownMenuItem>
                            </>
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

      {/* Header dialog */}
      <DeliveryNoteDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onSubmit={handleFormSubmit}
        initialData={
          selectedDeliveryNote
            ? {
                partner_id: selectedDeliveryNote.partner_id,
                warehouse_id: selectedDeliveryNote.warehouse_id || "",
                org_unit_id: selectedDeliveryNote.org_unit_id,
                delivery_date: selectedDeliveryNote.delivery_date,
                note: selectedDeliveryNote.note || "",
                internal_note: selectedDeliveryNote.internal_note || "",
              }
            : undefined
        }
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* Items editor dialog */}
      <Dialog open={showItemsDialog} onOpenChange={setShowItemsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stavke otpremnice</DialogTitle>
          </DialogHeader>
          <DeliveryNoteItemsEditor items={items} onChange={setItems} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemsDialog(false)}>
              Nazad
            </Button>
            <Button
              onClick={handleSaveWithItems}
              disabled={
                items.length === 0 ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Čuvanje..."
                : "Sačuvaj otpremnicu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <DeliveryNoteDetailDialog
        deliveryNoteId={selectedDeliveryNote?.id || null}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        onEdit={() => {
          if (selectedDeliveryNote) {
            handleEdit(selectedDeliveryNote);
          }
        }}
        onCreateInvoice={() => {
          // Navigate to invoice creation - will be handled separately
          setShowDetailDialog(false);
        }}
      />

      {/* Create from quote dialog */}
      <CreateDeliveryNoteFromQuoteDialog
        open={showFromQuoteDialog}
        onOpenChange={setShowFromQuoteDialog}
        onSuccess={handleFromQuoteSuccess}
      />

      {/* Create from delivery order dialog */}
      <CreateDeliveryNoteFromOrderDialog
        open={showFromOrderDialog}
        onOpenChange={setShowFromOrderDialog}
        onSuccess={handleFromQuoteSuccess}
      />
    </MainLayout>
  );
}
