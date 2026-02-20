import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Pencil, BookCheck, FileDown, Printer, Undo2, ArrowLeft,
  RefreshCw, Calculator, ExternalLink, History,
} from "lucide-react";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import {
  GoodsReceipt, useGoodsReceiptItems, useGoodsReceipts,
} from "@/hooks/useGoodsReceipts";
import {
  useExistingCalculation, usePurchasePriceCalculations,
} from "@/hooks/usePurchasePriceCalculations";
import { GoodsReceiptItemsEditor } from "@/components/magacin/GoodsReceiptItemsEditor";
import { GoodsReceiptDialog } from "@/components/magacin/GoodsReceiptDialog";
import { formatDecimal, formatNumber } from "@/lib/formatting";
import { exportGoodsReceiptPdf, printGoodsReceipt } from "@/lib/goodsReceiptPdfGenerator";
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

export default function GoodsReceiptEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("robno.prijemnice", "write");
  const canPost = hasAccess("robno.prijemnice", "admin");

  const [receipt, setReceipt] = useState<GoodsReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { items, isLoading: itemsLoading } = useGoodsReceiptItems(id || null);
  const { updateReceipt, postReceipt, unpostReceipt } = useGoodsReceipts();
  const { data: existingCalc, isLoading: calcCheckLoading } = useExistingCalculation(id || null);
  const { createFromReceipt } = usePurchasePriceCalculations();

  const { checkLock, updateLockTimestamp } = useDocumentLock({
    tableName: "goods_receipts",
    documentId: id || null,
    initialUpdatedAt: receipt?.updated_at || null,
    onConflict: () => fetchReceipt(),
  });

  const fetchReceipt = async () => {
    if (!id) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("goods_receipts")
      .select(`
        *,
        warehouse:warehouses(id, code, name),
        partner:partners(id, code, name)
      `)
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Greška pri učitavanju dokumenta");
      navigate("/magacin/prijemnice");
      return;
    }

    setReceipt(data as GoodsReceipt);
    updateLockTimestamp(data.updated_at);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReceipt();
  }, [id]);

  const handlePostConfirm = async () => {
    if (!receipt) return;
    const canProceed = await checkLock();
    if (!canProceed) return;
    await postReceipt.mutateAsync(receipt.id);
    setPostDialogOpen(false);
    fetchReceipt();
  };

  const handleUnpostConfirm = async () => {
    if (!receipt) return;
    await unpostReceipt.mutateAsync(receipt.id);
    setUnpostDialogOpen(false);
    fetchReceipt();
  };

  const handleEditSaved = async (data: any) => {
    if (!receipt) return;
    await updateReceipt.mutateAsync({ id: receipt.id, ...data });
    setEditDialogOpen(false);
    fetchReceipt();
  };

  const handleCalculation = async () => {
    if (!receipt) return;
    if (existingCalc) {
      navigate(`/magacin/kalkulacije/${existingCalc.id}`);
    } else {
      const calc = await createFromReceipt.mutateAsync(receipt.id);
      navigate(`/magacin/kalkulacije/${calc.id}`);
    }
  };

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
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

  if (!receipt) {
    return (
      <MainLayout title="Dokument nije pronađen">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Dokument nije pronađen ili nemate pristup.</p>
          <Button onClick={() => navigate("/magacin/prijemnice")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Nazad na listu
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isDraft = receipt.status === "draft";
  const isPosted = receipt.status === "posted";
  const isEditable = isDraft && !receipt.source_invoice_id;

  return (
    <MainLayout title={`Prijemnica: ${receipt.receipt_number}`}>
      <div className="space-y-4">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/magacin/prijemnice")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Nazad
            </Button>
            <h1 className="text-xl font-semibold">{receipt.receipt_number}</h1>
            {isPosted ? (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">Proknjiženo</Badge>
            ) : receipt.source_invoice_id ? (
              <Badge variant="secondary">Iz fakture</Badge>
            ) : (
              <Badge variant="outline">Nacrt</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchReceipt} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isEditable && canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
              </Button>
            )}
            {items.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={() => exportGoodsReceiptPdf(receipt, items, selectedCompany)}>
                  <FileDown className="h-4 w-4 mr-2" />PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => printGoodsReceipt(receipt, items, selectedCompany)}>
                  <Printer className="h-4 w-4 mr-2" />Štampa
                </Button>
              </>
            )}
            {isPosted && receipt.source_invoice_id && (
              <Button variant="outline" size="sm" onClick={handleCalculation} disabled={createFromReceipt.isPending || calcCheckLoading}>
                {createFromReceipt.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
                {existingCalc ? "Otvori kalkulaciju" : "Kreiraj kalkulaciju"}
              </Button>
            )}
            {isEditable && canPost && (
              <Button size="sm" onClick={() => setPostDialogOpen(true)}>
                <BookCheck className="h-4 w-4 mr-2" />Proknjiži
              </Button>
            )}
            {isPosted && canPost && !receipt.source_invoice_id && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => setUnpostDialogOpen(true)}>
                <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
              </Button>
            )}
          </div>
        </div>

        {/* Header info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
          <div>
            <div className="text-muted-foreground">Datum prijema</div>
            <div className="font-medium">
              {format(new Date(receipt.receipt_date), "dd.MM.yyyy", { locale: sr })}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Magacin</div>
            <div className="font-medium">
              {receipt.warehouse?.code} - {receipt.warehouse?.name}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Dobavljač</div>
            <div className="font-medium">
              {receipt.partner
                ? `${receipt.partner.code} - ${receipt.partner.name}`
                : <span className="text-muted-foreground">Nije definisan</span>}
            </div>
          </div>
          {receipt.source_invoice_id && (
            <div>
              <div className="text-muted-foreground">Izvor</div>
              <div className="font-medium flex items-center gap-1">
                <ExternalLink className="h-4 w-4" />
                Ulazna faktura za robu
              </div>
            </div>
          )}
        </div>

        {receipt.note && (
          <div className="text-sm">
            <span className="text-muted-foreground">Napomena: </span>
            <span className="whitespace-pre-wrap">{receipt.note}</span>
          </div>
        )}

        {/* Summary */}
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Ukupna količina: </span>
            <span className="font-semibold">{formatNumber(totalQuantity)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Ukupna vrednost: </span>
            <span className="font-semibold">{formatDecimal(totalValue, 2)} RSD</span>
          </div>
        </div>

        <Separator />

        {/* Items */}
        {itemsLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isEditable && canEdit ? (
          <GoodsReceiptItemsEditor receiptId={receipt.id} />
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Separator />
      </div>

      {/* Edit header dialog */}
      {receipt && (
        <GoodsReceiptDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          receipt={receipt}
          onSave={handleEditSaved}
        />
      )}

      {/* Post Confirmation */}
      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjižiti prijemnicu?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da proknjižite prijemnicu{" "}
              <strong>{receipt.receipt_number}</strong>? Knjiženje će ažurirati zalihe artikala.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={handlePostConfirm}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unpost Confirmation */}
      <AlertDialog open={unpostDialogOpen} onOpenChange={setUnpostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništiti knjiženje?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje prijemnice{" "}
              <strong>{receipt.receipt_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnpostConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Poništi knjiženje
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {receipt && (
        <DocumentHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          documentId={receipt.id}
          documentName={receipt.receipt_number}
          documentType="goods_receipt"
        />
      )}
    </MainLayout>
  );
}
