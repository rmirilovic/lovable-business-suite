import { useState, useEffect } from "react";
import { addMonths, lastDayOfMonth, format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { parseLocaleNumber } from "@/lib/formatting";
import {
  EmployeeDeduction,
  useEmployeeDeductionMutations,
  DEDUCTION_TYPE_LABELS,
  CREDIT_DEDUCTION_TYPES,
} from "@/hooks/useEmployeeDeductions";
import { useEmployees } from "@/hooks/useEmployees";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deduction: EmployeeDeduction | null;
}

export function DeductionDialog({ open, onOpenChange, deduction }: Props) {
  const { data: employees } = useEmployees();
  const { createDeduction, updateDeduction } = useEmployeeDeductionMutations();
  const isEdit = !!deduction;

  const [form, setForm] = useState({
    employee_id: "",
    deduction_type: "ostale_obustave",
    description: "",
    creditor_name: "",
    reference_number: "",
    amount_per_installment: 0,
    total_amount: 0,
    total_installments: 0,
    paid_installments: 0,
    paid_amount: 0,
    is_active: true,
    start_date: "",
    end_date: "",
    note: "",
  });

  useEffect(() => {
    if (deduction) {
      setForm({
        employee_id: deduction.employee_id,
        deduction_type: deduction.deduction_type,
        description: deduction.description,
        creditor_name: deduction.creditor_name || "",
        reference_number: deduction.reference_number || "",
        amount_per_installment: deduction.amount_per_installment,
        total_amount: deduction.total_amount,
        total_installments: deduction.total_installments,
        paid_installments: deduction.paid_installments,
        paid_amount: deduction.paid_amount,
        is_active: deduction.is_active,
        start_date: deduction.start_date || "",
        end_date: deduction.end_date || "",
        note: deduction.note || "",
      });
    } else {
      setForm({
        employee_id: "",
        deduction_type: "ostale_obustave",
        description: "",
        creditor_name: "",
        reference_number: "",
        amount_per_installment: 0,
        total_amount: 0,
        total_installments: 0,
        paid_installments: 0,
        paid_amount: 0,
        is_active: true,
        start_date: "",
        end_date: "",
        note: "",
      });
    }
  }, [deduction, open]);

  const isCredit = CREDIT_DEDUCTION_TYPES.includes(form.deduction_type);

  // Auto-calculate installment amount when total/installments/paid change
  const recalcInstallment = (updates: Partial<typeof form>) => {
    const merged = { ...form, ...updates };
    const total = merged.total_amount;
    const installments = merged.total_installments;
    const paidAmount = merged.paid_amount;
    if (installments > 0 && total > 0) {
      const remaining = Math.max(total - paidAmount, 0);
      const remainingInstallments = Math.max(installments - merged.paid_installments, 1);
      updates.amount_per_installment = Math.round((remaining / remainingInstallments) * 100) / 100;
    }
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    if (!form.employee_id) return;
    const payload = {
      ...form,
      creditor_name: form.creditor_name || null,
      reference_number: form.reference_number || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      note: form.note || null,
    };

    if (isEdit) {
      await updateDeduction.mutateAsync({ id: deduction!.id, ...payload });
    } else {
      await createDeduction.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Izmena obustave" : "Nova obustava"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Employee */}
          <div className="space-y-1">
            <Label className="text-xs">Zaposleni *</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })} disabled={isEdit}>
              <SelectTrigger><SelectValue placeholder="Izaberite zaposlenog" /></SelectTrigger>
              <SelectContent>
                {employees?.filter((e) => e.is_active).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.employee_number} - {e.last_name} {e.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-1">
            <Label className="text-xs">Tip obustave</Label>
            <Select value={form.deduction_type} onValueChange={(v) => setForm({ ...form, deduction_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DEDUCTION_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs">Opis</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          {/* Credit-specific fields */}
          {isCredit && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Kreditor / Poverilac</Label>
                  <Input value={form.creditor_name} onChange={(e) => setForm({ ...form, creditor_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Referentni broj</Label>
                  <Input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Ukupan iznos kredita</Label>
                  <LocaleNumberInput
                    value={String(form.total_amount)}
                    onChange={(v) => recalcInstallment({ total_amount: parseLocaleNumber(v) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ukupno rata</Label>
                  <Input
                    type="number"
                    value={form.total_installments}
                    onChange={(e) => recalcInstallment({ total_installments: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Otplaćeno rata</Label>
                  <Input
                    type="number"
                    value={form.paid_installments}
                    onChange={(e) => recalcInstallment({ paid_installments: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Otplaćeni iznos</Label>
                  <LocaleNumberInput
                    value={String(form.paid_amount)}
                    onChange={(v) => recalcInstallment({ paid_amount: parseLocaleNumber(v) })}
                  />
                </div>
              </div>
            </>
          )}

          {/* Amount per installment */}
          <div className="space-y-1">
            <Label className="text-xs">{isCredit ? "Iznos rate" : "Iznos obustave"}</Label>
            <LocaleNumberInput
              value={String(form.amount_per_installment)}
              onChange={(v) => setForm({ ...form, amount_per_installment: parseLocaleNumber(v) })}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Datum početka</Label>
              <LocaleDateInput value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Datum završetka</Label>
              <LocaleDateInput value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />
            </div>
          </div>

          {/* Active */}
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label className="text-sm">Aktivna obustava</Label>
          </div>

          {/* Note */}
          <div className="space-y-1">
            <Label className="text-xs">Napomena</Label>
            <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Otkaži</Button>
          <Button onClick={handleSave} disabled={!form.employee_id || createDeduction.isPending || updateDeduction.isPending}>
            {isEdit ? "Sačuvaj izmene" : "Kreiraj obustavu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
