import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { FileText, Package, Send, Trash2, Edit, FileCheck } from "lucide-react";
import {
  useDeliveryNoteWithItems,
  usePostDeliveryNote,
  useDeleteDeliveryNote,
  DeliveryNoteItemData,
} from "@/hooks/useDeliveryNotes";
import { DeliveryNoteItemsEditor } from "./DeliveryNoteItemsEditor";
import { useAuth } from "@/contexts/AuthContext";
import { formatDecimal } from "@/lib/formatting";

interface DeliveryNoteDetailDialogProps {
  deliveryNoteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onCreateInvoice: () => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  posted: { label: "Proknjižena", variant: "default" },
  cancelled: { label: "Stornirana", variant: "destructive" },
};

export function DeliveryNoteDetailDialog({
  deliveryNoteId,
  open,
  onOpenChange,
  onEdit,
  onCreateInvoice,
}: DeliveryNoteDetailDialogProps) {
  const { user } = useAuth();
  const { data: deliveryNote, isLoading } = useDeliveryNoteWithItems(
    deliveryNoteId || undefined
  );
  const postMutation = usePostDeliveryNote();
  const deleteMutation = useDeleteDeliveryNote();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPostDialog, setShowPostDialog] = useState(false);

  const handlePost = async () => {
    if (!deliveryNoteId || !user) return;
    await postMutation.mutateAsync({
      deliveryNoteId,
      userId: user.id,
    });
    setShowPostDialog(false);
  };

  const handleDelete = async () => {
    if (!deliveryNoteId) return;
    await deleteMutation.mutateAsync(deliveryNoteId);
    setShowDeleteDialog(false);
    onOpenChange(false);
  };

  if (!deliveryNoteId || isLoading || !deliveryNote) {
    return null;
  }

  const isDraft = deliveryNote.status === "draft";
  const isPosted = deliveryNote.status === "posted";
  const canCreateInvoice = isPosted && !deliveryNote.invoice_id;

  const itemsForEditor: DeliveryNoteItemData[] = deliveryNote.items.map((item) => ({
    article_id: item.article_id,
    item_code: item.item_code,
    item_name: item.item_name,
    description: item.description || "",
    unit: item.unit,
    quantity: item.quantity,
    available_stock: 0, // Not relevant for display
  }));

  // Check for stock issues
  const hasStockIssues = itemsForEditor.some(
    (item) => item.quantity > item.available_stock
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl">
                  {deliveryNote.delivery_number}
                </DialogTitle>
                <Badge variant={STATUS_LABELS[deliveryNote.status].variant}>
                  {STATUS_LABELS[deliveryNote.status].label}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {isDraft && (
                  <>
                    <Button variant="outline" size="sm" onClick={onEdit}>
                      <Edit className="h-4 w-4 mr-1" />
                      Izmeni
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setShowPostDialog(true)}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Proknjiži
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Obriši
                    </Button>
                  </>
                )}
                {canCreateInvoice && (
                  <Button variant="default" size="sm" onClick={onCreateInvoice}>
                    <FileCheck className="h-4 w-4 mr-1" />
                    Kreiraj fakturu
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Kupac</div>
                <div className="font-medium">
                  {deliveryNote.partner?.code} - {deliveryNote.partner?.name}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Magacin</div>
                <div className="font-medium">
                  {deliveryNote.warehouse?.code} - {deliveryNote.warehouse?.name}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Datum otpreme</div>
                <div className="font-medium">
                  {format(new Date(deliveryNote.delivery_date), "dd.MM.yyyy", {
                    locale: sr,
                  })}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Broj stavki</div>
                <div className="font-medium">{deliveryNote.items.length}</div>
              </div>
            </div>

            {deliveryNote.invoice_id && (
              <div className="p-3 bg-primary/10 rounded-lg flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  Ova otpremnica je fakturisana
                </span>
              </div>
            )}

            <Separator />

            {/* Tabs */}
            <Tabs defaultValue="items">
              <TabsList>
                <TabsTrigger value="items" className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  Stavke ({deliveryNote.items.length})
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Napomene
                </TabsTrigger>
              </TabsList>

              <TabsContent value="items" className="mt-4">
                <DeliveryNoteItemsEditor
                  items={itemsForEditor}
                  onChange={() => {}}
                  disabled
                />
              </TabsContent>

              <TabsContent value="notes" className="mt-4 space-y-4">
                {deliveryNote.note && (
                  <div>
                    <div className="text-sm font-medium mb-1">
                      Napomena na dokumentu
                    </div>
                    <div className="p-3 bg-muted rounded-md text-sm">
                      {deliveryNote.note}
                    </div>
                  </div>
                )}
                {deliveryNote.internal_note && (
                  <div>
                    <div className="text-sm font-medium mb-1">
                      Interna napomena
                    </div>
                    <div className="p-3 bg-muted rounded-md text-sm">
                      {deliveryNote.internal_note}
                    </div>
                  </div>
                )}
                {!deliveryNote.note && !deliveryNote.internal_note && (
                  <div className="text-center text-muted-foreground py-4">
                    Nema napomena
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post confirmation dialog */}
      <AlertDialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjižiti otpremnicu?</AlertDialogTitle>
            <AlertDialogDescription>
              Knjiženje otpremnice će automatski umanjiti zalihe u magacinu.
              Ova akcija se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePost}
              disabled={postMutation.isPending}
            >
              {postMutation.isPending ? "Knjiženje..." : "Proknjiži"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisati otpremnicu?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete ovu otpremnicu? Ova akcija
              se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Brisanje..." : "Obriši"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
