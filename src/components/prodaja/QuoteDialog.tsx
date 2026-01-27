import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { usePartners } from "@/hooks/usePartners";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useAuth } from "@/contexts/AuthContext";
import { Quote, QuoteFormData } from "@/hooks/useQuotes";
import { format } from "date-fns";

interface QuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
  onSave: (data: QuoteFormData) => void;
  isLoading: boolean;
}

export function QuoteDialog({
  open,
  onOpenChange,
  quote,
  onSave,
  isLoading,
}: QuoteDialogProps) {
  const { selectedCompany } = useAuth();
  const { partners } = usePartners();
  const { units } = useOrganizationalUnits(selectedCompany?.id);

  const [formData, setFormData] = useState<QuoteFormData>({
    quote_date: format(new Date(), "yyyy-MM-dd"),
    valid_until: null,
    partner_id: "",
    org_unit_id: null,
    note: null,
    internal_note: null,
    header_note: null,
    // Partner snapshot data (stored on the quote)
    partner_name: null,
    partner_address: null,
    partner_city: null,
    partner_postal_code: null,
    partner_pib: null,
    partner_mb: null,
  });

  useEffect(() => {
    if (quote) {
      setFormData({
        quote_date: quote.quote_date,
        valid_until: quote.valid_until,
        partner_id: quote.partner_id,
        org_unit_id: quote.org_unit_id,
        note: quote.note,
        internal_note: quote.internal_note,
        header_note: quote.header_note,
        partner_name: quote.partner_name,
        partner_address: quote.partner_address,
        partner_city: quote.partner_city,
        partner_postal_code: quote.partner_postal_code,
        partner_pib: quote.partner_pib,
        partner_mb: quote.partner_mb,
      });
    } else {
      setFormData({
        quote_date: format(new Date(), "yyyy-MM-dd"),
        valid_until: null,
        partner_id: "",
        org_unit_id: null,
        note: null,
        internal_note: null,
        header_note: null,
        partner_name: null,
        partner_address: null,
        partner_city: null,
        partner_postal_code: null,
        partner_pib: null,
        partner_mb: null,
      });
    }
  }, [quote, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const applyPartnerSnapshot = (partnerId: string) => {
    const p = partners.find((x) => x.id === partnerId);

    // When user changes partner, we want quote's snapshot fields to reflect the new partner
    // (and not keep the previous snapshot).
    setFormData((prev) => ({
      ...prev,
      partner_id: partnerId,
      partner_name: p?.name ?? null,
      partner_address: p?.address ?? null,
      partner_city: p?.city ?? null,
      partner_postal_code: p?.postal_code ?? null,
      partner_pib: p?.pib ?? null,
      partner_mb: p?.mb ?? null,
    }));
  };

  const customerPartners = partners.filter(p => p.is_customer && p.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {quote ? `Uredi ponudu ${quote.quote_number}` : "Nova ponuda"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quote_date">Datum ponude *</Label>
              <LocaleDateInput
                value={formData.quote_date}
                onChange={(value) => setFormData({ ...formData, quote_date: value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valid_until">Važi do</Label>
              <LocaleDateInput
                value={formData.valid_until || ""}
                onChange={(value) => setFormData({ ...formData, valid_until: value || null })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner_id">Kupac *</Label>
            <SearchablePartnerSelect
              partners={customerPartners}
              value={formData.partner_id}
              onValueChange={(value) => applyPartnerSnapshot(value)}
              placeholder="Pretraži i izaberi kupca..."
            />
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
            <Label htmlFor="header_note">Napomena u zaglavlju</Label>
            <Textarea
              id="header_note"
              value={formData.header_note || ""}
              onChange={(e) => setFormData({ ...formData, header_note: e.target.value || null })}
              rows={1}
              placeholder="Kratka napomena koja se prikazuje iznad stavki..."
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Napomena za kupca</Label>
            <Textarea
              id="note"
              value={formData.note || ""}
              onChange={(e) => setFormData({ ...formData, note: e.target.value || null })}
              rows={2}
              placeholder="Napomena koja će se prikazati na ponudi..."
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
              {isLoading ? "Čuvanje..." : quote ? "Sačuvaj" : "Kreiraj"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
