import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Pencil, BookCheck, Undo2, ArrowLeft, RefreshCw, History,
} from "lucide-react";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { PriceAdjustment, usePriceAdjustmentItems, usePriceAdjustments } from "@/hooks/usePriceAdjustments";
import { PriceAdjustmentItemsEditor } from "@/components/magacin/PriceAdjustmentItemsEditor";
import { PriceAdjustmentDialog } from "@/components/magacin/PriceAdjustmentDialog";
import { formatDecimal } from "@/lib/formatting";
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

export default function PriceAdjustmentEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("robno.prijemnice", "write");
  const canPost = hasAccess("robno.prijemnice", "admin");

  const [doc, setDoc] = useState<PriceAdjustment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);

  const { items, isLoading: itemsLoading } = usePriceAdjustmentItems(id || null);
  const { updateAdjustment, postAdjustment, unpostAdjustment } = usePriceAdjustments();

  const { checkLock, updateLockTimestamp } = useDocumentLock({
    tableName: "price_adjustments",
    documentId: id || null,
    initialUpdatedAt: doc?.updated_at || null,
    onConflict: () => fetchDoc(),
  });

  const fetchDoc = async () => {
    if (!id) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("price_adjustments")
      .select(`*, warehouse:warehouses(id, code, name, warehouse_type)`)
      .eq("id", id)
      .single();
    if (error) {
      toast.error("Greška pri učitavanju dokumenta");
      navigate("/magacin/nivelacije");
      return;
    }
    setDoc(data as PriceAdjustment);
    updateLockTimestamp(data.updated_at);
    setIsLoading(false);
  };

  useEffect(() => { fetchDoc(); }, [id]);

  const handlePostConfirm = async () => {
    if (!doc) return;
    const ok = await checkLock();
    if (!ok) return;
    await postAdjustment.mutateAsync(doc.id);
    setPostDialogOpen(false);
    fetchDoc();
  };

  const handleUnpostConfirm = async () => {
    if (!doc) return;
    await unpostAdjustment.mutateAsync(doc.id);
    setUnpostDialogOpen(false);
    fetchDoc();
  };

  const handleEditSaved = async (data: any) => {
    if (!doc) return;
    await updateAdjustment.mutateAsync({ id: doc.id, ...data });
    setEditDialogOpen(false);
    fetchDoc();
  };

  const totals = items.reduce(
    (acc, item) => ({
      increase: acc.increase + (item.value_difference > 0 ? item.value_difference : 0),
      decrease: acc.decrease + (item.value_difference < 0 ? Math.abs(item.value_difference) : 0),
    }),
    { increase: 0, decrease: 0 }
  );

  if (isLoading || !selectedCompany || !selectedYear) {
    return (
      <MainLayout title="Učitavanje...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!doc) {
    return (
      <MainLayout title="Dokument nije pronađen">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Dokument nije pronađen.</p>
          <Button onClick={() => navigate("/magacin/nivelacije")}>
            <ArrowLeft className="w-4 h-4 mr-2" />Nazad na listu
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isDraft = doc.status === "draft";
  const isPosted = doc.status === "posted";

  return (
    <MainLayout title={`Nivelacija: ${doc.adjustment_number}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/magacin/nivelacije")}>
              <ArrowLeft className="w-4 h-4 mr-2" />Nazad
            </Button>
            <h1 className="text-xl font-semibold">{doc.adjustment_number}</h1>
            {isPosted ? (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">Proknjiženo</Badge>
            ) : (
              <Badge variant="outline">Nacrt</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchDoc} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
          <div>
            <div className="text-muted-foreground">Datum nivelacije</div>
            <div className="font-medium">{format(new Date(doc.adjustment_date), "dd.MM.yyyy", { locale: sr })}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Magacin</div>
            <div className="font-medium">{doc.warehouse?.code} - {doc.warehouse?.name}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Razlika</div>
            <div className="font-medium">
              <span className="text-green-600">+{formatDecimal(totals.increase, 2)}</span>
              {" | "}
              <span className="text-destructive">-{formatDecimal(totals.decrease, 2)}</span>
            </div>
          </div>
        </div>

        {doc.note && (
          <div className="text-sm">
            <span className="text-muted-foreground">Napomena: </span>
            <span className="whitespace-pre-wrap">{doc.note}</span>
          </div>
        )}

        <Separator />

        {itemsLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isDraft && canEdit ? (
          <PriceAdjustmentItemsEditor
            adjustmentId={doc.id}
            warehouseId={doc.warehouse_id}
            adjustmentDate={doc.adjustment_date}
          />
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Šifra</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead>JM</TableHead>
                  <TableHead className="text-right">Količina</TableHead>
                  <TableHead className="text-right">Stara cena</TableHead>
                  <TableHead className="text-right">Nova cena</TableHead>
                  <TableHead className="text-right">Razlika/jed.</TableHead>
                  <TableHead className="text-right">Razlika ukupno</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nema stavki</TableCell>
                  </TableRow>
                ) : (
                  items.map((item, i) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>{item.item_code || "-"}</TableCell>
                      <TableCell>{item.item_name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">{formatDecimal(item.quantity, 2)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(item.old_price, 2)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(item.new_price, 2)}</TableCell>
                      <TableCell className="text-right">
                        <span className={item.price_difference > 0 ? "text-green-600" : item.price_difference < 0 ? "text-destructive" : ""}>
                          {formatDecimal(item.price_difference, 2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={item.value_difference > 0 ? "text-green-600" : item.value_difference < 0 ? "text-destructive" : ""}>
                          {formatDecimal(item.value_difference, 2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {items.length > 0 && (
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell colSpan={8} className="text-right">Ukupno:</TableCell>
                    <TableCell className="text-right">
                      {totals.increase > 0 && <span className="text-green-600">+{formatDecimal(totals.increase, 2)}</span>}
                      {totals.increase > 0 && totals.decrease > 0 && " / "}
                      {totals.decrease > 0 && <span className="text-destructive">-{formatDecimal(totals.decrease, 2)}</span>}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Separator />

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => navigate("/magacin/nivelacije")}>Zatvori</Button>
          <div className="flex gap-2">
            {isDraft && canEdit && (
              <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
              </Button>
            )}
            {isDraft && canPost && (
              <Button onClick={() => setPostDialogOpen(true)}>
                <BookCheck className="h-4 w-4 mr-2" />Proknjiži
              </Button>
            )}
            {isPosted && canPost && (
              <Button variant="destructive" onClick={() => setUnpostDialogOpen(true)}>
                <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
              </Button>
            )}
          </div>
        </div>
      </div>

      {doc && (
        <PriceAdjustmentDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          adjustment={doc}
          onSave={handleEditSaved}
        />
      )}

      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjižiti nivelaciju?</AlertDialogTitle>
            <AlertDialogDescription>
              Knjiženje nivelacije <strong>{doc.adjustment_number}</strong> će ažurirati prodajne cene artikala i kreirati nalog za knjiženje.
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
              Da li ste sigurni da želite da poništite knjiženje nivelacije <strong>{doc.adjustment_number}</strong>? Prodajne cene će biti vraćene na prethodne vrednosti.
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
      {doc && (
        <DocumentHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} documentId={doc.id} documentName={doc.adjustment_number} documentType="price_adjustment" />
      )}
    </MainLayout>
  );
}
