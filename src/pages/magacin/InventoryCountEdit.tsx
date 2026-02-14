import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Pencil, BookCheck, FileDown, Printer, Undo2, ArrowLeft, RefreshCw,
} from "lucide-react";
import { InventoryCount, useInventoryCountItems, useInventoryCounts } from "@/hooks/useInventoryCounts";
import { InventoryCountItemsEditor } from "@/components/magacin/InventoryCountItemsEditor";
import { InventoryCountDialog } from "@/components/magacin/InventoryCountDialog";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportInventoryCountPdf, exportInventoryCountBlankPdf,
  printInventoryCount, printInventoryCountBlank,
  exportInventoryCountToExcel, exportInventoryCountBlankToExcel,
} from "@/lib/inventoryCountExportUtils";
import { FileSpreadsheet, MoreHorizontal } from "lucide-react";

export default function InventoryCountEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("robno.prijemnice", "write");
  const canPost = hasAccess("robno.prijemnice", "admin");

  const [countDoc, setCountDoc] = useState<InventoryCount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);

  const { items, isLoading: itemsLoading } = useInventoryCountItems(id || null);
  const { updateCount, postCount, unpostCount } = useInventoryCounts();

  const { checkLock, updateLockTimestamp } = useDocumentLock({
    tableName: "inventory_counts",
    documentId: id || null,
    initialUpdatedAt: countDoc?.updated_at || null,
    onConflict: () => fetchCount(),
  });

  const fetchCount = async () => {
    if (!id) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("inventory_counts")
      .select(`*, warehouse:warehouses(id, code, name, warehouse_type)`)
      .eq("id", id)
      .single();
    if (error) {
      toast.error("Greška pri učitavanju dokumenta");
      navigate("/magacin/popisi");
      return;
    }
    setCountDoc(data as InventoryCount);
    updateLockTimestamp(data.updated_at);
    setIsLoading(false);
  };

  useEffect(() => { fetchCount(); }, [id]);

  const handlePostConfirm = async () => {
    if (!countDoc) return;
    const ok = await checkLock();
    if (!ok) return;
    await postCount.mutateAsync(countDoc.id);
    setPostDialogOpen(false);
    fetchCount();
  };

  const handleUnpostConfirm = async () => {
    if (!countDoc) return;
    await unpostCount.mutateAsync(countDoc.id);
    setUnpostDialogOpen(false);
    fetchCount();
  };

  const handleEditSaved = async (data: any) => {
    if (!countDoc) return;
    await updateCount.mutateAsync({ id: countDoc.id, ...data });
    setEditDialogOpen(false);
    fetchCount();
  };

  const totals = items.reduce(
    (acc, item) => ({
      surplusValue: acc.surplusValue + item.surplus_value,
      deficitValue: acc.deficitValue + item.deficit_value,
    }),
    { surplusValue: 0, deficitValue: 0 }
  );

  const exportMeta = countDoc ? {
    countNumber: countDoc.count_number,
    warehouseName: `${countDoc.warehouse?.code} - ${countDoc.warehouse?.name}`,
    countDate: countDoc.count_date,
  } : { countNumber: "", warehouseName: "", countDate: "" };

  if (isLoading || !selectedCompany || !selectedYear) {
    return (
      <MainLayout title="Učitavanje...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!countDoc) {
    return (
      <MainLayout title="Dokument nije pronađen">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Dokument nije pronađen.</p>
          <Button onClick={() => navigate("/magacin/popisi")}>
            <ArrowLeft className="w-4 h-4 mr-2" />Nazad na listu
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isDraft = countDoc.status === "draft";
  const isPosted = countDoc.status === "posted";

  return (
    <MainLayout title={`Popis: ${countDoc.count_number}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/magacin/popisi")}>
              <ArrowLeft className="w-4 h-4 mr-2" />Nazad
            </Button>
            <h1 className="text-xl font-semibold">{countDoc.count_number}</h1>
            {isPosted ? (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">Proknjiženo</Badge>
            ) : (
              <Badge variant="outline">Nacrt</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={fetchCount} title="Osveži">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
          <div>
            <div className="text-muted-foreground">Datum popisa</div>
            <div className="font-medium">{format(new Date(countDoc.count_date), "dd.MM.yyyy", { locale: sr })}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Magacin</div>
            <div className="font-medium">{countDoc.warehouse?.code} - {countDoc.warehouse?.name}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Razlika</div>
            <div className="font-medium">
              <span className="text-green-600">Višak: {formatDecimal(totals.surplusValue, 2)}</span>
              {" | "}
              <span className="text-destructive">Manjak: {formatDecimal(totals.deficitValue, 2)}</span>
            </div>
          </div>
        </div>

        {countDoc.note && (
          <div className="text-sm">
            <span className="text-muted-foreground">Napomena: </span>
            <span className="whitespace-pre-wrap">{countDoc.note}</span>
          </div>
        )}

        <Separator />

        {itemsLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isDraft && canEdit ? (
          <InventoryCountItemsEditor
            countId={countDoc.id}
            warehouseId={countDoc.warehouse_id}
            countDate={countDoc.count_date}
            warehouseType={countDoc.warehouse?.warehouse_type || "1"}
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
                  <TableHead className="text-right">Knjižna kol.</TableHead>
                  <TableHead className="text-right">Popisana kol.</TableHead>
                  <TableHead className="text-right">Višak</TableHead>
                  <TableHead className="text-right">Manjak</TableHead>
                  <TableHead className="text-right">Cena</TableHead>
                  <TableHead className="text-right">Vr. viška</TableHead>
                  <TableHead className="text-right">Vr. manjka</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nema stavki</TableCell>
                  </TableRow>
                ) : (
                  items.map((item, i) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>{item.item_code || "-"}</TableCell>
                      <TableCell>{item.item_name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">{formatDecimal(item.book_quantity, 2)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(item.counted_quantity, 2)}</TableCell>
                      <TableCell className="text-right">{item.surplus_qty > 0 ? <span className="text-green-600">{formatDecimal(item.surplus_qty, 2)}</span> : ""}</TableCell>
                      <TableCell className="text-right">{item.deficit_qty > 0 ? <span className="text-destructive">{formatDecimal(item.deficit_qty, 2)}</span> : ""}</TableCell>
                      <TableCell className="text-right">{formatDecimal(item.price, 2)}</TableCell>
                      <TableCell className="text-right">{item.surplus_value > 0 ? <span className="text-green-600">{formatDecimal(item.surplus_value, 2)}</span> : ""}</TableCell>
                      <TableCell className="text-right">{item.deficit_value > 0 ? <span className="text-destructive">{formatDecimal(item.deficit_value, 2)}</span> : ""}</TableCell>
                    </TableRow>
                  ))
                )}
                {items.length > 0 && (
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell colSpan={9} className="text-right">Ukupno:</TableCell>
                    <TableCell className="text-right text-green-600">{formatDecimal(totals.surplusValue, 2)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatDecimal(totals.deficitValue, 2)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Separator />

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => navigate("/magacin/popisi")}>Zatvori</Button>
          <div className="flex gap-2">
            {isDraft && canEdit && (
              <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
              </Button>
            )}
            {items.length > 0 && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <FileDown className="h-4 w-4 mr-2" />Izvoz
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => exportInventoryCountPdf(items, exportMeta, totals)}>
                      <FileDown className="h-4 w-4 mr-2" />PDF (puni)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportInventoryCountBlankPdf(items, exportMeta)}>
                      <FileDown className="h-4 w-4 mr-2" />PDF (prazni za popis)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportInventoryCountToExcel(items, exportMeta, totals)}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />Excel (puni)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportInventoryCountBlankToExcel(items, exportMeta)}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />Excel (prazni za popis)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Printer className="h-4 w-4 mr-2" />Štampa
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => printInventoryCount(items, exportMeta, totals)}>
                      <Printer className="h-4 w-4 mr-2" />Štampa (puni)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => printInventoryCountBlank(items, exportMeta)}>
                      <Printer className="h-4 w-4 mr-2" />Štampa (prazni za popis)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
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

      {countDoc && (
        <InventoryCountDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          count={countDoc}
          onSave={handleEditSaved}
        />
      )}

      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjižiti popis?</AlertDialogTitle>
            <AlertDialogDescription>
              Knjiženje popisa <strong>{countDoc.count_number}</strong> će kreirati nalog za knjiženje.
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
              Da li ste sigurni da želite da poništite knjiženje popisa <strong>{countDoc.count_number}</strong>?
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
    </MainLayout>
  );
}
