import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { useAuth } from "@/contexts/AuthContext";
import { usePartners } from "@/hooks/usePartners";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { AdvanceInvoice } from "@/hooks/useAdvanceInvoices";

interface AdvanceInvoiceHeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: AdvanceInvoice;
  onSave: (data: any) => void;
  isLoading?: boolean;
  readOnly?: boolean;
}

export function AdvanceInvoiceHeaderDialog({
  open,
  onOpenChange,
  doc,
  onSave,
  isLoading,
  readOnly,
}: AdvanceInvoiceHeaderDialogProps) {
  const { selectedCompany } = useAuth();
  const { partners } = usePartners();
  const { units } = useOrganizationalUnits(selectedCompany?.id);
  const { bankAccounts } = useBankAccounts(selectedCompany?.id);
  const customerPartners = partners.filter((p) => p.is_customer && p.is_active);

  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!open || !doc) return;
    setFormData({
      advance_date: doc.advance_date,
      due_date: doc.due_date || "",
      partner_id: doc.partner_id,
      org_unit_id: doc.org_unit_id || null,
      note: doc.note || "",
      internal_note: doc.internal_note || "",
      header_note: doc.header_note || "",
      composed_by: doc.composed_by || "",
      currency: doc.currency || "RSD",
      payment_means_code: doc.payment_means_code || "30",
      partner_country_code: doc.partner_country_code || "RS",
      partner_jbkjs: doc.partner_jbkjs || "",
      contract_reference: doc.contract_reference || "",
      partner_name: doc.partner_name ?? doc.partner?.name ?? "",
      partner_address: doc.partner_address ?? doc.partner?.address ?? "",
      partner_city: doc.partner_city ?? doc.partner?.city ?? "",
      partner_postal_code: doc.partner_postal_code ?? doc.partner?.postal_code ?? "",
      partner_pib: doc.partner_pib ?? doc.partner?.pib ?? "",
      partner_mb: doc.partner_mb ?? doc.partner?.mb ?? "",
      payment_date: doc.payment_date || "",
      payment_amount: doc.payment_amount || 0,
      payment_reference: doc.payment_reference || "",
      bank_account_id: (doc as any).bank_account_id || null,
      tax_category_code: (doc as any).tax_category_code || "S",
      tax_exemption_reason: (doc as any).tax_exemption_reason || "",
    });
  }, [open, doc]);

  const set = (key: string, value: any) => setFormData((prev) => ({ ...prev, [key]: value }));

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      due_date: formData.due_date || null,
      org_unit_id: formData.org_unit_id || null,
      note: formData.note || null,
      internal_note: formData.internal_note || null,
      header_note: formData.header_note || null,
      composed_by: formData.composed_by || null,
      partner_jbkjs: formData.partner_jbkjs || null,
      contract_reference: formData.contract_reference || null,
      partner_name: formData.partner_name || null,
      partner_address: formData.partner_address || null,
      partner_city: formData.partner_city || null,
      partner_postal_code: formData.partner_postal_code || null,
      partner_pib: formData.partner_pib || null,
      partner_mb: formData.partner_mb || null,
      payment_date: formData.payment_date || null,
      payment_amount: formData.payment_amount || 0,
      payment_reference: formData.payment_reference || null,
      bank_account_id: formData.bank_account_id || null,
      tax_category_code: formData.tax_category_code || "S",
      tax_exemption_reason: formData.tax_category_code !== "S" ? (formData.tax_exemption_reason || null) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{readOnly ? "Zaglavlje fakture za avans" : "Uredi zaglavlje"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum fakture *</Label>
              <LocaleDateInput value={formData.advance_date || ""} onChange={(v) => set("advance_date", v)} required disabled={readOnly} />
            </div>
            <div className="space-y-2">
              <Label>Datum valute</Label>
              <LocaleDateInput value={formData.due_date || ""} onChange={(v) => set("due_date", v || null)} disabled={readOnly} />
            </div>
          </div>

          {/* Partner + Org Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kupac *</Label>
              <SearchablePartnerSelect partners={customerPartners} value={formData.partner_id || ""} onValueChange={handlePartnerChange} placeholder="Pretraži i izaberi kupca..." disabled={readOnly} />
            </div>
            <div className="space-y-2">
              <Label>Organizaciona jedinica</Label>
              <Select value={formData.org_unit_id || "none"} onValueChange={(v) => set("org_unit_id", v === "none" ? null : v)} disabled={readOnly}>
                <SelectTrigger><SelectValue placeholder="--" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Bez org. jedinice --</SelectItem>
                  {units.filter((u) => u.is_active).map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.code} - {unit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Payment data */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Podaci o uplati</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Datum uplate</Label>
                <LocaleDateInput value={formData.payment_date || ""} onChange={(v) => set("payment_date", v || null)} disabled={readOnly} />
              </div>
              <div className="space-y-2">
                <Label>Iznos uplate</Label>
                <LocaleNumberInput value={String(formData.payment_amount || 0)} onChange={(v) => set("payment_amount", Number(v))} disabled={readOnly} />
              </div>
              <div className="space-y-2">
                <Label>Poziv na broj</Label>
                <Input value={formData.payment_reference || ""} onChange={(e) => set("payment_reference", e.target.value || null)} placeholder="Poziv na broj uplate..." disabled={readOnly} autoComplete="off" />
              </div>
            </div>
          </div>

          <Separator />

          {/* eFaktura section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">eFaktura podešavanja</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tip dokumenta</Label>
                <Input value="386 - Faktura za avans" disabled className="h-8 text-sm bg-muted" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valuta</Label>
                <Select value={formData.currency || "RSD"} onValueChange={(v) => set("currency", v)} disabled={readOnly}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSD">RSD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Način plaćanja</Label>
                <Select value={formData.payment_means_code || "30"} onValueChange={(v) => set("payment_means_code", v)} disabled={readOnly}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 - Virman</SelectItem>
                    <SelectItem value="10">10 - Gotovina</SelectItem>
                    <SelectItem value="42">42 - Kompenzacija</SelectItem>
                    <SelectItem value="48">48 - Kartica</SelectItem>
                    <SelectItem value="ZZZ">ZZZ - Dogovoreno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Država kupca</Label>
                <Input value={formData.partner_country_code || ""} onChange={(e) => set("partner_country_code", e.target.value.toUpperCase())} className="h-8 text-sm" maxLength={2} disabled={readOnly} autoComplete="off" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">JBKJS (za B2G)</Label>
                <Input value={formData.partner_jbkjs || ""} onChange={(e) => set("partner_jbkjs", e.target.value || null)} className="h-8 text-sm" placeholder="Broj JBKJS..." disabled={readOnly} autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ugovor/referenca</Label>
                <Input value={formData.contract_reference || ""} onChange={(e) => set("contract_reference", e.target.value || null)} className="h-8 text-sm" placeholder="Broj ugovora..." disabled={readOnly} autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tekući račun</Label>
                <Select value={formData.bank_account_id || "none"} onValueChange={(v) => set("bank_account_id", v === "none" ? null : v)} disabled={readOnly}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="--" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Bez tekućeg računa --</SelectItem>
                    {bankAccounts.filter((b) => b.is_active).map((ba) => (
                      <SelectItem key={ba.id} value={ba.id}>{ba.account_number} ({ba.bank_name})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">PDV kategorija</Label>
                <Select value={formData.tax_category_code || "S"} onValueChange={(v) => set("tax_category_code", v)} disabled={readOnly}>
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
                  <Input value={formData.tax_exemption_reason || ""} onChange={(e) => set("tax_exemption_reason", e.target.value || null)} className="h-8 text-sm" placeholder="Npr. Član 25. stav 2. tačka 1." disabled={readOnly} autoComplete="off" />
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Napomena u zaglavlju</Label>
              <Textarea value={formData.header_note || ""} onChange={(e) => set("header_note", e.target.value || null)} rows={2} disabled={readOnly} />
            </div>
            <div className="space-y-2">
              <Label>Napomena za kupca</Label>
              <Textarea value={formData.note || ""} onChange={(e) => set("note", e.target.value || null)} rows={2} disabled={readOnly} />
            </div>
            <div className="space-y-2">
              <Label>Interna napomena</Label>
              <Textarea value={formData.internal_note || ""} onChange={(e) => set("internal_note", e.target.value || null)} rows={2} disabled={readOnly} />
            </div>
          </div>

          {/* Composed by */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fakturu sastavio</Label>
              <Input value={formData.composed_by || ""} onChange={(e) => set("composed_by", e.target.value || null)} disabled={readOnly} autoComplete="off" />
            </div>
          </div>

          <DialogFooter>
            {readOnly ? (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Zatvori</Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Otkaži</Button>
                <Button type="submit" disabled={isLoading || !formData.partner_id}>
                  {isLoading ? "Čuvanje..." : "Sačuvaj"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
