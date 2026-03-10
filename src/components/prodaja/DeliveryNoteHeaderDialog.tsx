import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { usePartners } from "@/hooks/usePartners";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { DeliveryNote } from "@/hooks/useDeliveryNotes";
import { format } from "date-fns";

interface DeliveryNoteHeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryNote?: DeliveryNote | null;
  onSave: (data: any) => void;
  isLoading?: boolean;
  readOnly?: boolean;
}

export function DeliveryNoteHeaderDialog({
  open,
  onOpenChange,
  deliveryNote,
  onSave,
  isLoading,
  readOnly,
}: DeliveryNoteHeaderDialogProps) {
  const { selectedCompany, user } = useAuth();
  const companyId = selectedCompany?.id;
  const { partners } = usePartners();
  const { warehouses } = useWarehouses(companyId);
  const { units: orgUnits } = useOrganizationalUnits(companyId);

  const activePartners = partners.filter((p) => p.is_active && p.is_customer);
  const activeWarehouses = warehouses.filter((w) => w.is_active);
  const activeOrgUnits = orgUnits.filter((u) => u.is_active);

  const [formData, setFormData] = useState({
    partner_id: "",
    warehouse_id: "",
    org_unit_id: "" as string | null,
    delivery_date: format(new Date(), "yyyy-MM-dd"),
    delivery_address: "",
    delivery_method: "",
    issued_by: "",
    received_by: "",
    note: "",
    internal_note: "",
  });

  useEffect(() => {
    if (open) {
      if (deliveryNote) {
        setFormData({
          partner_id: deliveryNote.partner_id,
          warehouse_id: deliveryNote.warehouse_id || "",
          org_unit_id: deliveryNote.org_unit_id || null,
          delivery_date: deliveryNote.delivery_date,
          delivery_address: (deliveryNote as any).delivery_address || "",
          delivery_method: (deliveryNote as any).delivery_method || "",
          issued_by: (deliveryNote as any).issued_by || "",
          received_by: (deliveryNote as any).received_by || "",
          note: deliveryNote.note || "",
          internal_note: deliveryNote.internal_note || "",
        });
      } else {
        const userName = user?.user_metadata?.first_name && user?.user_metadata?.last_name
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
          : "";
        setFormData({
          partner_id: "",
          warehouse_id: "",
          org_unit_id: null,
          delivery_date: format(new Date(), "yyyy-MM-dd"),
          delivery_address: "",
          delivery_method: "",
          issued_by: userName,
          received_by: "",
          note: "",
          internal_note: "",
        });
      }
    }
  }, [open, deliveryNote]);

  const handleSubmit = () => {
    if (!formData.partner_id || !formData.warehouse_id) return;
    onSave(formData);
  };

  const isNew = !deliveryNote;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
        onFocusOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {readOnly ? "Pregled zaglavlja otpremnice" : isNew ? "Nova otpremnica" : "Uredi zaglavlje otpremnice"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Kupac *</Label>
            <SearchablePartnerSelect
              partners={activePartners}
              value={formData.partner_id}
              onValueChange={(v) => setFormData((p) => ({ ...p, partner_id: v }))}
              placeholder="Izaberite kupca"
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label>Magacin *</Label>
            <Select
              value={formData.warehouse_id}
              onValueChange={(v) => setFormData((p) => ({ ...p, warehouse_id: v }))}
              disabled={readOnly}
            >
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

          <div className="space-y-2">
            <Label>Datum otpreme *</Label>
            <LocaleDateInput
              value={formData.delivery_date}
              onChange={(v) => setFormData((p) => ({ ...p, delivery_date: v }))}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label>Organizaciona jedinica</Label>
            <Select
              value={formData.org_unit_id || "none"}
              onValueChange={(v) =>
                setFormData((p) => ({ ...p, org_unit_id: v === "none" ? null : v }))
              }
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Izaberite OJ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">- Bez OJ -</SelectItem>
                {activeOrgUnits.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.code} - {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
          </Select>
          </div>

          <div className="space-y-2">
            <Label>Adresa otpreme</Label>
            <Input
              value={formData.delivery_address}
              onChange={(e) => setFormData((p) => ({ ...p, delivery_address: e.target.value }))}
              autoComplete="off"
              disabled={readOnly}
              placeholder="Unesite adresu otpreme"
            />
          </div>

          <div className="space-y-2">
            <Label>Način otpreme</Label>
            <Input
              value={formData.delivery_method}
              onChange={(e) => setFormData((p) => ({ ...p, delivery_method: e.target.value }))}
              autoComplete="off"
              disabled={readOnly}
              placeholder="Unesite način otpreme"
            />
          </div>

          <div className="space-y-2">
            <Label>Robu izdao</Label>
            <Input
              value={formData.issued_by}
              onChange={(e) => setFormData((p) => ({ ...p, issued_by: e.target.value }))}
              autoComplete="off"
              disabled={readOnly}
              placeholder="Ime i prezime"
            />
          </div>

          <div className="space-y-2">
            <Label>Robu primio</Label>
            <Input
              value={formData.received_by}
              onChange={(e) => setFormData((p) => ({ ...p, received_by: e.target.value }))}
              autoComplete="off"
              disabled={readOnly}
              placeholder="Ime i prezime"
            />
          </div>

          <div className="col-span-2 space-y-2">
            <Label>Napomena (prikazuje se na dokumentu)</Label>
            <Textarea
              value={formData.note}
              onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
              rows={2}
              autoComplete="off"
              disabled={readOnly}
            />
          </div>

          <div className="col-span-2 space-y-2">
            <Label>Interna napomena</Label>
            <Textarea
              value={formData.internal_note}
              onChange={(e) => setFormData((p) => ({ ...p, internal_note: e.target.value }))}
              rows={2}
              autoComplete="off"
              disabled={readOnly}
            />
          </div>
        </div>

        <DialogFooter>
          {readOnly ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Zatvori</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Otkaži</Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !formData.partner_id || !formData.warehouse_id || !formData.delivery_date}
              >
                {isLoading ? "Čuvanje..." : "Sačuvaj"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
