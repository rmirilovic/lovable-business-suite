import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { usePartners, usePartnerBankAccounts } from "@/hooks/usePartners";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { supabase } from "@/integrations/supabase/client";
import { useReceivedCreditNotes, ReceivedCreditNote, ReceivedCreditNoteFormData } from "@/hooks/useReceivedCreditNotes";
import { CURRENCIES, isForeignCurrency } from "@/lib/currencies";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: ReceivedCreditNote | null;
  onSaved?: (doc: ReceivedCreditNote) => void;
  readOnly?: boolean;
}

const defaultForm = (): ReceivedCreditNoteFormData => ({
  supplier_document_number: "",
  document_date: new Date().toISOString().split("T")[0],
  receipt_date: new Date().toISOString().split("T")[0],
  due_date: null,
  partner_id: "",
  supplier_name: null, supplier_address: null, supplier_city: null,
  supplier_postal_code: null, supplier_pib: null, supplier_mb: null,
  supplier_is_in_pdv: true, supplier_bank_account: null, payment_reference: null,
  has_internal_vat_calculation: false,
  note: null, internal_note: null,
  currency: "RSD", exchange_rate: 1,
});

export function ReceivedCreditNoteHeaderDialog({ open, onOpenChange, doc, onSaved, readOnly = false }: Props) {
  const { partners } = usePartners();
  const { minDate, maxDate } = useBusinessYearDateLimits();
  const { createDoc, updateDoc } = useReceivedCreditNotes();
  const [formData, setFormData] = useState<ReceivedCreditNoteFormData>(defaultForm());
  const [exchangeRateText, setExchangeRateText] = useState("1");
  const { bankAccounts } = usePartnerBankAccounts(formData.partner_id || null);

  useEffect(() => {
    if (doc) {
      setFormData({
        supplier_document_number: doc.supplier_document_number,
        document_date: doc.document_date, receipt_date: doc.receipt_date,
        due_date: doc.due_date, partner_id: doc.partner_id,
        supplier_name: doc.supplier_name, supplier_address: doc.supplier_address,
        supplier_city: doc.supplier_city, supplier_postal_code: doc.supplier_postal_code,
        supplier_pib: doc.supplier_pib, supplier_mb: doc.supplier_mb,
        supplier_is_in_pdv: doc.supplier_is_in_pdv,
        supplier_bank_account: doc.supplier_bank_account,
        payment_reference: doc.payment_reference,
        has_internal_vat_calculation: doc.has_internal_vat_calculation,
        note: doc.note, internal_note: doc.internal_note,
        currency: doc.currency || "RSD", exchange_rate: doc.exchange_rate || 1,
      });
      setExchangeRateText(String(doc.exchange_rate || 1));
    } else {
      setFormData(defaultForm());
      setExchangeRateText("1");
    }
  }, [doc, open]);

  const handlePartnerChange = async (newPartnerId: string) => {
    const partner = partners.find((p) => p.id === newPartnerId);
    if (!partner) return;
    const { data: accounts } = await supabase.from("partner_bank_accounts").select("account_number").eq("partner_id", newPartnerId).order("sort_order").limit(1);
    setFormData((prev) => ({
      ...prev, partner_id: newPartnerId, supplier_name: partner.name,
      supplier_address: partner.address, supplier_city: partner.city,
      supplier_postal_code: partner.postal_code, supplier_pib: partner.pib,
      supplier_mb: partner.mb, supplier_is_in_pdv: partner.is_in_pdv,
      supplier_bank_account: accounts?.[0]?.account_number || null,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (doc) {
      await updateDoc.mutateAsync({ id: doc.id, ...formData });
      onOpenChange(false);
    } else {
      const created = await createDoc.mutateAsync(formData);
      onOpenChange(false);
      if (onSaved && created) onSaved(created);
    }
  };

  const supplierPartners = partners.filter((p) => p.is_supplier && p.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {readOnly ? `Zaglavlje: ${doc?.internal_number || ""}` : doc ? `Uredi zaglavlje: ${doc.internal_number}` : "Novo primljeno knjižno odobrenje"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={readOnly} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Broj dokumenta dobavljača *</Label>
                <Input value={formData.supplier_document_number} onChange={(e) => setFormData({ ...formData, supplier_document_number: e.target.value })} required autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label>Datum dokumenta *</Label>
                <LocaleDateInput value={formData.document_date} onChange={(v) => setFormData({ ...formData, document_date: v })} />
              </div>
              <div className="space-y-2">
                <Label>Datum prijema *</Label>
                <LocaleDateInput value={formData.receipt_date} onChange={(v) => setFormData({ ...formData, receipt_date: v })} />
              </div>
              <div className="space-y-2">
                <Label>Datum valute</Label>
                <LocaleDateInput value={formData.due_date || ""} onChange={(v) => setFormData({ ...formData, due_date: v || null })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dobavljač *</Label>
              <SearchablePartnerSelect partners={supplierPartners} value={formData.partner_id} onValueChange={handlePartnerChange} placeholder="Pretraži i izaberi dobavljača..." />
            </div>

            <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">PIB</Label>
                <Input value={formData.supplier_pib || ""} onChange={(e) => setFormData({ ...formData, supplier_pib: e.target.value || null })} className="h-8 text-sm" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Matični broj</Label>
                <Input value={formData.supplier_mb || ""} onChange={(e) => setFormData({ ...formData, supplier_mb: e.target.value || null })} className="h-8 text-sm" autoComplete="off" />
              </div>
              <div className="space-y-1 flex items-end">
                <div className="flex items-center space-x-2">
                  <Checkbox id="rcn_supplier_pdv" checked={formData.supplier_is_in_pdv} onCheckedChange={(c) => setFormData({ ...formData, supplier_is_in_pdv: c as boolean })} />
                  <Label htmlFor="rcn_supplier_pdv" className="text-sm">U sistemu PDV-a</Label>
                </div>
              </div>
            </div>

            {/* Currency */}
            <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg">
              <div className="space-y-2">
                <Label>Valuta</Label>
                <Select value={formData.currency} onValueChange={(v) => { setFormData({ ...formData, currency: v, exchange_rate: v === "RSD" ? 1 : formData.exchange_rate }); if (v === "RSD") setExchangeRateText("1"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {isForeignCurrency(formData.currency) && (
                <div className="space-y-2">
                  <Label>Kurs (srednji NBS)</Label>
                  <LocaleNumberInput value={exchangeRateText} onChange={setExchangeRateText} onBlur={() => setFormData({ ...formData, exchange_rate: parseFloat(exchangeRateText.replace(",", ".")) || 1 })} className="h-10" allowEmpty />
                  <p className="text-xs text-muted-foreground">1 {formData.currency} = {exchangeRateText} RSD</p>
                </div>
              )}
            </div>

            {/* Internal VAT calculation */}
            <div className="p-3 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox id="rcn_internal_vat" checked={formData.has_internal_vat_calculation} onCheckedChange={(c) => setFormData({ ...formData, has_internal_vat_calculation: c as boolean })} />
                <Label htmlFor="rcn_internal_vat" className="text-sm">Interni obračun PDV-a</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tekući račun dobavljača</Label>
                <Input list="rcn-bank-accounts" value={formData.supplier_bank_account || ""} onChange={(e) => setFormData({ ...formData, supplier_bank_account: e.target.value || null })} placeholder="Unesite ili izaberite" autoComplete="off" />
                <datalist id="rcn-bank-accounts">{bankAccounts.map((a) => <option key={a.id} value={a.account_number} />)}</datalist>
              </div>
              <div className="space-y-2">
                <Label>Poziv na broj</Label>
                <Input value={formData.payment_reference || ""} onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value || null })} autoComplete="off" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Napomena</Label>
                <Textarea value={formData.note || ""} onChange={(e) => setFormData({ ...formData, note: e.target.value || null })} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Interna napomena</Label>
                <Textarea value={formData.internal_note || ""} onChange={(e) => setFormData({ ...formData, internal_note: e.target.value || null })} rows={2} />
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 pt-4">
            {readOnly ? (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Zatvori</Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Otkaži</Button>
                <Button type="submit" disabled={!formData.partner_id || !formData.supplier_document_number || createDoc.isPending || updateDoc.isPending}>
                  {createDoc.isPending || updateDoc.isPending ? "Čuvanje..." : doc ? "Sačuvaj" : "Kreiraj"}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
