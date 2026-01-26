import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePartners } from "@/hooks/usePartners";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
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
  const { partners } = usePartners();
  const { units } = useOrganizationalUnits();

  const [formData, setFormData] = useState<QuoteFormData>({
    quote_date: format(new Date(), "yyyy-MM-dd"),
    valid_until: null,
    partner_id: "",
    org_unit_id: null,
    note: null,
    internal_note: null,
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
      });
    } else {
      setFormData({
        quote_date: format(new Date(), "yyyy-MM-dd"),
        valid_until: null,
        partner_id: "",
        org_unit_id: null,
        note: null,
        internal_note: null,
      });
    }
  }, [quote, open]);

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
            {quote ? `Uredi ponudu ${quote.quote_number}` : "Nova ponuda"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quote_date">Datum ponude *</Label>
              <Input
                id="quote_date"
                type="date"
                value={formData.quote_date}
                onChange={(e) => setFormData({ ...formData, quote_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valid_until">Važi do</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until || ""}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value || null })}
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
              placeholder="Napomena koja će se prikazati na ponudi..."
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
