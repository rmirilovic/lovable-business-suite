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
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { Quote, QuoteFormData, useQuotes } from "@/hooks/useQuotes";

interface QuoteHeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
  onSaved?: () => void;
}

export function QuoteHeaderDialog({
  open,
  onOpenChange,
  quote,
  onSaved,
}: QuoteHeaderDialogProps) {
  const { selectedCompany } = useAuth();
  const { minDate, maxDate } = useBusinessYearDateLimits();
  const { partners } = usePartners();
  const { units } = useOrganizationalUnits(selectedCompany?.id);
  const { bankAccounts } = useBankAccounts(selectedCompany?.id);
  const { updateQuote } = useQuotes();

  const [formData, setFormData] = useState({
    quote_date: "",
    valid_until: "" as string | null,
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
    approved_by_name: "" as string | null,
    bank_account_id: "" as string | null,
    payment_method: "" as string | null,
  });

  useEffect(() => {
    if (!quote || !open) return;
    setFormData({
      quote_date: quote.quote_date,
      valid_until: quote.valid_until || "",
      partner_id: quote.partner_id,
      org_unit_id: quote.org_unit_id || "",
      note: quote.note || "",
      internal_note: quote.internal_note || "",
      header_note: quote.header_note || "",
      partner_name: quote.partner_name ?? quote.partner?.name ?? "",
      partner_address: quote.partner_address ?? quote.partner?.address ?? "",
      partner_city: quote.partner_city ?? quote.partner?.city ?? "",
      partner_postal_code: quote.partner_postal_code ?? quote.partner?.postal_code ?? "",
      partner_pib: quote.partner_pib ?? quote.partner?.pib ?? "",
      partner_mb: quote.partner_mb ?? quote.partner?.mb ?? "",
      composed_by: quote.composed_by || "",
      approved_by_name: quote.approved_by_name || "",
      bank_account_id: quote.bank_account_id || "",
      payment_method: quote.payment_method || "",
    });
  }, [quote, open]);

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
    if (!quote) return;

    await updateQuote.mutateAsync({
      id: quote.id,
      quote_date: formData.quote_date,
      valid_until: formData.valid_until || null,
      partner_id: formData.partner_id,
      org_unit_id: formData.org_unit_id || null,
      note: formData.note || null,
      internal_note: formData.internal_note || null,
      header_note: formData.header_note || null,
      partner_name: formData.partner_name || null,
      partner_address: formData.partner_address || null,
      partner_city: formData.partner_city || null,
      partner_postal_code: formData.partner_postal_code || null,
      partner_pib: formData.partner_pib || null,
      partner_mb: formData.partner_mb || null,
      composed_by: formData.composed_by || null,
      approved_by_name: formData.approved_by_name || null,
      bank_account_id: formData.bank_account_id || null,
      payment_method: formData.payment_method || null,
    });
    onOpenChange(false);
    onSaved?.();
  };

  const customerPartners = partners.filter((p) => p.is_customer && p.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            Uredi zaglavlje: {quote?.quote_number}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum ponude *</Label>
              <LocaleDateInput
                value={formData.quote_date}
                onChange={(v) => setFormData({ ...formData, quote_date: v })}
                required
                minDate={minDate}
                maxDate={maxDate}
              />
            </div>
            <div className="space-y-2">
              <Label>Važi do</Label>
              <LocaleDateInput
                value={formData.valid_until || ""}
                onChange={(v) => setFormData({ ...formData, valid_until: v || null })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kupac *</Label>
              <SearchablePartnerSelect
                partners={customerPartners}
                value={formData.partner_id}
                onValueChange={handlePartnerChange}
                placeholder="Pretraži i izaberi kupca..."
              />
            </div>
            <div className="space-y-2">
              <Label>Organizaciona jedinica</Label>
              <Select
                value={formData.org_unit_id || "none"}
                onValueChange={(v) => setFormData({ ...formData, org_unit_id: v === "none" ? null : v })}
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
              <Label className="text-xs text-muted-foreground">Naziv kupca na ponudi</Label>
              <Input
                value={formData.partner_name || ""}
                onChange={(e) => setFormData({ ...formData, partner_name: e.target.value || null })}
                className="h-8 text-sm"
                autoComplete="off"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Adresa</Label>
              <Input
                value={formData.partner_address || ""}
                onChange={(e) => setFormData({ ...formData, partner_address: e.target.value || null })}
                className="h-8 text-sm"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Poštanski broj</Label>
              <Input
                value={formData.partner_postal_code || ""}
                onChange={(e) => setFormData({ ...formData, partner_postal_code: e.target.value || null })}
                className="h-8 text-sm"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mesto</Label>
              <Input
                value={formData.partner_city || ""}
                onChange={(e) => setFormData({ ...formData, partner_city: e.target.value || null })}
                className="h-8 text-sm"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">PIB</Label>
              <Input
                value={formData.partner_pib || ""}
                onChange={(e) => setFormData({ ...formData, partner_pib: e.target.value || null })}
                className="h-8 text-sm"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Matični broj</Label>
              <Input
                value={formData.partner_mb || ""}
                onChange={(e) => setFormData({ ...formData, partner_mb: e.target.value || null })}
                className="h-8 text-sm"
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
              />
            </div>
            <div className="space-y-2">
              <Label>Napomena za kupca</Label>
              <Textarea
                value={formData.note || ""}
                onChange={(e) => setFormData({ ...formData, note: e.target.value || null })}
                rows={2}
                placeholder="Napomena na ponudi..."
              />
            </div>
            <div className="space-y-2">
              <Label>Interna napomena</Label>
              <Textarea
                value={formData.internal_note || ""}
                onChange={(e) => setFormData({ ...formData, internal_note: e.target.value || null })}
                rows={2}
                placeholder="Interna napomena..."
              />
            </div>
          </div>

          {/* Bank account & Payment method */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tekući račun</Label>
              <Select
                value={formData.bank_account_id || "none"}
                onValueChange={(v) => setFormData({ ...formData, bank_account_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- Izaberite tekući račun --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Bez tekućeg računa --</SelectItem>
                  {bankAccounts.filter((ba) => ba.is_active).map((ba) => (
                    <SelectItem key={ba.id} value={ba.id}>
                      {ba.code} - {ba.account_number} ({ba.bank_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Način plaćanja</Label>
              <Input
                value={formData.payment_method || ""}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value || null })}
                maxLength={127}
                autoComplete="off"
                placeholder="Npr. Virmansko plaćanje..."
              />
            </div>
          </div>

          {/* Composed by / Approved by */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ponudu sastavio</Label>
              <Input
                value={formData.composed_by || ""}
                onChange={(e) => setFormData({ ...formData, composed_by: e.target.value || null })}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Ponudu odobrio</Label>
              <Input
                value={formData.approved_by_name || ""}
                onChange={(e) => setFormData({ ...formData, approved_by_name: e.target.value || null })}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Otkaži
            </Button>
            <Button
              type="submit"
              disabled={!formData.partner_id || updateQuote.isPending}
            >
              {updateQuote.isPending ? "Čuvanje..." : "Sačuvaj"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
