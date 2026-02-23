import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { useAuth } from "@/contexts/AuthContext";
import { useWarehouses } from "@/hooks/useWarehouses";
import { usePartners } from "@/hooks/usePartners";
import { supabase } from "@/integrations/supabase/client";
import { DeliveryOrder } from "@/hooks/useDeliveryOrders";

interface DeliveryOrderHeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: DeliveryOrder | null;
  onSave: (data: any) => void;
  isLoading?: boolean;
}

export function DeliveryOrderHeaderDialog({ open, onOpenChange, order, onSave, isLoading }: DeliveryOrderHeaderDialogProps) {
  const { selectedCompany, user } = useAuth();
  const { warehouses } = useWarehouses(selectedCompany?.id);
  const { partners } = usePartners();
  const activeWarehouses = warehouses.filter((w) => w.is_active);

  const [formData, setFormData] = useState({
    order_date: new Date().toISOString().split("T")[0],
    partner_id: "",
    delivery_address: "",
    delivery_method: "",
    warehouse_id: "",
    payment_method: "",
    contact_person: "",
    ordered_by: "",
    note: "",
    composed_by: "",
  });

  useEffect(() => {
    if (open) {
      if (order) {
        setFormData({
          order_date: order.order_date,
          partner_id: order.partner_id,
          delivery_address: order.delivery_address || "",
          delivery_method: order.delivery_method || "",
          warehouse_id: order.warehouse_id || "",
          payment_method: order.payment_method || "",
          contact_person: order.contact_person || "",
          ordered_by: order.ordered_by || "",
          note: order.note || "",
          composed_by: order.composed_by || "",
        });
      } else {
        // New order - get user name for composed_by
        const loadProfile = async () => {
          if (!user) return;
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", user.id)
            .single();
          if (profile) {
            setFormData((prev) => ({
              ...prev,
              composed_by: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
            }));
          }
        };
        loadProfile();
        setFormData((prev) => ({
          ...prev,
          order_date: new Date().toISOString().split("T")[0],
          partner_id: "",
          delivery_address: "",
          delivery_method: "",
          warehouse_id: "",
          payment_method: "",
          contact_person: "",
          ordered_by: "",
          note: "",
        }));
      }
    }
  }, [open, order, user]);

  // Auto-fill delivery address from partner
  useEffect(() => {
    if (formData.partner_id && !order) {
      const partner = partners.find((p) => p.id === formData.partner_id);
      if (partner) {
        const addr = [partner.address, partner.postal_code, partner.city].filter(Boolean).join(", ");
        setFormData((prev) => ({ ...prev, delivery_address: addr }));
      }
    }
  }, [formData.partner_id, partners, order]);

  const handleSubmit = () => {
    if (!formData.partner_id) return;
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? "Uredi zaglavlje naloga" : "Novi nalog za isporuku"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Datum naloga *</Label>
            <LocaleDateInput value={formData.order_date} onChange={(v) => setFormData((p) => ({ ...p, order_date: v }))} />
          </div>
          <div className="space-y-1">
            <Label>Kupac *</Label>
            <SearchablePartnerSelect
              partners={partners.filter((p) => p.is_active)}
              value={formData.partner_id}
              onValueChange={(v) => setFormData((p) => ({ ...p, partner_id: v }))}
              placeholder="Izaberite kupca"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Adresa za isporuku</Label>
            <Input
              value={formData.delivery_address}
              onChange={(e) => setFormData((p) => ({ ...p, delivery_address: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Način isporuke</Label>
            <Input
              value={formData.delivery_method}
              onChange={(e) => setFormData((p) => ({ ...p, delivery_method: e.target.value }))}
              placeholder="npr. Sopstveni transport"
            />
          </div>
          <div className="space-y-1">
            <Label>Magacin</Label>
            <Select value={formData.warehouse_id} onValueChange={(v) => setFormData((p) => ({ ...p, warehouse_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Izaberite magacin" />
              </SelectTrigger>
              <SelectContent>
                {activeWarehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.code} - {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Način plaćanja</Label>
            <Input
              value={formData.payment_method}
              onChange={(e) => setFormData((p) => ({ ...p, payment_method: e.target.value }))}
              placeholder="npr. Virman 30 dana"
            />
          </div>
          <div className="space-y-1">
            <Label>Kontakt osoba</Label>
            <Input
              value={formData.contact_person}
              onChange={(e) => setFormData((p) => ({ ...p, contact_person: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Robu poručio</Label>
            <Input
              value={formData.ordered_by}
              onChange={(e) => setFormData((p) => ({ ...p, ordered_by: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Kreirao dokument</Label>
            <Input
              value={formData.composed_by}
              onChange={(e) => setFormData((p) => ({ ...p, composed_by: e.target.value }))}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Napomena</Label>
            <Textarea
              value={formData.note}
              onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Otkaži</Button>
          <Button onClick={handleSubmit} disabled={!formData.partner_id || isLoading}>
            {isLoading ? "Čuvanje..." : "Sačuvaj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
