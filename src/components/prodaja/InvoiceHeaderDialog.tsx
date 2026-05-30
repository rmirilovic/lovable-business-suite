import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { Invoice } from "@/hooks/useInvoices";
import { useInvoiceMutations } from "@/hooks/useInvoiceMutations";
import { Eye, Info, RefreshCw } from "lucide-react";
import { formatPrice } from "@/lib/formatting";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { parseLocaleNumber } from "@/lib/formatting";
import { isForeignCurrency } from "@/lib/currencies";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type DeliveryNoteItemRow = Database["public"]["Tables"]["delivery_note_items"]["Row"] & {
  article: {
    id: string;
    code: string | null;
    name: string;
    unit: string | null;
    selling_price: number | null;
    vat_rate: number | null;
  } | null;
};

type InvoiceInsertRow = Database["public"]["Tables"]["invoice_items"]["Insert"];

type GroupedInvoiceItem = {
  invoice_id: string;
  company_id: string;
  article_id: string | null;
  item_code: string | null;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  vat_rate: number;
  description: string | null;
};

type NbsRateResponse = {
  currencyCode: string;
  middleRate: number | string;
  unit: number | string;
};

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
  const queryClient = useQueryClient();
  const { minDate, maxDate } = useBusinessYearDateLimits();
  const { partners } = usePartners();
  const { units } = useOrganizationalUnits(selectedCompany?.id);
  const { bankAccounts } = useBankAccounts(selectedCompany?.id);
  const { updateInvoice } = useInvoiceMutations();

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
    // eFaktura fields
    invoice_type_code: "380",
    currency: "RSD",
    payment_means_code: "30",
    partner_country_code: "RS",
    partner_jbkjs: "" as string | null,
    billing_reference_number: "" as string | null,
    billing_reference_date: "" as string | null,
    contract_reference: "" as string | null,
    tax_category_code: "S",
    tax_exemption_reason: "" as string | null,
    mesto_prometa: "" as string | null,
    datum_prometa: "" as string | null,
    bank_account_id: "" as string | null,
    advance_invoice_id: "" as string | null,
    // Ino izlazne fakture
    exchange_rate: 1,
    jci_number: "" as string | null,
    jci_date: "" as string | null,
    delivery_terms: "" as string | null,
    source_delivery_note_id: "" as string | null,
  });

  const [exchangeRateText, setExchangeRateText] = useState("1");
  const [loadingNbsRate, setLoadingNbsRate] = useState(false);

  // Advance invoices for selected partner
  interface AvailableAdvance {
    id: string;
    advance_number: string;
    total_amount: number;
    vat_amount: number;
    advance_date: string;
  }
  const [availableAdvances, setAvailableAdvances] = useState<AvailableAdvance[]>([]);

  interface AvailableDeliveryNote {
    id: string;
    delivery_number: string;
    delivery_date: string;
  }
  const [availableDeliveryNotes, setAvailableDeliveryNotes] = useState<AvailableDeliveryNote[]>([]);

  useEffect(() => {
    if (!invoice || !open) return;
    
    const defaultBankId = bankAccounts.find((b) => b.is_default && b.is_active)?.id || "";
    
    // Fetch company mesto_prometa for default
    const loadDefaults = async () => {
      let mestoPrometa = invoice.mesto_prometa || "";
      if (!mestoPrometa && selectedCompany?.id) {
        const { data: co } = await supabase
          .from("companies")
          .select("mesto_prometa")
          .eq("id", selectedCompany.id)
          .single();
        if (co?.mesto_prometa) mestoPrometa = co.mesto_prometa;
      }
      
      setFormData((prev) => ({ ...prev, mesto_prometa: mestoPrometa }));
    };

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
      invoice_type_code: invoice.invoice_type_code || "380",
      currency: invoice.currency || "RSD",
      payment_means_code: invoice.payment_means_code || "30",
      partner_country_code: invoice.partner_country_code || "RS",
      partner_jbkjs: invoice.partner_jbkjs || "",
      billing_reference_number: invoice.billing_reference_number || "",
      billing_reference_date: invoice.billing_reference_date || "",
      contract_reference: invoice.contract_reference || "",
      tax_category_code: invoice.tax_category_code || "S",
      tax_exemption_reason: invoice.tax_exemption_reason || "",
      mesto_prometa: invoice.mesto_prometa || "",
      datum_prometa: invoice.datum_prometa || "",
      bank_account_id: invoice.bank_account_id || defaultBankId,
      advance_invoice_id: invoice.advance_invoice_id || "",
      exchange_rate: invoice.exchange_rate || 1,
      jci_number: invoice.jci_number || "",
      jci_date: invoice.jci_date || "",
      delivery_terms: invoice.delivery_terms || "",
      source_delivery_note_id: invoice.source_delivery_note_id || "",
    });
    setExchangeRateText(String(invoice.exchange_rate || 1));

    // Fetch available advances for the partner
    fetchAdvancesForPartner(invoice.partner_id);
    fetchDeliveryNotesForPartner(invoice.partner_id, invoice.source_delivery_note_id);

    loadDefaults();
  }, [invoice, open, bankAccounts, selectedCompany?.id]);

  const fetchDeliveryNotesForPartner = async (partnerId: string, currentDeliveryNoteId?: string | null) => {
    if (!partnerId || !selectedCompany?.id) {
      setAvailableDeliveryNotes([]);
      return;
    }
    const { data } = await supabase
      .from("delivery_notes")
      .select("id, delivery_number, delivery_date")
      .eq("company_id", selectedCompany.id)
      .eq("partner_id", partnerId)
      .neq("status", "cancelled")
      .order("delivery_date", { ascending: false });

    const deliveryNotes = data ? [...data] : [];

    if (currentDeliveryNoteId && !deliveryNotes.some((d) => d.id === currentDeliveryNoteId)) {
      const { data: currentDn } = await supabase
        .from("delivery_notes")
        .select("id, delivery_number, delivery_date")
        .eq("id", currentDeliveryNoteId)
        .maybeSingle();

      if (currentDn) {
        deliveryNotes.unshift(currentDn);
      }
    }

    if (deliveryNotes.length === 0) {
      setAvailableDeliveryNotes([]);
      return;
    }

    // Filter out delivery notes already linked to other invoices
    const { data: usedDns } = await supabase
      .from("invoices")
      .select("source_delivery_note_id")
      .eq("company_id", selectedCompany.id)
      .not("source_delivery_note_id", "is", null)
      .neq("id", invoice?.id || "00000000-0000-0000-0000-000000000000");

    const usedIds = new Set((usedDns || []).map((u) => u.source_delivery_note_id));
    const activeDeliveryNoteId = currentDeliveryNoteId ?? invoice?.source_delivery_note_id ?? null;
    const available = deliveryNotes.filter((d) => !usedIds.has(d.id) || d.id === activeDeliveryNoteId);
    setAvailableDeliveryNotes(available);
  };

  const fetchAdvancesForPartner = async (partnerId: string) => {
    if (!partnerId || !selectedCompany?.id) {
      setAvailableAdvances([]);
      return;
    }
    // Get posted advance invoices for this partner that are not already used by another invoice
    const { data } = await supabase
      .from("advance_invoices")
      .select("id, advance_number, total_amount, vat_amount, advance_date")
      .eq("company_id", selectedCompany.id)
      .eq("partner_id", partnerId)
      .eq("status", "posted")
      .order("advance_date", { ascending: false });

    if (!data) { setAvailableAdvances([]); return; }

    // Filter out advances already used by other invoices (not this one)
    const { data: usedAdvances } = await supabase
      .from("invoices")
      .select("advance_invoice_id")
      .eq("company_id", selectedCompany.id)
      .not("advance_invoice_id", "is", null)
      .neq("id", invoice?.id || "00000000-0000-0000-0000-000000000000");

    const usedIds = new Set((usedAdvances || []).map((u) => u.advance_invoice_id));
    const available = data.filter((a) => !usedIds.has(a.id) || a.id === invoice?.advance_invoice_id);
    setAvailableAdvances(available);
  };

  const handlePartnerChange = (partnerId: string) => {
    const p = customerPartners.find((x) => x.id === partnerId);
    const isIno = p?.legal_status === 4;
    const currency = isIno ? (p?.default_currency || "EUR") : "RSD";
    const countryCode = (p?.country_code || (isIno ? "" : "RS")).toUpperCase();

    setFormData((prev) => ({
      ...prev,
      partner_id: partnerId,
      partner_name: p?.name ?? "",
      partner_address: p?.address ?? "",
      partner_city: p?.city ?? "",
      partner_postal_code: p?.postal_code ?? "",
      partner_pib: p?.pib ?? "",
      partner_mb: p?.mb ?? "",
      advance_invoice_id: "", // Reset advance when partner changes
      // Ino partner — automatska podešavanja za izvoznu fakturu
      currency,
      partner_country_code: countryCode || prev.partner_country_code,
      payment_means_code: isIno ? "42" : prev.payment_means_code,
      tax_category_code: isIno ? "E" : prev.tax_category_code,
      tax_exemption_reason: isIno
        ? (prev.tax_exemption_reason || "Član 24. stav 1. tačka 2) ZPDV — izvoz dobara")
        : prev.tax_exemption_reason,
      exchange_rate: currency === "RSD" ? 1 : prev.exchange_rate,
    }));
    if (currency === "RSD") setExchangeRateText("1");
    fetchAdvancesForPartner(partnerId);
    fetchDeliveryNotesForPartner(partnerId, null);
    setFormData((prev) => ({ ...prev, source_delivery_note_id: "" }));
  };

  const loadNbsRate = async () => {
    const dateToUse = formData.datum_prometa || formData.invoice_date;
    if (!dateToUse) {
      toast.error("Unesite datum prometa ili datum fakture");
      return;
    }
    if (formData.currency === "RSD") return;
    setLoadingNbsRate(true);
    try {
      const { data, error } = await supabase.functions.invoke("nbs-exchange-rates", {
        body: { date: dateToUse },
      });
      if (error || !data?.success) {
        toast.error(data?.error || "Greška pri preuzimanju kursne liste");
        return;
      }
      const rate = ((data.rates || []) as NbsRateResponse[]).find((r) => r.currencyCode === formData.currency);
      if (!rate || !rate.middleRate || !rate.unit) {
        toast.error(`NBS nije vratio srednji kurs za ${formData.currency}`);
        return;
      }
      // Srednji kurs za jedinicu (npr. 100 JPY = ...). Računamo kurs za 1 jedinicu.
      const ratePerUnit = Number(rate.middleRate) / Number(rate.unit);
      const rounded = +ratePerUnit.toFixed(6);
      setExchangeRateText(rounded.toLocaleString("sr-Latn-RS", { minimumFractionDigits: 4, maximumFractionDigits: 6 }));
      setFormData((prev) => ({ ...prev, exchange_rate: rounded }));
      toast.success(`Kurs ${formData.currency}: ${rounded.toFixed(4)} (NBS srednji, ${data.listDate || dateToUse})`);
    } catch {
      toast.error("Greška pri pozivanju NBS servisa");
    } finally {
      setLoadingNbsRate(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || readOnly) return;

    const rate = formData.currency === "RSD" ? 1 : (formData.exchange_rate || 1);

    await updateInvoice.mutateAsync({
      id: invoice.id,
      invoice_date: formData.invoice_date,
      due_date: formData.due_date || null,
      partner_id: formData.partner_id,
      org_unit_id: formData.org_unit_id || null,
      note: formData.note || null,
      internal_note: formData.internal_note || null,
      header_note: formData.header_note || null,
      composed_by: formData.composed_by || null,
      partner_name: formData.partner_name || null,
      partner_address: formData.partner_address || null,
      partner_city: formData.partner_city || null,
      partner_postal_code: formData.partner_postal_code || null,
      partner_pib: formData.partner_pib || null,
      partner_mb: formData.partner_mb || null,
      // eFaktura fields
      invoice_type_code: formData.invoice_type_code,
      currency: formData.currency,
      payment_means_code: formData.payment_means_code,
      partner_country_code: formData.partner_country_code,
      partner_jbkjs: formData.partner_jbkjs || null,
      billing_reference_number: formData.billing_reference_number || null,
      billing_reference_date: formData.billing_reference_date || null,
      contract_reference: formData.contract_reference || null,
      tax_category_code: formData.tax_category_code,
      tax_exemption_reason: formData.tax_category_code !== "S" ? (formData.tax_exemption_reason || null) : null,
      mesto_prometa: formData.mesto_prometa || null,
      datum_prometa: formData.datum_prometa || null,
      bank_account_id: formData.bank_account_id || null,
      advance_invoice_id: formData.advance_invoice_id || null,
      // Ino izlazne fakture
      exchange_rate: rate,
      subtotal_rsd: +((invoice.subtotal || 0) * rate).toFixed(2),
      vat_amount_rsd: +((invoice.vat_amount || 0) * rate).toFixed(2),
      total_amount_rsd: +((invoice.total_amount || 0) * rate).toFixed(2),
      jci_number: formData.jci_number || null,
      jci_date: formData.jci_date || null,
      delivery_terms: formData.delivery_terms || null,
      source_delivery_note_id: formData.source_delivery_note_id || null,
    });

    // Ako je novopovezana otpremnica — kopiraj stavke (ako faktura nema stavke) i poveži otpremnicu
    const prevDnId = invoice.source_delivery_note_id || null;
    const newDnId = formData.source_delivery_note_id || null;
    if (newDnId && newDnId !== prevDnId) {
      try {
        // Provera da li faktura već ima stavke
        const { count: existingItemsCount } = await supabase
          .from("invoice_items")
          .select("id", { count: "exact", head: true })
          .eq("invoice_id", invoice.id);

        if ((existingItemsCount ?? 0) === 0) {
          const { data: dnItems, error: itemsErr } = await supabase
            .from("delivery_note_items")
            .select(`*, article:articles(id, code, name, unit, selling_price, vat_rate)`)
            .eq("delivery_note_id", newDnId);
          if (itemsErr) throw itemsErr;

          if (dnItems && dnItems.length > 0) {
            let subtotal = 0;
            let vatAmount = 0;
            const grouped = new Map<string, GroupedInvoiceItem>();

            for (const item of dnItems as DeliveryNoteItemRow[]) {
              const key = item.item_code || item.article?.code || item.article_id || item.item_name;
              const unitPrice = item.unit_price ?? item.article?.selling_price ?? 0;
              const vatRate = item.vat_rate ?? item.article?.vat_rate ?? 20;

              if (!grouped.has(key)) {
                grouped.set(key, {
                  invoice_id: invoice.id,
                  company_id: invoice.company_id,
                  article_id: item.article_id,
                  item_code: item.item_code ?? item.article?.code ?? null,
                  item_name: item.item_name ?? item.article?.name ?? "",
                  unit: item.unit ?? item.article?.unit ?? "kom",
                  quantity: 0,
                  unit_price: unitPrice,
                  discount_percent: 0,
                  vat_rate: vatRate,
                  description: item.description || null,
                });
              }

              const groupedItem = grouped.get(key);
              groupedItem.quantity += Number(item.quantity || 0);
            }

            const rows: InvoiceInsertRow[] = Array.from(grouped.values()).map((item, index) => {
              const lineSubtotal = (item.quantity || 0) * (item.unit_price || 0);
              const lineVat = lineSubtotal * ((item.vat_rate || 0) / 100);
              subtotal += lineSubtotal;
              vatAmount += lineVat;

              return {
                ...item,
                item_order: index + 1,
                line_subtotal: lineSubtotal,
                line_vat: lineVat,
                line_total: lineSubtotal + lineVat,
              };
            });
            const { error: insErr } = await supabase.from("invoice_items").insert(rows);
            if (insErr) throw insErr;

            // Ažuriraj totale fakture
            const totalAmount = subtotal + vatAmount;
            await supabase.from("invoices").update({
              subtotal,
              vat_amount: vatAmount,
              total_amount: totalAmount,
              subtotal_rsd: +(subtotal * rate).toFixed(2),
              vat_amount_rsd: +(vatAmount * rate).toFixed(2),
              total_amount_rsd: +(totalAmount * rate).toFixed(2),
            }).eq("id", invoice.id);

            await queryClient.invalidateQueries({ queryKey: ["invoice-items", invoice.id] });
            await queryClient.invalidateQueries({ queryKey: ["invoices"] });
            toast.success(`Učitano ${rows.length} stavki sa otpremnice`);
          }
        }

        // Poveži otpremnicu sa fakturom (reverzna veza)
        await supabase.from("delivery_notes").update({ invoice_id: invoice.id }).eq("id", newDnId);
        // Odveži staru otpremnicu ako je postojala
        if (prevDnId) {
          await supabase.from("delivery_notes").update({ invoice_id: null }).eq("id", prevDnId);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Nepoznata greška";
        toast.error(`Greška pri učitavanju stavki sa otpremnice: ${message}`);
      }
    } else if (!newDnId && prevDnId) {
      // Otpremnica je uklonjena — odveži je
      await supabase.from("delivery_notes").update({ invoice_id: null }).eq("id", prevDnId);
    }

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
                minDate={minDate}
                maxDate={maxDate}
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

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Mesto prometa</Label>
              <Input
                value={formData.mesto_prometa || ""}
                onChange={(e) => setFormData({ ...formData, mesto_prometa: e.target.value || null })}
                placeholder="Mesto prometa..."
                disabled={readOnly}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Datum prometa</Label>
              <LocaleDateInput
                value={formData.datum_prometa || ""}
                onChange={(v) => setFormData({ ...formData, datum_prometa: v || null })}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Tekući račun</Label>
              <Select
                value={formData.bank_account_id || "none"}
                onValueChange={(v) => setFormData({ ...formData, bank_account_id: v === "none" ? null : v })}
                disabled={readOnly}
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

          {/* Otpremnica (po kojoj su isporučena dobra) */}
          <div className="space-y-2">
            <Label>Otpremnica (po kojoj su isporučena dobra)</Label>
            <Select
              value={formData.source_delivery_note_id || "none"}
              onValueChange={(v) => setFormData({ ...formData, source_delivery_note_id: v === "none" ? null : v })}
              disabled={readOnly || !formData.partner_id}
            >
              <SelectTrigger>
                <SelectValue placeholder={formData.partner_id ? "-- Bez otpremnice --" : "Prvo izaberite kupca"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Bez otpremnice --</SelectItem>
                {availableDeliveryNotes.map((dn) => (
                  <SelectItem key={dn.id} value={dn.id}>
                    {dn.delivery_number} ({new Date(dn.delivery_date).toLocaleDateString("sr-Latn-RS")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.partner_id && availableDeliveryNotes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nema dostupnih otpremnica za ovog kupca (sve su već povezane sa drugim fakturama ili stornirane).
              </p>
            )}
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

          <Separator />

          {/* eFaktura section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">eFaktura podešavanja</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tip dokumenta</Label>
                <Select
                  value={formData.invoice_type_code}
                  onValueChange={(v) => setFormData({ ...formData, invoice_type_code: v })}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="380">380 - Faktura</SelectItem>
                    <SelectItem value="381">381 - Knjižno odobrenje</SelectItem>
                    <SelectItem value="386">386 - Faktura za avans</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valuta</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) => setFormData({ ...formData, currency: v })}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
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
                <Select
                  value={formData.payment_means_code}
                  onValueChange={(v) => setFormData({ ...formData, payment_means_code: v })}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
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
                  value={formData.partner_country_code}
                  onChange={(e) => setFormData({ ...formData, partner_country_code: e.target.value.toUpperCase() })}
                  className="h-8 text-sm"
                  maxLength={2}
                  placeholder="RS"
                  disabled={readOnly}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">JBKJS (za B2G)</Label>
                <Input
                  value={formData.partner_jbkjs || ""}
                  onChange={(e) => setFormData({ ...formData, partner_jbkjs: e.target.value || null })}
                  className="h-8 text-sm"
                  placeholder="Broj JBKJS..."
                  disabled={readOnly}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ugovor/referenca</Label>
                <Input
                  value={formData.contract_reference || ""}
                  onChange={(e) => setFormData({ ...formData, contract_reference: e.target.value || null })}
                  className="h-8 text-sm"
                  placeholder="Broj ugovora..."
                  disabled={readOnly}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">PDV kategorija</Label>
                <Select
                  value={formData.tax_category_code}
                  onValueChange={(v) => setFormData({ ...formData, tax_category_code: v, tax_exemption_reason: v === "S" ? "" : formData.tax_exemption_reason })}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
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
                  <Label className="text-xs text-muted-foreground">Osnov oslobođenja (član, stav, tačka)</Label>
                  <Input
                    value={formData.tax_exemption_reason || ""}
                    onChange={(e) => setFormData({ ...formData, tax_exemption_reason: e.target.value || null })}
                    className="h-8 text-sm"
                    placeholder="Npr. Član 25. stav 2. tačka 1."
                    disabled={readOnly}
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
            {formData.invoice_type_code === "381" && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Broj originalne fakture *</Label>
                  <Input
                    value={formData.billing_reference_number || ""}
                    onChange={(e) => setFormData({ ...formData, billing_reference_number: e.target.value || null })}
                    className="h-8 text-sm"
                    placeholder="Npr. FAK-2026-001"
                    disabled={readOnly}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Datum originalne fakture</Label>
                  <LocaleDateInput
                    value={formData.billing_reference_date || ""}
                    onChange={(v) => setFormData({ ...formData, billing_reference_date: v || null })}
                    disabled={readOnly}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Ino izlazna faktura — vidljivo samo za strane valute */}
          {isForeignCurrency(formData.currency) && (
            <div className="space-y-3 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Ino faktura ({formData.currency}) — kurs i izvozna evidencija
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Srednji kurs NBS *</Label>
                  <div className="flex gap-2">
                    <LocaleNumberInput
                      value={exchangeRateText}
                      onChange={setExchangeRateText}
                      onBlur={() => {
                        const parsed = parseLocaleNumber(exchangeRateText) || 1;
                        setFormData({ ...formData, exchange_rate: parsed });
                      }}
                      className="h-9"
                      allowEmpty
                      disabled={readOnly}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadNbsRate}
                      disabled={readOnly || loadingNbsRate}
                      title="Učitaj srednji kurs NBS za datum prometa/fakture"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingNbsRate ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    1 {formData.currency} = {exchangeRateText} RSD
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Broj JCI / MRN</Label>
                  <Input
                    value={formData.jci_number || ""}
                    onChange={(e) => setFormData({ ...formData, jci_number: e.target.value || null })}
                    className="h-9"
                    placeholder="npr. 25RS123456789"
                    disabled={readOnly}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Datum JCI (carinjenja)</Label>
                  <LocaleDateInput
                    value={formData.jci_date || ""}
                    onChange={(v) => setFormData({ ...formData, jci_date: v || null })}
                    disabled={readOnly}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Isporučni uslovi (Incoterms)</Label>
                  <Select
                    value={formData.delivery_terms || "none"}
                    onValueChange={(v) => setFormData({ ...formData, delivery_terms: v === "none" ? null : v })}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="-- Nije navedeno --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Nije navedeno --</SelectItem>
                      <SelectItem value="EXW">EXW - Ex Works</SelectItem>
                      <SelectItem value="FCA">FCA - Free Carrier</SelectItem>
                      <SelectItem value="FAS">FAS - Free Alongside Ship</SelectItem>
                      <SelectItem value="FOB">FOB - Free On Board</SelectItem>
                      <SelectItem value="CFR">CFR - Cost & Freight</SelectItem>
                      <SelectItem value="CIF">CIF - Cost Insurance Freight</SelectItem>
                      <SelectItem value="CPT">CPT - Carriage Paid To</SelectItem>
                      <SelectItem value="CIP">CIP - Carriage & Insurance Paid To</SelectItem>
                      <SelectItem value="DAP">DAP - Delivered At Place</SelectItem>
                      <SelectItem value="DPU">DPU - Delivered At Place Unloaded</SelectItem>
                      <SelectItem value="DDP">DDP - Delivered Duty Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {invoice && (invoice.total_amount || 0) > 0 && (
                <div className="text-xs text-muted-foreground border-t border-amber-200 dark:border-amber-800 pt-2">
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <span>
                      Ukupno: <strong>{formatPrice(invoice.total_amount)} {formData.currency}</strong>
                    </span>
                    <span>
                      RSD ekvivalent (po kursu {(formData.exchange_rate || 1).toFixed(4)}):{" "}
                      <strong>{formatPrice((invoice.total_amount || 0) * (formData.exchange_rate || 1))} RSD</strong>
                    </span>
                  </div>
                  <p className="mt-1 italic">
                    Knjiženje će biti u RSD po unetom srednjem kursu NBS na datum prometa.
                  </p>
                </div>
              )}
            </div>
          )}



          {/* Advance invoice deduction */}
          {formData.invoice_type_code === "380" && availableAdvances.length > 0 && (
            <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">Pozivanje na avansnu fakturu</Label>
              </div>
              <Select
                value={formData.advance_invoice_id || "none"}
                onValueChange={(v) => setFormData({ ...formData, advance_invoice_id: v === "none" ? "" : v })}
                disabled={readOnly}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="-- Bez avansne fakture --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Bez avansne fakture --</SelectItem>
                  {availableAdvances.map((adv) => (
                    <SelectItem key={adv.id} value={adv.id}>
                      AF {adv.advance_number} — {formatPrice(adv.total_amount)} (PDV: {formatPrice(adv.vat_amount)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.advance_invoice_id && (() => {
                const sel = availableAdvances.find((a) => a.id === formData.advance_invoice_id);
                return sel ? (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Ukupan iznos avansa {formatPrice(sel.total_amount)} će biti oduzet od potraživanja kupca. PDV iz avansa ({formatPrice(sel.vat_amount)}) biće storniran u GK i POPDV.
                  </p>
                ) : null;
              })()}
            </div>
          )}

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
