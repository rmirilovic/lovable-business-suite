import { useState, useEffect, useMemo } from "react";
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
import { InterWarehouseTransfer, TransferFormData } from "@/hooks/useInterWarehouseTransfers";

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer?: InterWarehouseTransfer;
  onSave: (data: TransferFormData) => Promise<void>;
}

export function TransferDialog({ open, onOpenChange, transfer, onSave }: TransferDialogProps) {
  const { selectedCompany } = useAuth();
  const { minDate, maxDate } = useBusinessYearDateLimits();
  const { warehouses } = useWarehouses(selectedCompany?.id);

  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<TransferFormData>({
    source_warehouse_id: "",
    destination_warehouse_id: "",
    transfer_date: new Date().toISOString().split("T")[0],
    note: null,
  });

  useEffect(() => {
    if (transfer) {
      setFormData({
        source_warehouse_id: transfer.source_warehouse_id,
        destination_warehouse_id: transfer.destination_warehouse_id,
        transfer_date: transfer.transfer_date,
        note: transfer.note,
      });
    } else {
      setFormData({
        source_warehouse_id: "",
        destination_warehouse_id: "",
        transfer_date: new Date().toISOString().split("T")[0],
        note: null,
      });
    }
  }, [transfer, open]);

  const activeWarehouses = warehouses.filter((w) => w.is_active);

  // Filter destination warehouses to same type as source
  const sourceWarehouse = activeWarehouses.find((w) => w.id === formData.source_warehouse_id);
  const destinationOptions = useMemo(() => {
    if (!sourceWarehouse) return activeWarehouses;
    return activeWarehouses.filter(
      (w) => w.warehouse_type === sourceWarehouse.warehouse_type && w.id !== sourceWarehouse.id
    );
  }, [activeWarehouses, sourceWarehouse]);

  // Reset destination if source changes and types don't match
  useEffect(() => {
    if (formData.destination_warehouse_id) {
      const destExists = destinationOptions.find((w) => w.id === formData.destination_warehouse_id);
      if (!destExists) {
        setFormData((prev) => ({ ...prev, destination_warehouse_id: "" }));
      }
    }
  }, [formData.source_warehouse_id, destinationOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.source_warehouse_id || !formData.destination_warehouse_id) return;
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {transfer ? "Izmeni prenos" : "Novi međumagacinski prenos"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Magacin - izlaz *</Label>
              <Select
                value={formData.source_warehouse_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, source_warehouse_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite magacin" />
                </SelectTrigger>
                <SelectContent>
                  {activeWarehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Magacin - ulaz *</Label>
              <Select
                value={formData.destination_warehouse_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, destination_warehouse_id: value }))
                }
                disabled={!formData.source_warehouse_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.source_warehouse_id ? "Izaberite magacin" : "Prvo izaberite izlazni"} />
                </SelectTrigger>
                <SelectContent>
                  {destinationOptions.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sourceWarehouse && destinationOptions.length === 0 && (
                <p className="text-xs text-destructive">
                  Nema magacina istog tipa ({sourceWarehouse.warehouse_type})
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Datum prenosa *</Label>
            <LocaleDateInput
              value={formData.transfer_date}
              onChange={(val) => setFormData((prev) => ({ ...prev, transfer_date: val }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Napomena</Label>
            <Textarea
              value={formData.note || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, note: e.target.value || null }))
              }
              placeholder="Unesite napomenu..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Odustani
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !formData.source_warehouse_id || !formData.destination_warehouse_id}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {transfer ? "Sačuvaj" : "Kreiraj"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
