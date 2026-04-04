import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomsClearances } from "@/hooks/useCustomsClearances";
import { useGoodsPurchaseInvoices } from "@/hooks/useGoodsPurchaseInvoices";
import { useWarehouses } from "@/hooks/useWarehouses";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

export function CustomsClearanceHeaderDialog({ open, onOpenChange, onCreated }: Props) {
  const { selectedCompany } = useAuth();
  const { createClearance, isCreating } = useCustomsClearances();
  const { invoices } = useGoodsPurchaseInvoices();
  const { warehouses } = useWarehouses();

  const [sourceInvoiceId, setSourceInvoiceId] = useState("");
  const [clearanceDate, setClearanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [jciNumber, setJciNumber] = useState("");
  const [jciDate, setJciDate] = useState("");
  const [customsOfficeCode, setCustomsOfficeCode] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [currency, setCurrency] = useState("EUR");
  const [note, setNote] = useState("");

  // Filter: only posted invoices from customs warehouses
  const customsInvoices = invoices.filter((inv) => {
    const wh = warehouses.find((w) => w.id === inv.warehouse_id);
    return inv.status === "posted" && wh?.is_customs_warehouse;
  });

  // Non-customs warehouses for destination
  const regularWarehouses = warehouses.filter((w) => !w.is_customs_warehouse && w.is_active !== false);

  const selectedInvoice = customsInvoices.find((i) => i.id === sourceInvoiceId);

  useEffect(() => {
    if (selectedInvoice) {
      setCurrency(selectedInvoice.currency || "EUR");
      setExchangeRate(String(selectedInvoice.exchange_rate || 1));
      if (selectedInvoice.customs_office_code) {
        setCustomsOfficeCode(selectedInvoice.customs_office_code);
      }
    }
  }, [selectedInvoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceInvoiceId || !destinationWarehouseId) return;

    const sourceWarehouseId = selectedInvoice?.warehouse_id;
    if (!sourceWarehouseId) return;

    try {
      const result = await createClearance({
        clearance_date: clearanceDate,
        source_invoice_id: sourceInvoiceId,
        jci_number: jciNumber || null,
        jci_date: jciDate || null,
        customs_office_code: customsOfficeCode || null,
        source_warehouse_id: sourceWarehouseId,
        destination_warehouse_id: destinationWarehouseId,
        exchange_rate: parseFloat(exchangeRate) || 1,
        currency: currency || "EUR",
        customs_duty_amount: 0,
        excise_amount: 0,
        vat_rate: 20,
        customs_duty_account: null,
        excise_account: null,
        vat_account: "2700",
        customs_obligation_account: null,
        source_warehouse_account: null,
        destination_warehouse_account: null,
        note: note || null,
      });
      onCreated(result.id);
    } catch { /* handled in hook */ }
  };

  const resetForm = () => {
    setSourceInvoiceId("");
    setClearanceDate(new Date().toISOString().split("T")[0]);
    setJciNumber("");
    setJciDate("");
    setCustomsOfficeCode("");
    setDestinationWarehouseId("");
    setExchangeRate("1");
    setCurrency("EUR");
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novi carinski obračun</DialogTitle>
          <DialogDescription>Kreirajte novi carinski obračun za iskladištenje robe</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Izvorna UFR (carinsko skladište) *</Label>
            <Select value={sourceInvoiceId} onValueChange={setSourceInvoiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Izaberite ulaznu fakturu" />
              </SelectTrigger>
              <SelectContent>
                {customsInvoices.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.internal_number} - {inv.supplier_name || "N/A"} ({inv.supplier_invoice_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum obračuna *</Label>
              <LocaleDateInput value={clearanceDate} onChange={setClearanceDate} />
            </div>
            <div className="space-y-2">
              <Label>Odredišni magacin *</Label>
              <Select value={destinationWarehouseId} onValueChange={setDestinationWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite magacin" />
                </SelectTrigger>
                <SelectContent>
                  {regularWarehouses.map((w) => (
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
              <Label>JCI broj</Label>
              <Input value={jciNumber} onChange={(e) => setJciNumber(e.target.value)} placeholder="Broj carinske isprave" />
            </div>
            <div className="space-y-2">
              <Label>JCI datum</Label>
              <LocaleDateInput value={jciDate} onChange={setJciDate} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Carinska ispostava</Label>
              <Input value={customsOfficeCode} onChange={(e) => setCustomsOfficeCode(e.target.value)} placeholder="Šifra" />
            </div>
            <div className="space-y-2">
              <Label>Valuta</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Devizni kurs</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Napomena</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Otkaži</Button>
            <Button type="submit" disabled={isCreating || !sourceInvoiceId || !destinationWarehouseId}>
              {isCreating ? "Kreiranje..." : "Kreiraj"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
