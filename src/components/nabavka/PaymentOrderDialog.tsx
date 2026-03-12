import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { usePartners } from "@/hooks/usePartners";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { PaymentOrder } from "@/hooks/usePaymentOrders";
import { formatPrice, parseLocaleNumber } from "@/lib/formatting";

interface PaymentOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PaymentOrder | null;
  onSave: (data: Partial<PaymentOrder>) => void;
  readOnly?: boolean;
}

const NBS_CODES = [
  { code: "220", name: "Promet robe i usluga – međufazna potrošnja" },
  { code: "221", name: "Promet robe i usluga – finalna potrošnja" },
  { code: "222", name: "Usluge javnih preduzeća" },
  { code: "223", name: "Zakupnine" },
  { code: "224", name: "Članarine" },
  { code: "240", name: "Zarade i druga primanja zaposlenih" },
  { code: "253", name: "Porez na dobit preduzeća" },
  { code: "254", name: "Porez na promet" },
  { code: "260", name: "Premije osiguranja" },
  { code: "265", name: "Kratkoročni krediti" },
  { code: "266", name: "Dugoročni krediti" },
  { code: "270", name: "Komunalne usluge" },
  { code: "280", name: "Donacije i sponzorstva" },
  { code: "290", name: "Ostale transakcije" },
];

export function PaymentOrderDialog({
  open,
  onOpenChange,
  order,
  onSave,
  readOnly = false,
}: PaymentOrderDialogProps) {
  const { selectedCompany } = useAuth();
  const { partners } = usePartners();
  const { bankAccounts } = useBankAccounts(selectedCompany?.id);

  const [form, setForm] = useState<Partial<PaymentOrder>>({
    booking_date: new Date().toISOString().split("T")[0],
    status: "draft",
    document_amount: 0,
    previously_paid: 0,
    approved_amount: 0,
  });

  useEffect(() => {
    if (order) {
      setForm(order);
    } else {
      setForm({
        booking_date: new Date().toISOString().split("T")[0],
        status: "draft",
        document_amount: 0,
        previously_paid: 0,
        approved_amount: 0,
        nbs_payment_code: "220",
      });
    }
  }, [order, open]);

  const remaining = (form.document_amount || 0) - (form.previously_paid || 0);

  const handleSave = () => {
    if (!form.partner_id) return;
    onSave(form);
    onOpenChange(false);
  };

  const handlePartnerChange = (partnerId: string) => {
    const partner = partners.find((p) => p.id === partnerId);
    setForm((f) => ({
      ...f,
      partner_id: partnerId,
      partner_name: partner?.name || "",
      partner_code: partner?.code || "",
    }));
  };

  const statusLabels: Record<string, string> = {
    draft: "Nacrt",
    approved: "Odobren",
    sent: "Poslat",
    paid: "Plaćen",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {readOnly ? "Pregled naloga" : order ? "Izmena naloga za plaćanje" : "Novi nalog za plaćanje"}
            {order && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                Status: {statusLabels[form.status || "draft"]}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Partner</Label>
            <SearchablePartnerSelect
              partners={partners}
              value={form.partner_id || ""}
              onValueChange={handlePartnerChange}
              disabled={readOnly}
            />
          </div>

          <div>
            <Label>Interni dokument</Label>
            <Input
              value={form.source_document_number || ""}
              onChange={(e) => setForm((f) => ({ ...f, source_document_number: e.target.value }))}
              placeholder="npr. UFU-260041"
              disabled={readOnly}
            />
          </div>

          <div>
            <Label>Datum knjiženja</Label>
            <LocaleDateInput
              value={form.booking_date || ""}
              onChange={(v) => setForm((f) => ({ ...f, booking_date: v }))}
              disabled={readOnly}
            />
          </div>

          <div>
            <Label>Broj dokumenta dobavljača</Label>
            <Input
              value={form.supplier_document_number || ""}
              onChange={(e) => setForm((f) => ({ ...f, supplier_document_number: e.target.value }))}
              disabled={readOnly}
            />
          </div>

          <div>
            <Label>Datum dokumenta dobavljača</Label>
            <LocaleDateInput
              value={form.supplier_document_date || ""}
              onChange={(v) => setForm((f) => ({ ...f, supplier_document_date: v }))}
              disabled={readOnly}
            />
          </div>

          <div>
            <Label>Valuta plaćanja</Label>
            <LocaleDateInput
              value={form.due_date || ""}
              onChange={(v) => setForm((f) => ({ ...f, due_date: v }))}
              disabled={readOnly}
            />
          </div>

          <div>
            <Label>Iznos po dokumentu</Label>
            <LocaleNumberInput
              value={String(form.document_amount || 0)}
              onChange={(val) => {
                const num = parseLocaleNumber(val);
                setForm((f) => ({
                  ...f,
                  document_amount: num,
                  approved_amount: Math.min(f.approved_amount || 0, num - (f.previously_paid || 0)),
                }));
              }}
              disabled={readOnly}
              decimalPlaces={2}
            />
          </div>

          <div>
            <Label>Prethodno isplaćeno</Label>
            <LocaleNumberInput
              value={String(form.previously_paid || 0)}
              onChange={(val) => setForm((f) => ({ ...f, previously_paid: parseLocaleNumber(val) }))}
              disabled={readOnly}
              decimalPlaces={2}
            />
          </div>

          <div>
            <Label>Plaća se (odobren iznos)</Label>
            <LocaleNumberInput
              value={String(form.approved_amount || 0)}
              onChange={(val) => {
                const clamped = Math.min(parseLocaleNumber(val), remaining);
                setForm((f) => ({ ...f, approved_amount: clamped }));
              }}
              disabled={readOnly}
              decimalPlaces={2}
            />
            {remaining > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Preostalo za plaćanje: {formatPrice(remaining)}
              </p>
            )}
          </div>

          <div>
            <Label>Tekući račun za uplatu (dobavljača)</Label>
            <Input
              value={form.partner_bank_account || ""}
              onChange={(e) => setForm((f) => ({ ...f, partner_bank_account: e.target.value }))}
              disabled={readOnly}
            />
          </div>

          <div>
            <Label>Tekući račun (naš)</Label>
            <Select
              value={form.bank_account_id || ""}
              onValueChange={(v) => setForm((f) => ({ ...f, bank_account_id: v }))}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Izaberite TR" />
              </SelectTrigger>
              <SelectContent>
                {(bankAccounts || []).map((ba) => (
                  <SelectItem key={ba.id} value={ba.id}>
                    {ba.bank_name} - {ba.account_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Poziv na broj</Label>
            <Input
              value={form.payment_reference || ""}
              onChange={(e) => setForm((f) => ({ ...f, payment_reference: e.target.value }))}
              disabled={readOnly}
            />
          </div>

          <div>
            <Label>Šifra plaćanja (NBS)</Label>
            <Select
              value={form.nbs_payment_code || ""}
              onValueChange={(v) => setForm((f) => ({ ...f, nbs_payment_code: v }))}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Izaberite šifru" />
              </SelectTrigger>
              <SelectContent>
                {NBS_CODES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {order && (
            <>
              {form.approved_date && (
                <div>
                  <Label>Odobren za datum</Label>
                  <LocaleDateInput value={form.approved_date} onChange={() => {}} disabled />
                </div>
              )}
              {form.sent_date && (
                <div>
                  <Label>Datum slanja</Label>
                  <LocaleDateInput value={form.sent_date} onChange={() => {}} disabled />
                </div>
              )}
              {form.paid_date && (
                <div>
                  <Label>Datum plaćanja</Label>
                  <LocaleDateInput value={form.paid_date} onChange={() => {}} disabled />
                </div>
              )}
              {form.paid_amount !== null && form.paid_amount !== undefined && form.status === "paid" && (
                <div>
                  <Label>Plaćen iznos</Label>
                  <LocaleNumberInput value={form.paid_amount} onChange={() => {}} disabled minimumFractionDigits={2} maximumFractionDigits={2} />
                </div>
              )}
            </>
          )}

          <div className="col-span-2">
            <Label>Napomena</Label>
            <Textarea
              value={form.note || ""}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              disabled={readOnly}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? "Zatvori" : "Otkaži"}
          </Button>
          {!readOnly && (
            <Button onClick={handleSave} disabled={!form.partner_id}>
              {order ? "Sačuvaj" : "Kreiraj"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
