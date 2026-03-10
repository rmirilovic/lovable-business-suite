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
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useAuth } from "@/contexts/AuthContext";
import { InventoryCount, InventoryCountFormData } from "@/hooks/useInventoryCounts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count?: InventoryCount;
  onSave: (data: InventoryCountFormData) => Promise<void>;
}

export function InventoryCountDialog({ open, onOpenChange, count, onSave }: Props) {
  const { selectedCompany } = useAuth();
  const { minDate, maxDate } = useBusinessYearDateLimits();
  const { warehouses } = useWarehouses(selectedCompany?.id);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<InventoryCountFormData>({
    warehouse_id: "",
    count_date: new Date().toISOString().split("T")[0],
    note: null,
  });

  useEffect(() => {
    if (!open) return;
    if (count) {
      setFormData({
        warehouse_id: count.warehouse_id,
        count_date: count.count_date,
        note: count.note,
      });
    } else {
      setFormData({
        warehouse_id: warehouses[0]?.id || "",
        count_date: new Date().toISOString().split("T")[0],
        note: null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, open]);

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

  const activeWarehouses = warehouses.filter((w) => w.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{count ? "Izmeni popis" : "Nova popisna lista"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Magacin *</Label>
              <Select
                value={formData.warehouse_id}
                onValueChange={(v) => setFormData((p) => ({ ...p, warehouse_id: v }))}
                disabled={!!count}
              >
                <SelectTrigger><SelectValue placeholder="Izaberite magacin" /></SelectTrigger>
                <SelectContent>
                  {activeWarehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>{wh.code} - {wh.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Datum popisa *</Label>
              <LocaleDateInput
                value={formData.count_date}
                onChange={(val) => setFormData((p) => ({ ...p, count_date: val }))}
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
              {count ? "Sačuvaj" : "Kreiraj"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
