import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { usePartners } from "@/hooks/usePartners";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useAuth } from "@/contexts/AuthContext";
import { Invoice, useInvoices } from "@/hooks/useInvoices";
import { Eye } from "lucide-react";

interface InvoiceHeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  readOnly?: boolean;
  onSaved?: () => void;
}

export function InvoiceHeaderDialog({
  open,
  onOpenChange,
  invoice,
  readOnly = false,
  onSaved,
}: InvoiceHeaderDialogProps) {
  const { selectedCompany } = useAuth();
  const { partners } = usePartners();
  const { units } = useOrganizationalUnits(selectedCompany?.id);
  const { updateInvoice } = useInvoices();

  const [formData, setFormData] = useState({
    invoice_date: "",
    due_date: "" as string | null,
    partner_id: "",
    org_unit_id: "" as string | null,
    note: "" as string | null,
    internal_note: "" as string | null,
    header_note: "" as string | null,
    partner_name: "" as string | null,
    partner_address: "" as string | null,
    partner_city: "" as string | null,
    partner_postal_code: "" as string | null,
    partner_pib: "" as string | null,
    partner_mb: "" as string | null,
    composed_by: "" as string | null,
  });

  useEffect(() => {
    if (!invoice || !open) return;
    setFormData({
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || "",
      partner_id: invoice.partner_id,
      org_unit_id: invoice.org_unit_id || "",
      note: invoice.note || "",
      internal_note: invoice.internal_note || "",
      header_note: invoice.header_note || "",
      partner_name: invoice.partner_name ?? invoice.partner?.name ?? "",
      partner_address: invoice.partner_address ?? invoice.partner?.address ?? "",
      partner_city: invoice.partner_city ?? invoice.partner?.city ?? "",
      partner_postal_code: invoice.partner_postal_code ?? invoice.partner?.postal_code ?? "",
      partner_pib: invoice.partner_pib ?? invoice.partner?.pib ?? "",
      partner_mb: invoice.partner_mb ?? invoice.partner?.mb ?? "",
      composed_by: invoice.composed_by || "",
    });
  }, [invoice, open]);

  const handlePartnerChange = (partnerId: string) => {
    const p = customerPartners.find((x) => x.id === partnerId);
    setFormData((prev) => ({
      ...prev,
      partner_id: partnerId,
      partner_name: p?.name ?? "",
      partner_address: p?.address ?? "",
      partner_city: p?.city ?? "",
      partner_postal_code: p?.postal_code ?? "",
      partner_pib: p?.pib ?? "",
      partner_mb: p?.mb ?? "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || readOnly) return;

    await updateInvoice.mutateAsync({
      id: invoice.id,
      invoice_date: formData.invoice_date,
      due_date: formData.due_date || null,
      partner_id: formData.partner_id,
      org_unit_id: formData.org_unit_id || null,
      note: formData.note || null,
      internal_note: formData.internal_note || null,
    });
    onOpenChange(false);
    onSaved?.();
  };

  const customerPartners = partners.filter((p) => p.is_customer && p.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {readOnly && <Eye className="w-4 h-4" />}
            {readOnly ? "Zaglavlje:" : "Uredi zaglavlje:"} {invoice?.invoice_number}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum fakture *</Label>
              <LocaleDateInput
                value={formData.invoice_date}
                onChange={(v) => setFormData({ ...formData, invoice_date: v })}
                required
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Datum valute</Label>
              <LocaleDateInput
                value={formData.due_date || ""}
                onChange={(v) => setFormData({ ...formData, due_date: v || null })}
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kupac *</Label>
              {readOnly ? (
                <Input value={`${invoice?.partner?.code || ""} - ${formData.partner_name || ""}`} disabled />
              ) : (
                <SearchablePartnerSelect
                  partners={customerPartners}
                  value={formData.partner_id}
                  onValueChange={handlePartnerChange}
                  placeholder="Pretraži i izaberi kupca..."
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Organizaciona jedinica</Label>
              <Select
                value={formData.org_unit_id || "none"}
                onValueChange={(v) => setFormData({ ...formData, org_unit_id: v === "none" ? null : v })}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="--" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Bez org. jedinice --</SelectItem>
                  {units.filter((u) => u.is_active).map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.code} - {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Partner snapshot */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="col-span-2 md:col-span-3 space-y-1">
              <Label className="text-xs text-muted-foreground">Naziv kupca na fakturi</Label>
              <Input
                value={formData.partner_name || ""}
                onChange={(e) => setFormData({ ...formData, partner_name: e.target.value || null })}
                className="h-8 text-sm"
                disabled={readOnly}
                autoComplete="off"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Adresa</Label>
              <Input
                value={formData.partner_address || ""}
                onChange={(e) => setFormData({ ...formData, partner_address: e.target.value || null })}
                className="h-8 text-sm"
                disabled={readOnly}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Poštanski broj</Label>
              <Input
                value={formData.partner_postal_code || ""}
                onChange={(e) => setFormData({ ...formData, partner_postal_code: e.target.value || null })}
                className="h-8 text-sm"
                disabled={readOnly}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mesto</Label>
              <Input
                value={formData.partner_city || ""}
                onChange={(e) => setFormData({ ...formData, partner_city: e.target.value || null })}
                className="h-8 text-sm"
                disabled={readOnly}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">PIB</Label>
              <Input
                value={formData.partner_pib || ""}
                onChange={(e) => setFormData({ ...formData, partner_pib: e.target.value || null })}
                className="h-8 text-sm"
                disabled={readOnly}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Matični broj</Label>
              <Input
                value={formData.partner_mb || ""}
                onChange={(e) => setFormData({ ...formData, partner_mb: e.target.value || null })}
                className="h-8 text-sm"
                disabled={readOnly}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Napomena u zaglavlju</Label>
              <Textarea
                value={formData.header_note || ""}
                onChange={(e) => setFormData({ ...formData, header_note: e.target.value || null })}
                rows={2}
                placeholder="Kratka napomena iznad stavki..."
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Napomena za kupca</Label>
              <Textarea
                value={formData.note || ""}
                onChange={(e) => setFormData({ ...formData, note: e.target.value || null })}
                rows={2}
                placeholder="Napomena na fakturi..."
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Interna napomena</Label>
              <Textarea
                value={formData.internal_note || ""}
                onChange={(e) => setFormData({ ...formData, internal_note: e.target.value || null })}
                rows={2}
                placeholder="Interna napomena..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Composed by */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fakturu sastavio</Label>
              <Input
                value={formData.composed_by || ""}
                onChange={(e) => setFormData({ ...formData, composed_by: e.target.value || null })}
                disabled={readOnly}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            {readOnly ? (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Zatvori
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Otkaži
                </Button>
                <Button
                  type="submit"
                  disabled={!formData.partner_id || updateInvoice.isPending}
                >
                  {updateInvoice.isPending ? "Čuvanje..." : "Sačuvaj"}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
