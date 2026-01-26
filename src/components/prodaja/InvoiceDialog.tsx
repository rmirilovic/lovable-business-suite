import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { usePartners } from "@/hooks/usePartners";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useAuth } from "@/contexts/AuthContext";
import { Invoice, InvoiceFormData } from "@/hooks/useInvoices";
import { format, addDays } from "date-fns";

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onSave: (data: InvoiceFormData) => void;
  isLoading: boolean;
}

export function InvoiceDialog({
  open,
  onOpenChange,
  invoice,
  onSave,
  isLoading,
}: InvoiceDialogProps) {
  const { selectedCompany } = useAuth();
  const { partners } = usePartners();
  const { units } = useOrganizationalUnits(selectedCompany?.id);

  const [formData, setFormData] = useState<InvoiceFormData>({
    invoice_date: format(new Date(), "yyyy-MM-dd"),
    due_date: format(addDays(new Date(), 15), "yyyy-MM-dd"),
    partner_id: "",
    org_unit_id: null,
    note: null,
    internal_note: null,
  });

  useEffect(() => {
    if (invoice) {
      setFormData({
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        partner_id: invoice.partner_id,
        org_unit_id: invoice.org_unit_id,
        note: invoice.note,
        internal_note: invoice.internal_note,
      });
    } else {
      setFormData({
        invoice_date: format(new Date(), "yyyy-MM-dd"),
        due_date: format(addDays(new Date(), 15), "yyyy-MM-dd"),
        partner_id: "",
        org_unit_id: null,
        note: null,
        internal_note: null,
      });
    }
  }, [invoice, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const customerPartners = partners.filter(p => p.is_customer && p.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {invoice ? `Uredi fakturu ${invoice.invoice_number}` : "Nova faktura"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_date">Datum fakture *</Label>
              <LocaleDateInput
                value={formData.invoice_date}
                onChange={(value) => setFormData({ ...formData, invoice_date: value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Datum valute</Label>
              <LocaleDateInput
                value={formData.due_date || ""}
                onChange={(value) => setFormData({ ...formData, due_date: value || null })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner_id">Kupac *</Label>
            <Select
              value={formData.partner_id}
              onValueChange={(value) => setFormData({ ...formData, partner_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Izaberite kupca" />
              </SelectTrigger>
              <SelectContent>
                {customerPartners.map((partner) => (
                  <SelectItem key={partner.id} value={partner.id}>
                    {partner.code} - {partner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org_unit_id">Organizaciona jedinica</Label>
            <Select
              value={formData.org_unit_id || "none"}
              onValueChange={(value) => setFormData({ ...formData, org_unit_id: value === "none" ? null : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Izaberite org. jedinicu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Bez org. jedinice --</SelectItem>
                {units.filter(u => u.is_active).map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.code} - {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Napomena za kupca</Label>
            <Textarea
              id="note"
              value={formData.note || ""}
              onChange={(e) => setFormData({ ...formData, note: e.target.value || null })}
              rows={2}
              placeholder="Napomena koja će se prikazati na fakturi..."
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="internal_note">Interna napomena</Label>
            <Textarea
              id="internal_note"
              value={formData.internal_note || ""}
              onChange={(e) => setFormData({ ...formData, internal_note: e.target.value || null })}
              rows={2}
              placeholder="Interna napomena (neće se prikazati kupcu)..."
              autoComplete="off"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Otkaži
            </Button>
            <Button type="submit" disabled={isLoading || !formData.partner_id}>
              {isLoading ? "Čuvanje..." : invoice ? "Sačuvaj" : "Kreiraj"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
