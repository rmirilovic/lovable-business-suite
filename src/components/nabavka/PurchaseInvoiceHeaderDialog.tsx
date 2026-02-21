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
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { usePartners, usePartnerBankAccounts } from "@/hooks/usePartners";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  usePurchaseInvoices,
  PurchaseInvoice,
  PurchaseInvoiceFormData,
} from "@/hooks/usePurchaseInvoices";

interface PurchaseInvoiceHeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PurchaseInvoice | null;
  onSaved?: (invoice: PurchaseInvoice) => void;
}

export function PurchaseInvoiceHeaderDialog({
  open,
  onOpenChange,
  invoice,
  onSaved,
}: PurchaseInvoiceHeaderDialogProps) {
  const { selectedCompany } = useAuth();
  const { partners } = usePartners();
  const { units: organizationalUnits } = useOrganizationalUnits(selectedCompany?.id);
  const { warehouses } = useWarehouses(selectedCompany?.id);
  const { createPurchaseInvoice, updatePurchaseInvoice } = usePurchaseInvoices();

  const [formData, setFormData] = useState<PurchaseInvoiceFormData>({
    supplier_invoice_number: "",
    invoice_date: new Date().toISOString().split("T")[0],
    receipt_date: new Date().toISOString().split("T")[0],
    due_date: null,
    partner_id: "",
    org_unit_id: null,
    warehouse_id: null,
    note: null,
    internal_note: null,
    supplier_bank_account: null,
    payment_reference: null,
  });

  // Fetch bank accounts for selected partner
  const { bankAccounts } = usePartnerBankAccounts(formData.partner_id || null);

  useEffect(() => {
    if (invoice) {
      setFormData({
        supplier_invoice_number: invoice.supplier_invoice_number,
        invoice_date: invoice.invoice_date,
        receipt_date: invoice.receipt_date,
        due_date: invoice.due_date,
        partner_id: invoice.partner_id,
        org_unit_id: invoice.org_unit_id,
        warehouse_id: invoice.warehouse_id,
        note: invoice.note,
        internal_note: invoice.internal_note,
        supplier_bank_account: invoice.supplier_bank_account,
        payment_reference: invoice.payment_reference,
      });
    } else {
      setFormData({
        supplier_invoice_number: "",
        invoice_date: new Date().toISOString().split("T")[0],
        receipt_date: new Date().toISOString().split("T")[0],
        due_date: null,
        partner_id: "",
        org_unit_id: null,
        warehouse_id: null,
        note: null,
        internal_note: null,
        supplier_bank_account: null,
        payment_reference: null,
      });
    }
  }, [invoice, open]);

  // When partner changes, set default bank account
  const handlePartnerChange = async (newPartnerId: string) => {
    // Fetch bank accounts for new partner
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
      supplier_bank_account: defaultAccount,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (invoice) {
      await updatePurchaseInvoice.mutateAsync({ id: invoice.id, ...formData });
      onOpenChange(false);
    } else {
      const created = await createPurchaseInvoice.mutateAsync(formData);
      onOpenChange(false);
      if (onSaved && created) {
        // Fetch the full invoice with partner to pass to onSaved
        const { data: fullInvoice } = await supabase
          .from("purchase_invoices")
          .select(`*, partner:partners(id, name, code)`)
          .eq("id", created.id)
          .single();
        if (fullInvoice) {
          onSaved(fullInvoice as PurchaseInvoice);
        }
      }
    }
  };

  const supplierPartners = partners.filter((p) => p.is_supplier && p.is_active);
  const activeOrgUnits = organizationalUnits.filter((ou) => ou.is_active);
  const activeWarehouses = warehouses.filter((w) => w.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {invoice
              ? `Uredi zaglavlje: ${invoice.internal_number}`
              : "Nova ulazna faktura"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="Poziv na broj sa fakture dobavljača"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Organizaciona jedinica</Label>
              <Select
                value={formData.org_unit_id || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    org_unit_id: value === "none" ? null : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite OJ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Bez OJ --</SelectItem>
                  {activeOrgUnits.map((ou) => (
                    <SelectItem key={ou.id} value={ou.id}>
                      {ou.code} - {ou.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Magacin</Label>
              <Select
                value={formData.warehouse_id || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    warehouse_id: value === "none" ? null : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite magacin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Bez magacina --</SelectItem>
                  {activeWarehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.code} - {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Otkaži
            </Button>
            <Button
              type="submit"
              disabled={
                !formData.partner_id ||
                !formData.supplier_invoice_number ||
                createPurchaseInvoice.isPending ||
                updatePurchaseInvoice.isPending
              }
            >
              {createPurchaseInvoice.isPending || updatePurchaseInvoice.isPending
                ? "Čuvanje..."
                : invoice
                ? "Sačuvaj"
                : "Kreiraj"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
