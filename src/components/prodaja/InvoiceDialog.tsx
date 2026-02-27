import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { usePartners } from "@/hooks/usePartners";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Invoice, InvoiceFormData } from "@/hooks/useInvoices";
import { format, addDays } from "date-fns";

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onSave: (data: InvoiceFormData) => void;
  isLoading: boolean;
}

const INITIAL_FORM: InvoiceFormData & Record<string, any> = {
  invoice_date: "",
  due_date: "",
  partner_id: "",
  org_unit_id: null,
  note: null,
  internal_note: null,
  header_note: null,
  composed_by: null,
  partner_name: null,
  partner_address: null,
  partner_city: null,
  partner_postal_code: null,
  partner_pib: null,
  partner_mb: null,
  invoice_type_code: "380",
  currency: "RSD",
  payment_means_code: "30",
  partner_country_code: "RS",
  partner_jbkjs: null,
  billing_reference_number: null,
  billing_reference_date: null,
  contract_reference: null,
  tax_category_code: "S",
  tax_exemption_reason: null,
  mesto_prometa: null,
  datum_prometa: null,
  bank_account_id: null,
};

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
  const { bankAccounts } = useBankAccounts(selectedCompany?.id);

  const [formData, setFormData] = useState({ ...INITIAL_FORM });

  useEffect(() => {
    if (!open) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const defaultBankId = bankAccounts.find((b) => b.is_default && b.is_active)?.id || null;

    if (invoice) {
      setFormData({
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date || "",
        partner_id: invoice.partner_id,
        org_unit_id: invoice.org_unit_id || null,
        note: invoice.note || null,
        internal_note: invoice.internal_note || null,
        header_note: invoice.header_note || null,
        composed_by: invoice.composed_by || null,
        partner_name: invoice.partner_name ?? invoice.partner?.name ?? null,
        partner_address: invoice.partner_address ?? invoice.partner?.address ?? null,
        partner_city: invoice.partner_city ?? invoice.partner?.city ?? null,
        partner_postal_code: invoice.partner_postal_code ?? invoice.partner?.postal_code ?? null,
        partner_pib: invoice.partner_pib ?? invoice.partner?.pib ?? null,
        partner_mb: invoice.partner_mb ?? invoice.partner?.mb ?? null,
        invoice_type_code: invoice.invoice_type_code || "380",
        currency: invoice.currency || "RSD",
        payment_means_code: invoice.payment_means_code || "30",
        partner_country_code: invoice.partner_country_code || "RS",
        partner_jbkjs: invoice.partner_jbkjs || null,
        billing_reference_number: invoice.billing_reference_number || null,
        billing_reference_date: invoice.billing_reference_date || null,
        contract_reference: invoice.contract_reference || null,
        tax_category_code: invoice.tax_category_code || "S",
        tax_exemption_reason: invoice.tax_exemption_reason || null,
        mesto_prometa: invoice.mesto_prometa || null,
        datum_prometa: invoice.datum_prometa || null,
        bank_account_id: invoice.bank_account_id || defaultBankId,
      });
    } else {
      // New invoice defaults
      const loadDefaults = async () => {
        let mestoPrometa = "";
        if (selectedCompany?.id) {
          const { data: co } = await supabase
            .from("companies")
            .select("mesto_prometa")
            .eq("id", selectedCompany.id)
            .single();
          if (co?.mesto_prometa) mestoPrometa = co.mesto_prometa;
        }
        setFormData((prev) => ({ ...prev, mesto_prometa: mestoPrometa || null }));
      };

      setFormData({
        ...INITIAL_FORM,
        invoice_date: today,
        due_date: format(addDays(new Date(), 15), "yyyy-MM-dd"),
        datum_prometa: today,
        bank_account_id: defaultBankId,
      });
      loadDefaults();
    }
  }, [invoice, open, bankAccounts, selectedCompany?.id]);

  const customerPartners = partners.filter((p) => p.is_customer && p.is_active);

  const handlePartnerChange = (partnerId: string) => {
    const p = customerPartners.find((x) => x.id === partnerId);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      due_date: formData.due_date || null,
      org_unit_id: formData.org_unit_id || null,
      tax_exemption_reason: formData.tax_category_code !== "S" ? (formData.tax_exemption_reason || null) : null,
    });
  };

  const set = (key: string, value: any) => setFormData((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {invoice ? `Uredi fakturu ${invoice.invoice_number}` : "Nova faktura"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum fakture *</Label>
              <LocaleDateInput
                value={formData.invoice_date}
                onChange={(v) => set("invoice_date", v)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Datum valute</Label>
              <LocaleDateInput
                value={formData.due_date || ""}
                onChange={(v) => set("due_date", v || null)}
              />
            </div>
          </div>

          {/* Mesto/Datum prometa + Tekući račun */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Mesto prometa</Label>
              <Input
                value={formData.mesto_prometa || ""}
                onChange={(e) => set("mesto_prometa", e.target.value || null)}
                placeholder="Mesto prometa..."
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Datum prometa</Label>
              <LocaleDateInput
                value={formData.datum_prometa || ""}
                onChange={(v) => set("datum_prometa", v || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tekući račun</Label>
              <Select
                value={formData.bank_account_id || "none"}
                onValueChange={(v) => set("bank_account_id", v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="--" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Bez tekućeg računa --</SelectItem>
                  {bankAccounts.filter((b) => b.is_active).map((ba) => (
                    <SelectItem key={ba.id} value={ba.id}>
                      {ba.account_number} ({ba.bank_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Partner + Org Unit */}
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
                onValueChange={(v) => set("org_unit_id", v === "none" ? null : v)}
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

          <Separator />

          {/* eFaktura section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">eFaktura podešavanja</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tip dokumenta</Label>
                <Input
                  value="380 - Faktura"
                  disabled
                  className="h-8 text-sm bg-muted"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valuta</Label>
                <Select value={formData.currency} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSD">RSD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Način plaćanja</Label>
                <Select value={formData.payment_means_code} onValueChange={(v) => set("payment_means_code", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 - Virman</SelectItem>
                    <SelectItem value="10">10 - Gotovina</SelectItem>
                    <SelectItem value="42">42 - Kompenzacija</SelectItem>
                    <SelectItem value="48">48 - Kartica</SelectItem>
                    <SelectItem value="49">49 - Direktno zaduženje</SelectItem>
                    <SelectItem value="ZZZ">ZZZ - Dogovoreno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Država kupca</Label>
                <Input
                  value={formData.partner_country_code || ""}
                  onChange={(e) => set("partner_country_code", e.target.value.toUpperCase())}
                  className="h-8 text-sm"
                  maxLength={2}
                  placeholder="RS"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">JBKJS (za B2G)</Label>
                <Input
                  value={formData.partner_jbkjs || ""}
                  onChange={(e) => set("partner_jbkjs", e.target.value || null)}
                  className="h-8 text-sm"
                  placeholder="Broj JBKJS..."
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ugovor/referenca</Label>
                <Input
                  value={formData.contract_reference || ""}
                  onChange={(e) => set("contract_reference", e.target.value || null)}
                  className="h-8 text-sm"
                  placeholder="Broj ugovora..."
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">PDV kategorija</Label>
                <Select
                  value={formData.tax_category_code || "S"}
                  onValueChange={(v) => set("tax_category_code", v)}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S">S - Standardna stopa</SelectItem>
                    <SelectItem value="E">E - Oslobođeno PDV-a</SelectItem>
                    <SelectItem value="O">O - Van sistema PDV-a</SelectItem>
                    <SelectItem value="AE">AE - Obrnuti obračun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.tax_category_code !== "S" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Osnov oslobođenja</Label>
                  <Input
                    value={formData.tax_exemption_reason || ""}
                    onChange={(e) => set("tax_exemption_reason", e.target.value || null)}
                    className="h-8 text-sm"
                    placeholder="Npr. Član 25. stav 2. tačka 1."
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Napomena u zaglavlju</Label>
              <Textarea
                value={formData.header_note || ""}
                onChange={(e) => set("header_note", e.target.value || null)}
                rows={2}
                placeholder="Kratka napomena iznad stavki..."
              />
            </div>
            <div className="space-y-2">
              <Label>Napomena za kupca</Label>
              <Textarea
                value={formData.note || ""}
                onChange={(e) => set("note", e.target.value || null)}
                rows={2}
                placeholder="Napomena na fakturi..."
              />
            </div>
            <div className="space-y-2">
              <Label>Interna napomena</Label>
              <Textarea
                value={formData.internal_note || ""}
                onChange={(e) => set("internal_note", e.target.value || null)}
                rows={2}
                placeholder="Interna napomena..."
              />
            </div>
          </div>

          {/* Composed by */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fakturu sastavio</Label>
              <Input
                value={formData.composed_by || ""}
                onChange={(e) => set("composed_by", e.target.value || null)}
                autoComplete="off"
              />
            </div>
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
