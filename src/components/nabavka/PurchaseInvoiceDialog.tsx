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
import { usePartners } from "@/hooks/usePartners";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePurchaseInvoices,
  usePurchaseInvoiceItems,
  PurchaseInvoice,
  PurchaseInvoiceFormData,
} from "@/hooks/usePurchaseInvoices";
import { PurchaseInvoiceItemsEditor } from "./PurchaseInvoiceItemsEditor";

interface PurchaseInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PurchaseInvoice | null;
}

export function PurchaseInvoiceDialog({
  open,
  onOpenChange,
  invoice,
}: PurchaseInvoiceDialogProps) {
  const { selectedCompany } = useAuth();
  const { partners } = usePartners();
  const { units: organizationalUnits } = useOrganizationalUnits(selectedCompany?.id);
  const { warehouses } = useWarehouses(selectedCompany?.id);
  const { createPurchaseInvoice, updatePurchaseInvoice, updatePurchaseInvoiceTotals } =
    usePurchaseInvoices();
  const { items, addItem, updateItem, deleteItem } = usePurchaseInvoiceItems(
    invoice?.id || null
  );

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
  });

  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

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
      });
      setCreatedInvoiceId(null);
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
      });
      setCreatedInvoiceId(null);
    }
  }, [invoice, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (invoice) {
      await updatePurchaseInvoice.mutateAsync({ id: invoice.id, ...formData });
      onOpenChange(false);
    } else {
      const created = await createPurchaseInvoice.mutateAsync(formData);
      setCreatedInvoiceId(created.id);
    }
  };

  const handleTotalsChange = (subtotal: number, vatAmount: number, total: number) => {
    const invoiceId = invoice?.id || createdInvoiceId;
    if (invoiceId) {
      updatePurchaseInvoiceTotals.mutate({
        invoiceId,
        subtotal,
        vat_amount: vatAmount,
        total_amount: total,
      });
    }
  };

  const supplierPartners = partners.filter((p) => p.is_supplier && p.is_active);
  const activeOrgUnits = organizationalUnits.filter((ou) => ou.is_active);
  const activeWarehouses = warehouses.filter((w) => w.is_active);

  const currentInvoiceId = invoice?.id || createdInvoiceId;
  const isEditingItems = !!currentInvoiceId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
          <DialogTitle>
            {invoice
              ? `Izmena ulazne fakture: ${invoice.internal_number}`
              : createdInvoiceId
              ? "Nova ulazna faktura - Dodavanje stavki"
              : "Nova ulazna faktura"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* Header Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                disabled={isEditingItems && !invoice}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_date">Datum fakture *</Label>
              <LocaleDateInput
                value={formData.invoice_date}
                onChange={(value) => setFormData({ ...formData, invoice_date: value })}
                disabled={isEditingItems && !invoice}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt_date">Datum prijema *</Label>
              <LocaleDateInput
                value={formData.receipt_date}
                onChange={(value) => setFormData({ ...formData, receipt_date: value })}
                disabled={isEditingItems && !invoice}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Datum valute</Label>
              <LocaleDateInput
                value={formData.due_date || ""}
                onChange={(value) =>
                  setFormData({ ...formData, due_date: value || null })
                }
                disabled={isEditingItems && !invoice}
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label>Dobavljač *</Label>
              <SearchablePartnerSelect
                partners={supplierPartners}
                value={formData.partner_id}
                onValueChange={(value) => setFormData({ ...formData, partner_id: value })}
                placeholder="Pretraži i izaberi dobavljača..."
                disabled={isEditingItems && !invoice}
              />
            </div>

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
                disabled={isEditingItems && !invoice}
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
                disabled={isEditingItems && !invoice}
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

          {/* Notes Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="note">Napomena</Label>
              <Textarea
                id="note"
                value={formData.note || ""}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value || null })
                }
                rows={2}
                disabled={isEditingItems && !invoice}
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
                disabled={isEditingItems && !invoice}
              />
            </div>
          </div>

          {/* Items Section - only show after invoice is created */}
          {isEditingItems && (
            <PurchaseInvoiceItemsEditor
              invoiceId={currentInvoiceId!}
              items={items}
              onAddItem={addItem.mutateAsync}
              onUpdateItem={updateItem.mutateAsync}
              onDeleteItem={deleteItem.mutateAsync}
              onTotalsChange={handleTotalsChange}
            />
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isEditingItems ? "Zatvori" : "Otkaži"}
            </Button>
            {!isEditingItems && (
              <Button
                type="submit"
                disabled={
                  !formData.partner_id ||
                  !formData.supplier_invoice_number ||
                  createPurchaseInvoice.isPending ||
                  updatePurchaseInvoice.isPending
                }
              >
                {invoice ? "Sačuvaj" : "Kreiraj i dodaj stavke"}
              </Button>
            )}
            {isEditingItems && invoice && (
              <Button
                type="submit"
                disabled={updatePurchaseInvoice.isPending}
              >
                Sačuvaj izmene
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
