import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { usePartners } from "@/hooks/usePartners";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";

interface DeliveryNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DeliveryNoteFormData) => void;
  initialData?: DeliveryNoteFormData;
  isSubmitting?: boolean;
}

export interface DeliveryNoteFormData {
  partner_id: string;
  warehouse_id: string;
  org_unit_id: string | null;
  delivery_date: string;
  note: string;
  internal_note: string;
}

export function DeliveryNoteDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isSubmitting,
}: DeliveryNoteDialogProps) {
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;
  const { partners, isLoading: partnersLoading } = usePartners(companyId);
  const { warehouses, isLoading: warehousesLoading } = useWarehouses(companyId);
  const { units: orgUnits, isLoading: orgUnitsLoading } = useOrganizationalUnits(companyId);

  const [formData, setFormData] = useState<DeliveryNoteFormData>({
    partner_id: "",
    warehouse_id: "",
    org_unit_id: null,
    delivery_date: new Date().toISOString().split("T")[0],
    note: "",
    internal_note: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        partner_id: "",
        warehouse_id: "",
        org_unit_id: null,
        delivery_date: new Date().toISOString().split("T")[0],
        note: "",
        internal_note: "",
      });
    }
  }, [initialData, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const activePartners = partners.filter((p) => p.is_active && p.is_customer);
  const activeWarehouses = warehouses.filter((w) => w.is_active);
  const activeOrgUnits = orgUnits.filter((u) => u.is_active);

  const isLoading = partnersLoading || warehousesLoading || orgUnitsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Izmena otpremnice" : "Nova otpremnica"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="partner_id">Kupac *</Label>
              <Select
                value={formData.partner_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, partner_id: value })
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite kupca" />
                </SelectTrigger>
                <SelectContent>
                  {activePartners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.code} - {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouse_id">Magacin *</Label>
              <Select
                value={formData.warehouse_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, warehouse_id: value })
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite magacin" />
                </SelectTrigger>
                <SelectContent>
                  {activeWarehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} - {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery_date">Datum otpreme *</Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.delivery_date}
                onChange={(e) =>
                  setFormData({ ...formData, delivery_date: e.target.value })
                }
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org_unit_id">Organizaciona jedinica</Label>
              <Select
                value={formData.org_unit_id || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    org_unit_id: value === "none" ? null : value,
                  })
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite OJ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">- Bez OJ -</SelectItem>
                  {activeOrgUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.code} - {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Napomena (prikazuje se na dokumentu)</Label>
            <Textarea
              id="note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={2}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="internal_note">Interna napomena</Label>
            <Textarea
              id="internal_note"
              value={formData.internal_note}
              onChange={(e) =>
                setFormData({ ...formData, internal_note: e.target.value })
              }
              rows={2}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Otkaži
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !formData.partner_id ||
                !formData.warehouse_id ||
                !formData.delivery_date
              }
            >
              {isSubmitting ? "Čuvanje..." : "Sačuvaj"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
