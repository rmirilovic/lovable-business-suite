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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { usePartners } from "@/hooks/usePartners";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { parseLocaleNumber } from "@/lib/formatting";

interface JournalEntryItemFormData {
  account_code: string;
  description: string | null;
  debit_amount: number;
  credit_amount: number;
  partner_id: string | null;
  cost_center_code: string | null;
  item_order: number;
}

interface JournalEntryItemFormProps {
  entryId: string;
  item?: {
    id: string;
    account_code: string;
    description: string | null;
    debit_amount: number;
    credit_amount: number;
    partner_id: string | null;
    cost_center_code: string | null;
    item_order: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<JournalEntryItemFormData, 'item_order'> & { item_order: number }) => Promise<void>;
}

export function JournalEntryItemForm({ 
  entryId, 
  item, 
  open, 
  onOpenChange, 
  onSave 
}: JournalEntryItemFormProps) {
  const { data: accounts = [] } = useChartOfAccounts();
  const { partners } = usePartners();
  
  const [form, setForm] = useState({
    account_code: "",
    description: "",
    debit_amount: "0,00",
    credit_amount: "0,00",
    partner_id: "",
    cost_center_code: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const postingAccounts = accounts.filter((a) => a.is_posting_allowed);

  useEffect(() => {
    if (open) {
      if (item) {
        setForm({
          account_code: item.account_code,
          description: item.description || "",
          debit_amount: item.debit_amount.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          credit_amount: item.credit_amount.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          partner_id: item.partner_id || "",
          cost_center_code: item.cost_center_code || "",
        });
      } else {
        setForm({
          account_code: "",
          description: "",
          debit_amount: "0,00",
          credit_amount: "0,00",
          partner_id: "",
          cost_center_code: "",
        });
      }
    }
  }, [open, item]);

  const handleSave = async () => {
    if (!form.account_code) return;
    
    setIsSaving(true);
    try {
      await onSave({
        account_code: form.account_code,
        description: form.description || null,
        debit_amount: parseLocaleNumber(form.debit_amount),
        credit_amount: parseLocaleNumber(form.credit_amount),
        partner_id: form.partner_id || null,
        cost_center_code: form.cost_center_code || null,
        item_order: item?.item_order ?? 0,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Uredi stavku" : "Nova stavka"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Konto *</Label>
            <Select
              value={form.account_code}
              onValueChange={(value) => setForm({ ...form, account_code: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Izaberite konto" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {postingAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.code}>
                    {account.code} - {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Opis</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Opis stavke"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duguje</Label>
              <LocaleNumberInput
                value={form.debit_amount}
                onChange={(value) => setForm({ ...form, debit_amount: value })}
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label>Potražuje</Label>
              <LocaleNumberInput
                value={form.credit_amount}
                onChange={(value) => setForm({ ...form, credit_amount: value })}
                className="text-right"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Partner (opciono)</Label>
            <Select
              value={form.partner_id || "__none__"}
              onValueChange={(value) => setForm({ ...form, partner_id: value === "__none__" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Bez partnera" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="__none__">Bez partnera</SelectItem>
                {partners.map((partner) => (
                  <SelectItem key={partner.id} value={partner.id}>
                    {partner.code} - {partner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Analitika / Mesto troška</Label>
            <Input
              value={form.cost_center_code}
              onChange={(e) => setForm({ ...form, cost_center_code: e.target.value })}
              placeholder="Šifra mesta troška"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button onClick={handleSave} disabled={!form.account_code || isSaving}>
            {item ? "Sačuvaj" : "Dodaj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
