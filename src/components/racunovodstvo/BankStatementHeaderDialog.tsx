import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatNumber, parseLocaleNumber } from "@/lib/formatting";
import { BankStatement, useBankStatementMutations, useBankStatements } from "@/hooks/useBankStatements";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { AlertCircle } from "lucide-react";

interface BankStatementHeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statement: (BankStatement & { bank_accounts?: { code: string; account_number: string; bank_name: string } | null }) | null;
  readOnly?: boolean;
  onSaved?: () => void;
}


export function BankStatementHeaderDialog({
  open,
  onOpenChange,
  statement,
  readOnly = false,
  onSaved,
}: BankStatementHeaderDialogProps) {
  const { selectedCompany } = useAuth();
  const { minDate, maxDate } = useBusinessYearDateLimits();
  const { bankAccounts } = useBankAccounts(selectedCompany?.id);
  const { update } = useBankStatementMutations();
  const { data: allStatements } = useBankStatements();

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

  // Compute new statement number based on current date
  const computedNumber = useMemo(() => {
    if (!formData.statement_date || !statement) return null;
    const account = bankAccounts.find(ba => ba.id === formData.bank_account_id);
    if (!account) return null;
    const d = new Date(formData.statement_date);
    if (isNaN(d.getTime())) return null;
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}${mm}${dd}.${account.code}`;
  }, [formData.statement_date, formData.bank_account_id, bankAccounts, statement]);

  // Check for duplicates (same number or same date+bank_account, excluding current)
  const duplicateError = useMemo(() => {
    if (!statement || !allStatements || !computedNumber) return null;
    const others = allStatements.filter(s => s.id !== statement.id);
    
    if (others.some(s => s.statement_number === computedNumber)) {
      return `Izvod sa brojem ${computedNumber} već postoji`;
    }
    if (others.some(s => s.statement_date === formData.statement_date && s.bank_account_id === formData.bank_account_id)) {
      return `Izvod za ovaj TR sa datumom ${formData.statement_date} već postoji`;
    }
    return null;
  }, [statement, allStatements, computedNumber, formData.statement_date, formData.bank_account_id]);

  const dateChanged = statement && formData.statement_date !== statement.statement_date;

  const handleSave = async () => {
    if (!statement || duplicateError) return;
    const openingBalance = parseLocaleNumber(formData.opening_balance);
    await update.mutateAsync({
      id: statement.id,
      statement_date: formData.statement_date,
      statement_number: computedNumber || statement.statement_number,
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
            <Input
              value={dateChanged && computedNumber ? computedNumber : statement.statement_number}
              disabled
              className={`font-mono ${dateChanged && computedNumber && computedNumber !== statement.statement_number ? "text-primary font-semibold" : ""}`}
            />
            {dateChanged && computedNumber && computedNumber !== statement.statement_number && (
              <p className="text-xs text-muted-foreground mt-1">
                Broj će biti ažuriran sa {statement.statement_number} → {computedNumber}
              </p>
            )}
          </div>
          <div>
            <Label>Datum izvoda</Label>
            {readOnly ? (
              <Input value={formData.statement_date} disabled />
            ) : (
              <LocaleDateInput
                value={formData.statement_date}
                onChange={(v) => setFormData({ ...formData, statement_date: v })}
                minDate={minDate}
                maxDate={maxDate}
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
          {duplicateError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {duplicateError}
            </div>
          )}
          {!readOnly && (
            <Button onClick={handleSave} disabled={update.isPending || !!duplicateError} className="w-full">
              Sačuvaj izmene
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
