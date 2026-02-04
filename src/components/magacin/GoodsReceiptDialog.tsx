import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useWarehouses } from "@/hooks/useWarehouses";
import { usePartners } from "@/hooks/usePartners";
import { useAuth } from "@/contexts/AuthContext";
import { GoodsReceipt, GoodsReceiptFormData } from "@/hooks/useGoodsReceipts";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";

interface GoodsReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt?: GoodsReceipt;
  onSave: (data: GoodsReceiptFormData) => Promise<void>;
}

export function GoodsReceiptDialog({
  open,
  onOpenChange,
  receipt,
  onSave,
}: GoodsReceiptDialogProps) {
  const { selectedCompany } = useAuth();
  const { warehouses } = useWarehouses(selectedCompany?.id);
  const { partners } = usePartners();

  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<GoodsReceiptFormData>({
    warehouse_id: "",
    partner_id: null,
    receipt_date: new Date().toISOString().split("T")[0],
    note: null,
  });

  useEffect(() => {
    if (receipt) {
      setFormData({
        warehouse_id: receipt.warehouse_id,
        partner_id: receipt.partner_id,
        receipt_date: receipt.receipt_date,
        note: receipt.note,
      });
    } else {
      setFormData({
        warehouse_id: warehouses[0]?.id || "",
        partner_id: null,
        receipt_date: new Date().toISOString().split("T")[0],
        note: null,
      });
    }
  }, [receipt, open, warehouses]);

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
  const supplierPartners = partners.filter((p) => p.is_supplier && p.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {receipt ? "Izmeni prijemnicu" : "Nova prijemnica"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="warehouse_id">Magacin *</Label>
              <Select
                value={formData.warehouse_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, warehouse_id: value }))
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
              <Label>Datum prijema *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.receipt_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.receipt_date
                      ? format(new Date(formData.receipt_date), "dd.MM.yyyy", {
                          locale: sr,
                        })
                      : "Izaberite datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={
                      formData.receipt_date
                        ? new Date(formData.receipt_date)
                        : undefined
                    }
                    onSelect={(date) =>
                      setFormData((prev) => ({
                        ...prev,
                        receipt_date: date?.toISOString().split("T")[0] || "",
                      }))
                    }
                    locale={sr}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dobavljač (opciono)</Label>
            <SearchablePartnerSelect
              partners={supplierPartners}
              value={formData.partner_id || ""}
              onValueChange={(id) =>
                setFormData((prev) => ({ ...prev, partner_id: id || null }))
              }
              placeholder="Izaberite dobavljača..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Napomena</Label>
            <Textarea
              id="note"
              value={formData.note || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  note: e.target.value || null,
                }))
              }
              placeholder="Unesite napomenu..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Odustani
            </Button>
            <Button type="submit" disabled={isSaving || !formData.warehouse_id}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {receipt ? "Sačuvaj" : "Kreiraj"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
