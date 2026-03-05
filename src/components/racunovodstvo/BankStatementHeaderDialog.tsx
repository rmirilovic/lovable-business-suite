import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/formatting";
import { BankStatement, useBankStatementMutations } from "@/hooks/useBankStatements";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useAuth } from "@/contexts/AuthContext";

interface BankStatementHeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statement: (BankStatement & { bank_accounts?: { code: string; account_number: string; bank_name: string } | null }) | null;
  readOnly?: boolean;
  onSaved?: () => void;
}

const parseLocaleNumber = (value: string): number => {
  if (!value) return 0;
  return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
};

export function BankStatementHeaderDialog({
  open,
  onOpenChange,
  statement,
  readOnly = false,
  onSaved,
}: BankStatementHeaderDialogProps) {
  const { selectedCompany } = useAuth();
  const { bankAccounts } = useBankAccounts(selectedCompany?.id);
  const { update } = useBankStatementMutations();

  const [formData, setFormData] = useState({
    statement_date: "",
    bank_account_id: "",
    bank_serial_number: "",
    opening_balance: "0,00",
    description: "",
  });

  useEffect(() => {
    if (statement && open) {
      setFormData({
        statement_date: statement.statement_date,
        bank_account_id: statement.bank_account_id,
        bank_serial_number: statement.bank_serial_number || "",
        opening_balance: formatNumber(statement.opening_balance, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        description: statement.description || "",
      });
    }
  }, [statement, open]);

  const handleSave = async () => {
    if (!statement) return;
    const openingBalance = parseLocaleNumber(formData.opening_balance);
    await update.mutateAsync({
      id: statement.id,
      statement_date: formData.statement_date,
      bank_serial_number: formData.bank_serial_number || null,
      opening_balance: openingBalance,
      description: formData.description || null,
    });
    onSaved?.();
    onOpenChange(false);
  };

  if (!statement) return null;

  const selectedAccount = bankAccounts.find(ba => ba.id === formData.bank_account_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{readOnly ? "Zaglavlje izvoda" : "Uredi zaglavlje"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Broj izvoda</Label>
            <Input value={statement.statement_number} disabled className="font-mono" />
          </div>
          <div>
            <Label>Datum izvoda</Label>
            {readOnly ? (
              <Input value={formData.statement_date} disabled />
            ) : (
              <LocaleDateInput
                value={formData.statement_date}
                onChange={(v) => setFormData({ ...formData, statement_date: v })}
              />
            )}
          </div>
          <div>
            <Label>Tekući račun</Label>
            <Input
              value={selectedAccount ? `${selectedAccount.account_number} - ${selectedAccount.bank_name}` : "-"}
              disabled
              className="font-mono"
            />
          </div>
          <div>
            <Label>R.br. izvoda banke</Label>
            {readOnly ? (
              <Input value={formData.bank_serial_number || "—"} disabled className="font-mono" />
            ) : (
              <Input
                value={formData.bank_serial_number}
                onChange={(e) => setFormData({ ...formData, bank_serial_number: e.target.value })}
                placeholder="—"
                className="font-mono"
                autoComplete="off"
              />
            )}
          </div>
          <div>
            <Label>Prethodno stanje</Label>
            {readOnly ? (
              <Input value={formData.opening_balance} disabled className="font-mono" />
            ) : (
              <LocaleNumberInput
                value={formData.opening_balance}
                onChange={(val) => setFormData({ ...formData, opening_balance: val })}
                className="font-mono"
              />
            )}
          </div>
          <div>
            <Label>Opis / napomena</Label>
            {readOnly ? (
              <Input value={formData.description || "—"} disabled />
            ) : (
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Opcioni opis..."
                rows={2}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Analitika TR</Label>
              <Input value={statement.bank_accounts?.code || "-"} disabled className="font-mono" />
            </div>
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <Input value={statement.status === "posted" ? "Proknjižen" : "Nacrt"} disabled />
            </div>
          </div>
          {!readOnly && (
            <Button onClick={handleSave} disabled={update.isPending} className="w-full">
              Sačuvaj izmene
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
