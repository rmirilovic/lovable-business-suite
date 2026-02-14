import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useAuth } from "@/contexts/AuthContext";
import { PriceAdjustment, PriceAdjustmentFormData } from "@/hooks/usePriceAdjustments";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adjustment?: PriceAdjustment;
  onSave: (data: PriceAdjustmentFormData) => Promise<void>;
}

export function PriceAdjustmentDialog({ open, onOpenChange, adjustment, onSave }: Props) {
  const { selectedCompany } = useAuth();
  const { warehouses } = useWarehouses(selectedCompany?.id);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<PriceAdjustmentFormData>({
    warehouse_id: "",
    adjustment_date: new Date().toISOString().split("T")[0],
    note: null,
  });

  // Only SVK=1 warehouses (Roba)
  const eligibleWarehouses = warehouses.filter((w) => w.is_active && w.warehouse_type === "1");

  useEffect(() => {
    if (!open) return;
    if (adjustment) {
      setFormData({
        warehouse_id: adjustment.warehouse_id,
        adjustment_date: adjustment.adjustment_date,
        note: adjustment.note,
      });
    } else {
      setFormData({
        warehouse_id: eligibleWarehouses[0]?.id || "",
        adjustment_date: new Date().toISOString().split("T")[0],
        note: null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustment, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.warehouse_id) return;
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{adjustment ? "Izmeni nivelaciju" : "Nova nivelacija cena"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Magacin (SVK=1) *</Label>
              <Select
                value={formData.warehouse_id}
                onValueChange={(v) => setFormData((p) => ({ ...p, warehouse_id: v }))}
                disabled={!!adjustment}
              >
                <SelectTrigger><SelectValue placeholder="Izaberite magacin" /></SelectTrigger>
                <SelectContent>
                  {eligibleWarehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>{wh.code} - {wh.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Datum nivelacije *</Label>
              <LocaleDateInput
                value={formData.adjustment_date}
                onChange={(val) => setFormData((p) => ({ ...p, adjustment_date: val }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Napomena</Label>
            <Textarea
              value={formData.note || ""}
              onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value || null }))}
              placeholder="Unesite napomenu..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isSaving || !formData.warehouse_id}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {adjustment ? "Sačuvaj" : "Kreiraj"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
