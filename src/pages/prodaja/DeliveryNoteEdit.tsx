import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, RefreshCw, Pencil, Eye, Send, History, Undo2, FileDown, Printer } from "lucide-react";
import {
  DeliveryNote,
  useCreateDeliveryNote,
  useUpdateDeliveryNote,
  usePostDeliveryNote,
  useRevertDeliveryNoteToDraft,
} from "@/hooks/useDeliveryNotes";
import { DeliveryNoteHeaderDialog } from "@/components/prodaja/DeliveryNoteHeaderDialog";
import { DeliveryNoteItemsEditorPage } from "@/components/prodaja/DeliveryNoteItemsEditorPage";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/formatting";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { generateDeliveryNotePdf, printDeliveryNotePdf } from "@/lib/deliveryNotePdfGenerator";
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

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  posted: { label: "Proknjižena", variant: "default" },
  cancelled: { label: "Stornirana", variant: "destructive" },
};

export default function DeliveryNoteEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, user } = useAuth();
  const isNew = id === "new";

  const [deliveryNote, setDeliveryNote] = useState<DeliveryNote | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [headerDialogOpen, setHeaderDialogOpen] = useState(isNew);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sourceOrderNumber, setSourceOrderNumber] = useState<string | null>(null);

  const createMutation = useCreateDeliveryNote();
  const updateMutation = useUpdateDeliveryNote();
  const postMutation = usePostDeliveryNote();
  const revertMutation = useRevertDeliveryNoteToDraft();

  const fetchDeliveryNote = async () => {
    if (!id || isNew) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("delivery_notes")
      .select(`*, partner:partners(id, code, name), warehouse:warehouses(id, code, name)`)
      .eq("id", id)
      .single();
    if (error) {
      toast.error("Greška pri učitavanju dokumenta");
      navigate("/prodaja/otpremnice");
      return;
    }
    setDeliveryNote(data as DeliveryNote);

    // Fetch source delivery order if linked
    const { data: linkedOrder } = await supabase
      .from("delivery_orders")
      .select("order_number")
      .eq("delivery_note_id", id)
      .maybeSingle();
    setSourceOrderNumber(linkedOrder?.order_number || null);

    setIsLoading(false);
  };

  useEffect(() => {
    if (!isNew) fetchDeliveryNote();
  }, [id]);

  const handleHeaderSave = async (formData: any) => {
    if (!selectedCompany || !selectedYear || !user) return;

    if (isNew) {
      const dnData = {
        company_id: selectedCompany.id,
        business_year_id: selectedYear.id,
        delivery_number: "",
        delivery_date: formData.delivery_date,
        partner_id: formData.partner_id,
        warehouse_id: formData.warehouse_id,
        org_unit_id: formData.org_unit_id,
        delivery_address: formData.delivery_address || null,
        delivery_method: formData.delivery_method || null,
        issued_by: formData.issued_by || null,
        received_by: formData.received_by || null,
        note: formData.note || null,
        internal_note: formData.internal_note || null,
        status: "draft" as const,
        invoice_id: null,
        created_by: user.id,
      };

      const newDn = await createMutation.mutateAsync({
        deliveryNote: dnData,
        items: [],
      });
      setHeaderDialogOpen(false);
      navigate(`/prodaja/otpremnice/${newDn.id}`, { replace: true });
    } else if (deliveryNote) {
      await updateMutation.mutateAsync({
        id: deliveryNote.id,
        deliveryNote: {
          delivery_date: formData.delivery_date,
          partner_id: formData.partner_id,
          warehouse_id: formData.warehouse_id,
          org_unit_id: formData.org_unit_id,
          delivery_address: formData.delivery_address || null,
          delivery_method: formData.delivery_method || null,
          issued_by: formData.issued_by || null,
          received_by: formData.received_by || null,
          note: formData.note || null,
          internal_note: formData.internal_note || null,
          company_id: selectedCompany.id,
        },
        items: [], // Items are managed separately on this page
      });
      setHeaderDialogOpen(false);
      fetchDeliveryNote();
    }
  };

  const [stockWarnings, setStockWarnings] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const handlePostClick = async () => {
    if (!deliveryNote) return;
    setIsValidating(true);
    setStockWarnings([]);
    try {
      const { data, error } = await supabase.rpc("validate_delivery_note_stock", {
        _delivery_note_id: deliveryNote.id,
      });
      if (error) {
        toast.error(`Greška pri validaciji: ${error.message}`);
        return;
      }
      if (data && (data as any[]).length > 0) {
        const warnings = (data as any[]).map((row: any) => {
          const variantInfo = row.variant_code ? ` (varijanta: ${row.variant_code})` : "";
          const minBal = parseFloat(row.min_balance_qty).toFixed(2);
          const dateStr = row.min_balance_date ? new Date(row.min_balance_date).toLocaleDateString("sr-Latn-RS") : "";
          return `${row.item_code} - ${row.item_name}${variantInfo}: stanje bi bilo ${minBal} dana ${dateStr}`;
        });
        setStockWarnings(warnings);
        toast.error("Knjiženje nije moguće - nedovoljne zalihe");
        return;
      }
      setPostDialogOpen(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handlePostConfirm = async () => {
    if (!deliveryNote || !user) return;
    await postMutation.mutateAsync({
      deliveryNoteId: deliveryNote.id,
      userId: user.id,
    });
    setPostDialogOpen(false);
    fetchDeliveryNote();
  };

  const handleRevertConfirm = async () => {
    if (!deliveryNote || !user) return;
    await revertMutation.mutateAsync({ deliveryNoteId: deliveryNote.id, userId: user.id });
    setRevertDialogOpen(false);
    fetchDeliveryNote();
  };

  if (isNew) {
    return (
      <MainLayout title="Nova otpremnica">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/prodaja/otpremnice")}>
            <ArrowLeft className="w-4 h-4 mr-2" />Nazad
          </Button>
          <h1 className="text-xl font-semibold">Nova otpremnica</h1>
        </div>
        <DeliveryNoteHeaderDialog
          open={headerDialogOpen}
          onOpenChange={(open) => {
            if (!open) navigate("/prodaja/otpremnice");
            setHeaderDialogOpen(open);
          }}
          onSave={handleHeaderSave}
          isLoading={createMutation.isPending}
        />
      </MainLayout>
    );
  }

  if (isLoading || !deliveryNote) {
    return (
      <MainLayout title="Učitavanje...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  const isDraft = deliveryNote.status === "draft";
  const isPosted = deliveryNote.status === "posted";
  const status = STATUS_BADGES[deliveryNote.status] || STATUS_BADGES.draft;

  return (
    <MainLayout title={`Otpremnica: ${deliveryNote.delivery_number}`}>
      <div className="flex-1 min-h-0 overflow-auto space-y-4">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/prodaja/otpremnice")}>
              <ArrowLeft className="w-4 h-4 mr-2" />Nazad
            </Button>
            <h1 className="text-xl font-semibold">{deliveryNote.delivery_number}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchDeliveryNote} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isDraft ? (
              <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}>
                <Eye className="h-4 w-4 mr-2" />Prikaži zaglavlje
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={async () => {
              const { data: items } = await supabase.from("delivery_note_items").select("*, variant:article_variants(code, description)").eq("delivery_note_id", deliveryNote.id).order("item_order");
              const mapped = (items || []).map((it: any) => ({ ...it, variant_code: it.variant?.code || "", variant_description: it.variant?.description || "" }));
              generateDeliveryNotePdf(deliveryNote, mapped, selectedCompany as any);
            }} title="PDF">
              <FileDown className="h-4 w-4 mr-2" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              const { data: items } = await supabase.from("delivery_note_items").select("*, variant:article_variants(code, description)").eq("delivery_note_id", deliveryNote.id).order("item_order");
              const mapped = (items || []).map((it: any) => ({ ...it, variant_code: it.variant?.code || "", variant_description: it.variant?.description || "" }));
              printDeliveryNotePdf(deliveryNote, mapped, selectedCompany as any);
            }} title="Štampa">
              <Printer className="h-4 w-4 mr-2" />Štampa
            </Button>
            {isDraft && (
              <Button size="sm" onClick={handlePostClick} disabled={isValidating}>
                {isValidating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Proknjiži
              </Button>
            )}
            {isPosted && !deliveryNote.invoice_id && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive/10" onClick={() => setRevertDialogOpen(true)}>
                <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
              </Button>
            )}
          </div>
        </div>

        {/* Header info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
          <div>
            <div className="text-muted-foreground">Datum otpreme</div>
            <div className="font-medium">{formatDate(deliveryNote.delivery_date)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Kupac</div>
            <div className="font-medium">
              {deliveryNote.partner?.code && <span className="text-muted-foreground mr-1">[{deliveryNote.partner.code}]</span>}
              {deliveryNote.partner?.name}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Magacin</div>
            <div className="font-medium">
              {deliveryNote.warehouse ? `${deliveryNote.warehouse.code} - ${deliveryNote.warehouse.name}` : "-"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Faktura</div>
            <div className="font-medium">{deliveryNote.invoice_id ? "Povezana" : "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Nalog za isporuku</div>
            <div className="font-medium">{sourceOrderNumber || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Adresa otpreme</div>
            <div className="font-medium">{deliveryNote.delivery_address || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Način otpreme</div>
            <div className="font-medium">{deliveryNote.delivery_method || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Robu izdao</div>
            <div className="font-medium">{deliveryNote.issued_by || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Robu primio</div>
            <div className="font-medium">{deliveryNote.received_by || "-"}</div>
          </div>
        </div>

        {/* Notes */}
        {deliveryNote.note && (
          <div className="text-sm">
            <div className="text-muted-foreground mb-1">Napomena</div>
            <div className="bg-muted p-2 rounded-md whitespace-pre-wrap">{deliveryNote.note}</div>
          </div>
        )}

        {/* Stock warnings */}
        {stockWarnings.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-1">
            <div className="font-semibold text-destructive text-sm">⚠ Knjiženje nije moguće - nedovoljne zalihe:</div>
            {stockWarnings.map((w, i) => (
              <div key={i} className="text-sm text-destructive">{w}</div>
            ))}
          </div>
        )}

        <Separator />

        {/* Items editor */}
        <DeliveryNoteItemsEditorPage
          deliveryNoteId={deliveryNote.id}
          companyId={deliveryNote.company_id}
          warehouseId={deliveryNote.warehouse_id}
          deliveryDate={deliveryNote.delivery_date}
          isReadOnly={!isDraft}
          hideStock={deliveryNote.status === "posted"}
          onItemsChanged={fetchDeliveryNote}
        />
      </div>

      {/* Header dialog */}
      <DeliveryNoteHeaderDialog
        open={headerDialogOpen}
        onOpenChange={setHeaderDialogOpen}
        deliveryNote={deliveryNote}
        onSave={handleHeaderSave}
        isLoading={updateMutation.isPending}
        readOnly={!isDraft}
      />

      {/* Post confirmation */}
      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Knjiženje otpremnice</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da proknjižite otpremnicu <strong>{deliveryNote.delivery_number}</strong>?
              Ovo će umanjiti zalihe u magacinu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handlePostConfirm}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert confirmation */}
      <AlertDialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vraćanje u nacrt</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da vratite otpremnicu <strong>{deliveryNote.delivery_number}</strong> u nacrt?
              Zalihe koje su umanjene knjiženjom će biti vraćene.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevertConfirm}>Vrati u nacrt</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History */}
      <DocumentHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        documentId={deliveryNote.id}
        documentName={deliveryNote.delivery_number}
        documentType="delivery_note"
      />
    </MainLayout>
  );
}
