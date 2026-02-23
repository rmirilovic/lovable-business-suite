import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, RefreshCw, Pencil, ThumbsUp, ShieldCheck, History } from "lucide-react";
import {
  DeliveryOrder,
  DeliveryOrderItem,
  DeliveryOrderItemData,
  useDeliveryOrder,
  useCreateDeliveryOrder,
  useUpdateDeliveryOrder,
  useApproveDeliveryOrder,
  useReserveDeliveryOrder,
} from "@/hooks/useDeliveryOrders";
import { DeliveryOrderHeaderDialog } from "@/components/prodaja/DeliveryOrderHeaderDialog";
import { DeliveryOrderItemsEditor } from "@/components/prodaja/DeliveryOrderItemsEditor";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/formatting";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
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
  approved: { label: "Odobren", variant: "outline" },
  reserved: { label: "Rezervisan", variant: "default" },
  shipped: { label: "Otpremljen", variant: "destructive" },
};

export default function DeliveryOrderEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, user } = useAuth();
  const isNew = id === "new";

  const [order, setOrder] = useState<(DeliveryOrder & { items: DeliveryOrderItem[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [headerDialogOpen, setHeaderDialogOpen] = useState(isNew);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const createMutation = useCreateDeliveryOrder();
  const updateMutation = useUpdateDeliveryOrder();
  const approveMutation = useApproveDeliveryOrder();
  const reserveMutation = useReserveDeliveryOrder();

  const fetchOrder = async () => {
    if (!id || isNew) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("delivery_orders")
      .select(`*, partner:partners(id, code, name, address, city, postal_code), warehouse:warehouses(id, code, name)`)
      .eq("id", id)
      .single();
    if (error) {
      toast.error("Greška pri učitavanju dokumenta");
      navigate("/prodaja/nalozi-isporuka");
      return;
    }
    const { data: items } = await supabase
      .from("delivery_order_items")
      .select("*")
      .eq("delivery_order_id", id)
      .order("item_order");
    setOrder({ ...data, items: items || [] } as any);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isNew) fetchOrder();
  }, [id]);

  const handleHeaderSave = async (formData: any) => {
    if (!selectedCompany || !selectedYear || !user) return;

    if (isNew) {
      // Get user profile for composed_by default
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();
      const userName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "";

      const orderData = {
        company_id: selectedCompany.id,
        business_year_id: selectedYear.id,
        order_number: "",
          order_date: formData.order_date,
          delivery_deadline: formData.delivery_deadline || null,
          partner_id: formData.partner_id,
          delivery_address: formData.delivery_address || null,
        delivery_method: formData.delivery_method || null,
        warehouse_id: formData.warehouse_id || null,
        payment_method: formData.payment_method || null,
        contact_person: formData.contact_person || null,
        ordered_by: formData.ordered_by || null,
        note: formData.note || null,
        composed_by: formData.composed_by || userName,
        status: "draft",
        created_by: user.id,
      };

      const newOrder = await createMutation.mutateAsync({ order: orderData, items: [] });
      setHeaderDialogOpen(false);
      navigate(`/prodaja/nalozi-isporuka/${newOrder.id}`, { replace: true });
    } else if (order) {
      await updateMutation.mutateAsync({
        id: order.id,
        order: {
          order_date: formData.order_date,
          delivery_deadline: formData.delivery_deadline || null,
          partner_id: formData.partner_id,
          delivery_address: formData.delivery_address || null,
          delivery_method: formData.delivery_method || null,
          warehouse_id: formData.warehouse_id || null,
          payment_method: formData.payment_method || null,
          contact_person: formData.contact_person || null,
          ordered_by: formData.ordered_by || null,
          note: formData.note || null,
          composed_by: formData.composed_by || null,
          company_id: selectedCompany.id,
        },
        items: order.items.map((item) => ({
          article_id: item.article_id,
          item_code: item.item_code,
          item_name: item.item_name,
          description: item.description || null,
          unit: item.unit,
          quantity: item.quantity,
        })),
      });
      setHeaderDialogOpen(false);
      fetchOrder();
    }
  };

  const handleApproveConfirm = async () => {
    if (!order || !user) return;
    await approveMutation.mutateAsync({ id: order.id, userId: user.id });
    setApproveDialogOpen(false);
    fetchOrder();
  };

  const handleReserveConfirm = async () => {
    if (!order || !user) return;
    await reserveMutation.mutateAsync({ id: order.id, userId: user.id });
    setReserveDialogOpen(false);
    fetchOrder();
  };

  if (isNew) {
    return (
      <MainLayout title="Novi nalog za isporuku">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/prodaja/nalozi-isporuka")}>
            <ArrowLeft className="w-4 h-4 mr-2" />Nazad
          </Button>
          <h1 className="text-xl font-semibold">Novi nalog za isporuku</h1>
        </div>
        <DeliveryOrderHeaderDialog
          open={headerDialogOpen}
          onOpenChange={(open) => {
            if (!open) navigate("/prodaja/nalozi-isporuka");
            setHeaderDialogOpen(open);
          }}
          onSave={handleHeaderSave}
          isLoading={createMutation.isPending}
        />
      </MainLayout>
    );
  }

  if (isLoading || !order) {
    return (
      <MainLayout title="Učitavanje...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  const isDraft = order.status === "draft";
  const status = STATUS_BADGES[order.status] || STATUS_BADGES.draft;

  return (
    <MainLayout title={`Nalog: ${order.order_number}`}>
      <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/prodaja/nalozi-isporuka")}>
              <ArrowLeft className="w-4 h-4 mr-2" />Nazad
            </Button>
            <h1 className="text-xl font-semibold">{order.order_number}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchOrder} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isDraft && (
              <>
                <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
                </Button>
                <Button variant="outline" size="sm" onClick={() => setApproveDialogOpen(true)}>
                  <ThumbsUp className="h-4 w-4 mr-2" />Odobri
                </Button>
                <Button size="sm" onClick={() => setReserveDialogOpen(true)}>
                  <ShieldCheck className="h-4 w-4 mr-2" />Rezerviši
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Header info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
          <div>
            <div className="text-muted-foreground">Datum naloga</div>
            <div className="font-medium">{formatDate(order.order_date)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Rok isporuke</div>
            <div className="font-medium">{order.delivery_deadline ? formatDate(order.delivery_deadline) : "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Način isporuke</div>
            <div className="font-medium">{order.delivery_method || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Način plaćanja</div>
            <div className="font-medium">{order.payment_method || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Kreirao</div>
            <div className="font-medium">{order.composed_by || "-"}</div>
          </div>
        </div>

        {/* Partner & warehouse info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="col-span-2">
            <div className="text-muted-foreground">Kupac</div>
            <div className="font-medium">
              {order.partner?.code && <span className="text-muted-foreground mr-1">[{order.partner.code}]</span>}
              {order.partner?.name}
            </div>
            {order.delivery_address && (
              <div className="text-xs text-muted-foreground">Adresa isporuke: {order.delivery_address}</div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground">Magacin</div>
            <div className="font-medium">
              {order.warehouse ? `${order.warehouse.code} - ${order.warehouse.name}` : "-"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Kontakt osoba</div>
            <div className="font-medium">{order.contact_person || "-"}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Robu poručio</div>
            <div className="font-medium">{order.ordered_by || "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Broj ponude</div>
            <div className="font-medium">{order.source_quote_id ? "Povezana" : "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Broj otpremnice</div>
            <div className="font-medium">{order.delivery_note_id ? "Povezana" : "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Broj fakture</div>
            <div className="font-medium">{order.invoice_id ? "Povezana" : "-"}</div>
          </div>
        </div>

        {/* Note */}
        {order.note && (
          <div className="text-sm">
            <div className="text-muted-foreground mb-1">Napomena</div>
            <div className="bg-muted p-2 rounded-md whitespace-pre-wrap">{order.note}</div>
          </div>
        )}

        <Separator />

        {/* Items editor */}
        <DeliveryOrderItemsEditor
          orderId={order.id}
          companyId={order.company_id}
          warehouseId={order.warehouse_id}
          isReadOnly={!isDraft}
          onItemsChanged={fetchOrder}
        />
      </div>

      {/* Dialogs */}
      <DeliveryOrderHeaderDialog
        open={headerDialogOpen}
        onOpenChange={setHeaderDialogOpen}
        order={order}
        onSave={handleHeaderSave}
        isLoading={updateMutation.isPending}
      />

      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odobrenje naloga</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da odobrite nalog <strong>{order.order_number}</strong>?
              Odobren nalog se može koristiti za dalju obradu (kreiranje otpremnice).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveConfirm}>Odobri</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reserveDialogOpen} onOpenChange={setReserveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rezervacija naloga</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da rezervišete nalog <strong>{order.order_number}</strong>?
              Ovo će odobriti nalog za dalju obradu i kreirati rezervacije artikala u magacinu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleReserveConfirm}>Rezerviši</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {order && (
        <DocumentHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          documentId={order.id}
          documentName={order.order_number}
          documentType="delivery_order"
        />
      )}
    </MainLayout>
  );
}
