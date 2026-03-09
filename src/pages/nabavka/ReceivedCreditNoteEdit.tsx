import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Pencil, BookCheck, FileText, FileSpreadsheet, Printer, Undo2, ArrowLeft, RefreshCw, History, Eye } from "lucide-react";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { ReceivedCreditNote, useReceivedCreditNoteItems, useReceivedCreditNotes } from "@/hooks/useReceivedCreditNotes";
import { ReceivedCreditNoteItemsEditor } from "@/components/nabavka/ReceivedCreditNoteItemsEditor";
import { ReceivedCreditNoteHeaderDialog } from "@/components/nabavka/ReceivedCreditNoteHeaderDialog";
import { formatNumber, formatDate, formatPrice } from "@/lib/formatting";
import { isForeignCurrency } from "@/lib/currencies";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentLock } from "@/hooks/useDocumentLock";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const statusLabels: Record<string, string> = { draft: "Nacrt", posted: "Proknjiženo", cancelled: "Stornirano" };
const statusVariants: Record<string, "default" | "secondary" | "destructive"> = { draft: "secondary", posted: "default", cancelled: "destructive" };

export default function ReceivedCreditNoteEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, user } = useAuth();
  const [doc, setDoc] = useState<ReceivedCreditNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [userAccessLevel, setUserAccessLevel] = useState<string | null>(null);

  const { items, isLoading: itemsLoading, addItem, updateItem, deleteItem } = useReceivedCreditNoteItems(id || null);
  const { updateTotals, postDoc: postMutation, unpostDoc: unpostMutation } = useReceivedCreditNotes();

  const { checkLock, updateLockTimestamp } = useDocumentLock({
    tableName: "received_credit_notes", documentId: id || null,
    initialUpdatedAt: doc?.updated_at || null, onConflict: () => fetchDoc(),
  });

  const canUnpost = userAccessLevel === "admin";

  const fetchDoc = async () => {
    if (!id) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("received_credit_notes")
      .select(`*, partner:partners(id, name, code, pib, mb, is_in_pdv, address, city, postal_code), org_unit:organizational_units(id, code, name)`)
      .eq("id", id).single();
    if (error) { toast.error("Greška pri učitavanju"); navigate("/nabavka/primljena-ko"); return; }
    setDoc(data as ReceivedCreditNote);
    updateLockTimestamp(data.updated_at);
    setIsLoading(false);
  };

  useEffect(() => { fetchDoc(); }, [id]);

  useEffect(() => {
    if (!user?.id || !selectedCompany?.id) return;
    supabase.rpc("get_user_access_level", { _user_id: user.id, _company_id: selectedCompany.id, _module_code: "nabavka.ulazne_fakture", _org_unit_id: null }).then(({ data }) => setUserAccessLevel(data));
  }, [user?.id, selectedCompany?.id]);

  useEffect(() => {
    if (!doc || doc.status !== "draft") return;
    const subtotal = items.reduce((s, i) => s + i.line_subtotal, 0);
    const vatAmount = items.reduce((s, i) => s + i.line_vat, 0);
    const totalAmount = items.reduce((s, i) => s + i.line_total, 0);
    const eq = (a: number, b: number) => Math.abs(a - b) < 0.005;
    if (!eq(subtotal, doc.subtotal) || !eq(vatAmount, doc.vat_amount) || !eq(totalAmount, doc.total_amount)) {
      updateTotals.mutateAsync({ docId: doc.id, subtotal, vat_amount: vatAmount, total_amount: totalAmount }).then((r) => { if (r?.updated_at) updateLockTimestamp(r.updated_at); });
      setDoc((p) => p ? { ...p, subtotal, vat_amount: vatAmount, total_amount: totalAmount } : null);
    }
  }, [items, doc?.id, doc?.status]);

  const handlePostConfirm = async () => {
    if (!doc) return;
    const ok = await checkLock(); if (!ok) return;
    await postMutation.mutateAsync(doc.id);
    setPostDialogOpen(false); fetchDoc();
  };

  const handleUnpostConfirm = async () => {
    if (!doc) return;
    await unpostMutation.mutateAsync(doc.id);
    setUnpostDialogOpen(false); fetchDoc();
  };

  if (isLoading || !selectedCompany || !selectedYear) {
    return <MainLayout title="Učitavanje..."><div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></MainLayout>;
  }
  if (!doc) {
    return <MainLayout title="Dokument nije pronađen"><div className="text-center py-12"><p className="text-muted-foreground mb-4">Dokument nije pronađen.</p><Button onClick={() => navigate("/nabavka/primljena-ko")}><ArrowLeft className="w-4 h-4 mr-2" />Nazad</Button></div></MainLayout>;
  }

  const isDraft = doc.status === "draft";
  const isPosted = doc.status === "posted";

  return (
    <MainLayout title={`PKO: ${doc.internal_number}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/nabavka/primljena-ko")}><ArrowLeft className="w-4 h-4 mr-2" />Nazad</Button>
            <h1 className="text-xl font-semibold">{doc.internal_number}</h1>
            <Badge variant={statusVariants[doc.status]}>{statusLabels[doc.status]}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija"><History className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" onClick={fetchDoc} title="Osveži"><RefreshCw className="w-4 h-4" /></Button>
            {isDraft ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}><Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje</Button>
                <Button size="sm" onClick={() => setPostDialogOpen(true)}><BookCheck className="h-4 w-4 mr-2" />Proknjiži</Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}><Eye className="h-4 w-4 mr-2" />Prikaži zaglavlje</Button>
            )}
            {isPosted && canUnpost && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => setUnpostDialogOpen(true)}><Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje</Button>
            )}
          </div>
        </div>

        {/* Header info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
          <div><div className="text-muted-foreground">Broj dokumenta dobavljača</div><div className="font-medium">{doc.supplier_document_number}</div></div>
          <div><div className="text-muted-foreground">Datum dokumenta</div><div className="font-medium">{formatDate(doc.document_date)}</div></div>
          <div><div className="text-muted-foreground">Datum prijema</div><div className="font-medium">{formatDate(doc.receipt_date)}</div></div>
          <div><div className="text-muted-foreground">Datum valute</div><div className="font-medium">{doc.due_date ? formatDate(doc.due_date) : "-"}</div></div>
        </div>

        {isForeignCurrency(doc.currency) && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm p-3 border border-dashed rounded-lg">
            <div><div className="text-muted-foreground">Valuta</div><div className="font-medium">{doc.currency}</div></div>
            <div><div className="text-muted-foreground">Kurs</div><div className="font-medium">1 {doc.currency} = {formatNumber(doc.exchange_rate, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} RSD</div></div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="col-span-2"><div className="text-muted-foreground">Dobavljač</div><div className="font-medium">{doc.partner?.code && <span className="text-muted-foreground mr-1">[{doc.partner.code}]</span>}{doc.supplier_name || doc.partner?.name}</div><div className="text-xs text-muted-foreground">{doc.supplier_address}, {doc.supplier_postal_code} {doc.supplier_city}</div></div>
          <div><div className="text-muted-foreground">PIB</div><div className="font-medium">{doc.supplier_pib || "-"}</div></div>
          <div><div className="text-muted-foreground">Matični broj</div><div className="font-medium">{doc.supplier_mb || "-"}</div></div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><div className="text-muted-foreground">U sistemu PDV-a</div><Badge variant={doc.supplier_is_in_pdv ? "default" : "outline"}>{doc.supplier_is_in_pdv ? "Da" : "Ne"}</Badge></div>
          <div><div className="text-muted-foreground">Interni obračun PDV</div><Badge variant={doc.has_internal_vat_calculation ? "default" : "outline"}>{doc.has_internal_vat_calculation ? "Da" : "Ne"}</Badge></div>
          {doc.org_unit && <div><div className="text-muted-foreground">Organizaciona jedinica</div><div className="font-medium">{doc.org_unit.code} - {doc.org_unit.name}</div></div>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm bg-muted/10 p-3 rounded-lg border border-dashed">
          <div><div className="text-muted-foreground">Valuta plaćanja</div><div className="font-medium">{doc.due_date ? formatDate(doc.due_date) : "-"}</div></div>
          <div><div className="text-muted-foreground">Tekući račun</div><div className="font-medium">{doc.supplier_bank_account || "-"}</div></div>
          <div><div className="text-muted-foreground">Poziv na broj</div><div className="font-medium">{doc.payment_reference || "-"}</div></div>
        </div>

        <Separator />

        <ReceivedCreditNoteItemsEditor
          docId={doc.id} items={items} isLoading={itemsLoading} isEditable={isDraft}
          supplierIsInPdv={doc.supplier_is_in_pdv} currency={doc.currency || "RSD"}
          exchangeRate={doc.exchange_rate || 1} addItem={addItem} updateItem={updateItem} deleteItem={deleteItem}
        />

        <Separator />

        <div className="flex justify-end">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-8"><span className="text-muted-foreground">Osnovica:</span><span className="font-medium">{formatPrice(doc.subtotal)} RSD</span></div>
            <div className="flex justify-between gap-8"><span className="text-muted-foreground">PDV:</span><span className="font-medium">{formatPrice(doc.vat_amount)} RSD</span></div>
            <Separator />
            <div className="flex justify-between gap-8 text-base"><span className="font-medium">Ukupno:</span><span className="font-bold">{formatPrice(doc.total_amount)} RSD</span></div>
          </div>
        </div>

        {doc.note && <div className="text-sm"><div className="text-muted-foreground mb-1">Napomena</div><div>{doc.note}</div></div>}
      </div>

      <ReceivedCreditNoteHeaderDialog open={headerDialogOpen} onOpenChange={setHeaderDialogOpen} doc={doc} onSaved={() => fetchDoc()} readOnly={!isDraft} />

      <DocumentHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} documentType="received_credit_note" documentId={doc.id} documentName={doc.internal_number} />

      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Proknjiženje</AlertDialogTitle><AlertDialogDescription>Da li ste sigurni da želite da proknjižite {doc.internal_number}?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Otkaži</AlertDialogCancel><AlertDialogAction onClick={handlePostConfirm}>Proknjiži</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unpostDialogOpen} onOpenChange={setUnpostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Poništavanje knjiženja</AlertDialogTitle><AlertDialogDescription>Da li ste sigurni da želite da poništite knjiženje {doc.internal_number}?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Otkaži</AlertDialogCancel><AlertDialogAction onClick={handleUnpostConfirm} className="bg-destructive text-destructive-foreground">Poništi</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
