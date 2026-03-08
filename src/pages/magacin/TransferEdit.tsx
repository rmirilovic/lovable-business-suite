import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Pencil, BookCheck, Undo2, ArrowLeft, RefreshCw, History, MoreHorizontal,
} from "lucide-react";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import {
  InterWarehouseTransfer, useInterWarehouseTransferItems, useInterWarehouseTransfers,
} from "@/hooks/useInterWarehouseTransfers";
import { TransferItemsEditor } from "@/components/magacin/TransferItemsEditor";
import { TransferDialog } from "@/components/magacin/TransferDialog";
import { formatDecimal, formatNumber } from "@/lib/formatting";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useDocumentLock } from "@/hooks/useDocumentLock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArticleTransfersDialog } from "@/components/magacin/ArticleTransfersDialog";

export default function TransferEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("robno.prijemnice", "write");
  const canPost = hasAccess("robno.prijemnice", "admin");

  const [transfer, setTransfer] = useState<InterWarehouseTransfer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [transfersDialogArticle, setTransfersDialogArticle] = useState<{ id: string; code: string; name: string } | null>(null);

  const { items, isLoading: itemsLoading } = useInterWarehouseTransferItems(id || null);
  const { updateTransfer, postTransfer, unpostTransfer } = useInterWarehouseTransfers();

  const { checkLock, updateLockTimestamp } = useDocumentLock({
    tableName: "inter_warehouse_transfers",
    documentId: id || null,
    initialUpdatedAt: transfer?.updated_at || null,
    onConflict: () => fetchTransfer(),
  });

  const fetchTransfer = async () => {
    if (!id) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("inter_warehouse_transfers")
      .select(`
        *,
        source_warehouse:warehouses!inter_warehouse_transfers_source_warehouse_id_fkey(id, code, name, warehouse_type),
        destination_warehouse:warehouses!inter_warehouse_transfers_destination_warehouse_id_fkey(id, code, name, warehouse_type)
      `)
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Greška pri učitavanju dokumenta");
      navigate("/magacin/prenosi");
      return;
    }
    setTransfer(data as InterWarehouseTransfer);
    updateLockTimestamp(data.updated_at);
    setIsLoading(false);
  };

  useEffect(() => { fetchTransfer(); }, [id]);

  const handlePostConfirm = async () => {
    if (!transfer) return;
    const canProceed = await checkLock();
    if (!canProceed) return;
    await postTransfer.mutateAsync(transfer.id);
    setPostDialogOpen(false);
    fetchTransfer();
  };

  const handleUnpostConfirm = async () => {
    if (!transfer) return;
    await unpostTransfer.mutateAsync(transfer.id);
    setUnpostDialogOpen(false);
    fetchTransfer();
  };

  const handleEditSaved = async (data: any) => {
    if (!transfer) return;
    await updateTransfer.mutateAsync({ id: transfer.id, ...data });
    setEditDialogOpen(false);
    fetchTransfer();
  };

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  if (isLoading || !selectedCompany || !selectedYear) {
    return (
      <MainLayout title="Učitavanje...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!transfer) {
    return (
      <MainLayout title="Dokument nije pronađen">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Dokument nije pronađen ili nemate pristup.</p>
          <Button onClick={() => navigate("/magacin/prenosi")}>
            <ArrowLeft className="w-4 h-4 mr-2" />Nazad na listu
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isDraft = transfer.status === "draft";
  const isPosted = transfer.status === "posted";

  return (
    <MainLayout title={`MMP: ${transfer.transfer_number}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/magacin/prenosi")}>
              <ArrowLeft className="w-4 h-4 mr-2" />Nazad
            </Button>
            <h1 className="text-xl font-semibold">{transfer.transfer_number}</h1>
            {isPosted ? (
              <Badge variant="default">Proknjiženo</Badge>
            ) : (
              <Badge variant="secondary">Nacrt</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchTransfer} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isDraft && canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
              </Button>
            )}
            {isDraft && canPost && (
              <Button size="sm" onClick={() => setPostDialogOpen(true)}>
                <BookCheck className="h-4 w-4 mr-2" />Proknjiži
              </Button>
            )}
            {isPosted && canPost && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => setUnpostDialogOpen(true)}>
                <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
          <div>
            <div className="text-muted-foreground">Datum prenosa</div>
            <div className="font-medium">
              {format(new Date(transfer.transfer_date), "dd.MM.yyyy", { locale: sr })}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Iz magacina</div>
            <div className="font-medium">
              {transfer.source_warehouse?.code} - {transfer.source_warehouse?.name}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">U magacin</div>
            <div className="font-medium">
              {transfer.destination_warehouse?.code} - {transfer.destination_warehouse?.name}
            </div>
          </div>
        </div>

        {transfer.note && (
          <div className="text-sm">
            <span className="text-muted-foreground">Napomena: </span>
            <span className="whitespace-pre-wrap">{transfer.note}</span>
          </div>
        )}

        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Ukupna količina: </span>
            <span className="font-semibold">{formatNumber(totalQuantity)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Ukupna vrednost: </span>
            <span className="font-semibold">{formatDecimal(totalValue, 2)}</span>
          </div>
        </div>

        <Separator />

        {itemsLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isDraft && canEdit ? (
          <TransferItemsEditor transferId={transfer.id} sourceWarehouseId={transfer.source_warehouse_id} transferDate={transfer.transfer_date} />
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Šifra</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead className="text-right">Količina</TableHead>
                  <TableHead>JM</TableHead>
                  <TableHead className="text-right">Cena</TableHead>
                   <TableHead className="text-right">Vrednost</TableHead>
                   <TableHead className="w-[40px]"></TableHead>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nema stavki
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>{item.item_code || item.article?.code || "-"}</TableCell>
                      <TableCell>{item.item_name}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">{formatDecimal(item.unit_price, 2)}</TableCell>
                       <TableCell className="text-right font-medium">
                         {formatDecimal(item.quantity * item.unit_price, 2)}
                       </TableCell>
                       <TableCell className="p-0">
                         {item.article_id && (
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-7 w-7">
                                 <MoreHorizontal className="h-4 w-4" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end">
                               <DropdownMenuItem onClick={() => setTransfersDialogArticle({ id: item.article_id, code: item.item_code || "", name: item.item_name })}>
                                 Na međumagacinskim prenosima
                               </DropdownMenuItem>
                             </DropdownMenuContent>
                           </DropdownMenu>
                         )}
                       </TableCell>
                     </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Separator />
      </div>

      {transfer && (
        <TransferDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          transfer={transfer}
          onSave={handleEditSaved}
        />
      )}

      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjižiti prenos?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da proknjižite međumagacinski prenos{" "}
              <strong>{transfer.transfer_number}</strong>? Knjiženje će kreirati nalog u glavnoj knjizi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={handlePostConfirm}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unpostDialogOpen} onOpenChange={setUnpostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništiti knjiženje?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje prenosa{" "}
              <strong>{transfer.transfer_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnpostConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Poništi knjiženje
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {transfer && (
        <DocumentHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} documentId={transfer.id} documentName={transfer.transfer_number} documentType="inter_warehouse_transfer" />
      )}
      <ArticleTransfersDialog
        open={!!transfersDialogArticle}
        onOpenChange={(open) => { if (!open) setTransfersDialogArticle(null); }}
        articleId={transfersDialogArticle?.id ?? null}
        articleCode={transfersDialogArticle?.code ?? ""}
        articleName={transfersDialogArticle?.name ?? ""}
      />
    </MainLayout>
  );
}
