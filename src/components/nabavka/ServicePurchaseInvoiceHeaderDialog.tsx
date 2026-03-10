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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { usePartners, usePartnerBankAccounts } from "@/hooks/usePartners";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useServicePurchaseInvoices,
  ServicePurchaseInvoice,
  ServicePurchaseInvoiceFormData,
} from "@/hooks/useServicePurchaseInvoices";
import { CURRENCIES, isForeignCurrency } from "@/lib/currencies";

interface ServicePurchaseInvoiceHeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: ServicePurchaseInvoice | null;
  onSaved?: (invoice: ServicePurchaseInvoice) => void;
  readOnly?: boolean;
}

export function ServicePurchaseInvoiceHeaderDialog({
  open,
  onOpenChange,
  invoice,
  onSaved,
  readOnly = false,
}: ServicePurchaseInvoiceHeaderDialogProps) {
  const { selectedCompany } = useAuth();
  const { partners } = usePartners();
  const { createInvoice, updateInvoice } = useServicePurchaseInvoices();

  const [formData, setFormData] = useState<ServicePurchaseInvoiceFormData>({
    supplier_invoice_number: "",
    invoice_date: new Date().toISOString().split("T")[0],
    receipt_date: new Date().toISOString().split("T")[0],
    due_date: null,
    partner_id: "",
    supplier_name: null,
    supplier_address: null,
    supplier_city: null,
    supplier_postal_code: null,
    supplier_pib: null,
    supplier_mb: null,
    supplier_is_in_pdv: true,
    supplier_bank_account: null,
    payment_reference: null,
    vat_calculation_type: "standard",
    has_internal_vat_calculation: false,
    note: null,
    internal_note: null,
    currency: "RSD",
    exchange_rate: 1,
  });

  const [exchangeRateText, setExchangeRateText] = useState("1");

  const { bankAccounts } = usePartnerBankAccounts(formData.partner_id || null);

  useEffect(() => {
    if (invoice) {
      setFormData({
        supplier_invoice_number: invoice.supplier_invoice_number,
        invoice_date: invoice.invoice_date,
        receipt_date: invoice.receipt_date,
        due_date: invoice.due_date,
        partner_id: invoice.partner_id,
        supplier_name: invoice.supplier_name,
        supplier_address: invoice.supplier_address,
        supplier_city: invoice.supplier_city,
        supplier_postal_code: invoice.supplier_postal_code,
        supplier_pib: invoice.supplier_pib,
        supplier_mb: invoice.supplier_mb,
        supplier_is_in_pdv: invoice.supplier_is_in_pdv,
        supplier_bank_account: invoice.supplier_bank_account,
        payment_reference: invoice.payment_reference,
        vat_calculation_type: invoice.vat_calculation_type,
        has_internal_vat_calculation: invoice.has_internal_vat_calculation,
        note: invoice.note,
        internal_note: invoice.internal_note,
        currency: invoice.currency || "RSD",
        exchange_rate: invoice.exchange_rate || 1,
      });
      setExchangeRateText(String(invoice.exchange_rate || 1));
    } else {
      setFormData({
        supplier_invoice_number: "",
        invoice_date: new Date().toISOString().split("T")[0],
        receipt_date: new Date().toISOString().split("T")[0],
        due_date: null,
        partner_id: "",
        supplier_name: null,
        supplier_address: null,
        supplier_city: null,
        supplier_postal_code: null,
        supplier_pib: null,
        supplier_mb: null,
        supplier_is_in_pdv: true,
        supplier_bank_account: null,
        payment_reference: null,
        vat_calculation_type: "standard",
        has_internal_vat_calculation: false,
        note: null,
        internal_note: null,
        currency: "RSD",
        exchange_rate: 1,
      });
      setExchangeRateText("1");
    }
  }, [invoice, open]);

  const handlePartnerChange = async (newPartnerId: string) => {
    const partner = partners.find((p) => p.id === newPartnerId);
    if (!partner) return;

    const { data: accounts } = await supabase
      .from("partner_bank_accounts")
      .select("account_number")
      .eq("partner_id", newPartnerId)
      .order("sort_order")
      .limit(1);

    const defaultAccount = accounts?.[0]?.account_number || null;

    setFormData((prev) => ({
      ...prev,
      partner_id: newPartnerId,
      supplier_name: partner.name,
      supplier_address: partner.address,
      supplier_city: partner.city,
      supplier_postal_code: partner.postal_code,
      supplier_pib: partner.pib,
      supplier_mb: partner.mb,
      supplier_is_in_pdv: partner.is_in_pdv,
      supplier_bank_account: defaultAccount,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (invoice) {
      const updated = await updateInvoice.mutateAsync({ id: invoice.id, ...formData });
      onOpenChange(false);
    } else {
      const created = await createInvoice.mutateAsync(formData);
      onOpenChange(false);
      if (onSaved && created) {
        onSaved(created);
      }
    }
  };

  const supplierPartners = partners.filter((p) => p.is_supplier && p.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {readOnly
              ? `Zaglavlje: ${invoice?.internal_number || ""}`
              : invoice
              ? `Uredi zaglavlje: ${invoice.internal_number}`
              : "Nova ulazna faktura za usluge"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={readOnly} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_invoice_number">Broj fakture dobavljača *</Label>
              <Input
                id="supplier_invoice_number"
                value={formData.supplier_invoice_number}
                onChange={(e) =>
                  setFormData({ ...formData, supplier_invoice_number: e.target.value })
                }
                required
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_date">Datum fakture *</Label>
              <LocaleDateInput
                value={formData.invoice_date}
                onChange={(value) => setFormData({ ...formData, invoice_date: value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt_date">Datum prijema *</Label>
              <LocaleDateInput
                value={formData.receipt_date}
                onChange={(value) => setFormData({ ...formData, receipt_date: value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Datum valute</Label>
              <LocaleDateInput
                value={formData.due_date || ""}
                onChange={(value) =>
                  setFormData({ ...formData, due_date: value || null })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dobavljač *</Label>
            <SearchablePartnerSelect
              partners={supplierPartners}
              value={formData.partner_id}
              onValueChange={handlePartnerChange}
              placeholder="Pretraži i izaberi dobavljača..."
            />
          </div>

          {/* Snapshot podaci dobavljača */}
          <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">PIB</Label>
              <Input
                value={formData.supplier_pib || ""}
                onChange={(e) => setFormData({ ...formData, supplier_pib: e.target.value || null })}
                className="h-8 text-sm"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Matični broj</Label>
              <Input
                value={formData.supplier_mb || ""}
                onChange={(e) => setFormData({ ...formData, supplier_mb: e.target.value || null })}
                className="h-8 text-sm"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1 flex items-end">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="supplier_is_in_pdv"
                  checked={formData.supplier_is_in_pdv}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, supplier_is_in_pdv: checked as boolean })
                  }
                />
                <Label htmlFor="supplier_is_in_pdv" className="text-sm">
                  U sistemu PDV-a
                </Label>
              </div>
            </div>
          </div>

          {/* Valuta */}
          <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg">
            <div className="space-y-2">
              <Label>Valuta fakture</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => {
                  const isRsd = value === "RSD";
                  setFormData({ ...formData, currency: value, exchange_rate: isRsd ? 1 : formData.exchange_rate });
                  if (isRsd) setExchangeRateText("1");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isForeignCurrency(formData.currency) && (
              <div className="space-y-2">
                <Label>Kurs (srednji NBS)</Label>
                <LocaleNumberInput
                  value={exchangeRateText}
                  onChange={setExchangeRateText}
                  onBlur={() => {
                    const parsed = parseFloat(exchangeRateText.replace(",", ".")) || 1;
                    setFormData({ ...formData, exchange_rate: parsed });
                  }}
                  className="h-10"
                  allowEmpty
                />
                <p className="text-xs text-muted-foreground">
                  1 {formData.currency} = {exchangeRateText} RSD
                </p>
              </div>
            )}
          </div>

          {/* PDV opcije */}
          <div className="flex flex-wrap gap-6 p-3 border rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="vat_no_calc_8v2"
                checked={formData.vat_calculation_type === "no_vat_8v2"}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, vat_calculation_type: checked ? "no_vat_8v2" : "standard" })
                }
              />
              <Label htmlFor="vat_no_calc_8v2" className="text-sm">
                Bez obračuna PDV (8v.2)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has_internal_vat_calculation"
                checked={formData.has_internal_vat_calculation}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, has_internal_vat_calculation: checked as boolean })
                }
              />
              <Label htmlFor="has_internal_vat_calculation" className="text-sm">
                Interni obračun PDV-a
              </Label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_bank_account">Tekući račun dobavljača</Label>
              <div className="relative">
                <Input
                  id="supplier_bank_account"
                  list="bank-accounts-list"
                  value={formData.supplier_bank_account || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      supplier_bank_account: e.target.value || null,
                    })
                  }
                  placeholder="Unesite ili izaberite tekući račun"
                  autoComplete="off"
                />
                <datalist id="bank-accounts-list">
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.account_number} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_reference">Poziv na broj prilikom uplate</Label>
              <Input
                id="payment_reference"
                value={formData.payment_reference || ""}
                onChange={(e) =>
                  setFormData({ ...formData, payment_reference: e.target.value || null })
                }
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="note">Napomena</Label>
              <Textarea
                id="note"
                value={formData.note || ""}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value || null })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal_note">Interna napomena</Label>
              <Textarea
                id="internal_note"
                value={formData.internal_note || ""}
                onChange={(e) =>
                  setFormData({ ...formData, internal_note: e.target.value || null })
                }
                rows={2}
              />
            </div>
          </div>

          </fieldset>

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
                  disabled={
                    !formData.partner_id ||
                    !formData.supplier_invoice_number ||
                    createInvoice.isPending ||
                    updateInvoice.isPending
                  }
                >
                  {createInvoice.isPending || updateInvoice.isPending
                    ? "Čuvanje..."
                    : invoice
                    ? "Sačuvaj"
                    : "Kreiraj"}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
