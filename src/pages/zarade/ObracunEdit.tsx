import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { ArrowLeft, Save, UserPlus, Calculator, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  usePayrollCalculation,
  usePayrollCalculationItems,
  usePayrollCalculationMutations,
  CALCULATION_TYPE_LABELS,
  PayrollCalculationItem,
} from "@/hooks/usePayrollCalculations";
import { useActivePayrollParameter } from "@/hooks/usePayrollParameters";
import { useEmployees, Employee } from "@/hooks/useEmployees";
import { useAllActiveDeductions, DEDUCTION_TYPE_LABELS, EmployeeDeduction } from "@/hooks/useEmployeeDeductions";
import { calculatePayroll } from "@/lib/payrollCalculator";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice, parseLocaleNumber } from "@/lib/formatting";

const MONTH_NAMES = ["Januar", "Februar", "Mart", "April", "Maj", "Jun", "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];

export default function ObracunEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, selectedYear } = useAuth();
  const isNew = id === "new";

  const { data: calculation, isLoading: calcLoading } = usePayrollCalculation(id);
  const { data: savedItems } = usePayrollCalculationItems(id);
  const { data: activeParam } = useActivePayrollParameter();
  const { data: employees } = useEmployees();
  const { data: activeDeductions } = useAllActiveDeductions();
  const { updateCalculation, saveItems } = usePayrollCalculationMutations();

  const [header, setHeader] = useState({
    calculation_number: "",
    calculation_type: "redovna_zarada",
    calculation_date: new Date().toISOString().slice(0, 10),
    period_month: new Date().getMonth() + 1,
    period_year: selectedYear?.year || new Date().getFullYear(),
    note: "",
  });

  const [items, setItems] = useState<Partial<PayrollCalculationItem>[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const isPosted = calculation?.status === "posted";

  // Map of employee_id -> active deductions
  const deductionsByEmployee = useMemo(() => {
    const map: Record<string, EmployeeDeduction[]> = {};
    activeDeductions?.forEach((d) => {
      if (!d.is_active) return;
      // Skip paid-off credits
      if (d.is_credit && d.total_installments > 0 && d.paid_installments >= d.total_installments) return;
      if (!map[d.employee_id]) map[d.employee_id] = [];
      map[d.employee_id].push(d);
    });
    return map;
  }, [activeDeductions]);

  const toggleExpand = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  useEffect(() => {
    if (calculation) {
      setHeader({
        calculation_number: calculation.calculation_number,
        calculation_type: calculation.calculation_type,
        calculation_date: calculation.calculation_date,
        period_month: calculation.period_month,
        period_year: calculation.period_year,
        note: calculation.note || "",
      });
    }
  }, [calculation]);

  useEffect(() => {
    if (savedItems) setItems(savedItems);
  }, [savedItems]);

  const addEmployee = (emp: Employee) => {
    if (items.some((i) => i.employee_id === emp.id)) {
      toast.error("Zaposleni je već dodat");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        employee_id: emp.id,
        employee_number: emp.employee_number,
        employee_name: `${emp.last_name} ${emp.first_name}`,
        gross_salary: 0,
        non_taxable_amount: activeParam?.non_taxable_amount || 25000,
        tax_base: 0,
        income_tax: 0,
        pio_employee: 0,
        pio_employer: 0,
        health_employee: 0,
        health_employer: 0,
        unemployment: 0,
        total_employee_contributions: 0,
        total_employer_contributions: 0,
        net_salary: 0,
        total_cost: 0,
        working_days: 22,
        worked_days: 22,
        hours_regular: 176,
        hours_overtime: 0,
        meal_allowance: 0,
        transport_allowance: 0,
        other_additions: 0,
        other_deductions: 0,
      },
    ]);
  };

  const addAllEmployees = () => {
    if (!employees) return;
    const active = employees.filter((e) => e.is_active && !items.some((i) => i.employee_id === e.id));
    if (!active.length) { toast.info("Svi aktivni zaposleni su već dodati"); return; }
    setItems((prev) => [
      ...prev,
      ...active.map((emp) => ({
        employee_id: emp.id,
        employee_number: emp.employee_number,
        employee_name: `${emp.last_name} ${emp.first_name}`,
        gross_salary: 0,
        non_taxable_amount: activeParam?.non_taxable_amount || 25000,
        tax_base: 0, income_tax: 0,
        pio_employee: 0, pio_employer: 0,
        health_employee: 0, health_employer: 0,
        unemployment: 0,
        total_employee_contributions: 0, total_employer_contributions: 0,
        net_salary: 0, total_cost: 0,
        working_days: 22, worked_days: 22,
        hours_regular: 176, hours_overtime: 0,
        meal_allowance: 0, transport_allowance: 0,
        other_additions: 0, other_deductions: 0,
      })),
    ]);
    toast.success(`Dodato ${active.length} zaposlenih`);
  };

  const getEmployeeDeductionsTotal = (employeeId: string | undefined) => {
    if (!employeeId) return 0;
    const deds = deductionsByEmployee[employeeId] || [];
    return deds.reduce((sum, d) => sum + d.amount_per_installment, 0);
  };

  const recalculateItem = (idx: number) => {
    if (!activeParam) { toast.error("Nema aktivnih parametara obračuna"); return; }
    const item = items[idx];
    const deductionsTotal = getEmployeeDeductionsTotal(item.employee_id);
    const result = calculatePayroll({
      grossSalary: item.gross_salary || 0,
      workingDays: item.working_days || 0,
      workedDays: item.worked_days || 0,
      hoursRegular: item.hours_regular || 0,
      hoursOvertime: item.hours_overtime || 0,
      mealAllowance: item.meal_allowance || 0,
      transportAllowance: item.transport_allowance || 0,
      otherAdditions: item.other_additions || 0,
      otherDeductions: deductionsTotal + (item.other_deductions || 0),
    }, activeParam);
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...result } : it)));
  };

  const recalculateAll = () => {
    if (!activeParam) { toast.error("Nema aktivnih parametara obračuna"); return; }
    setItems((prev) =>
      prev.map((item) => {
        const deductionsTotal = getEmployeeDeductionsTotal(item.employee_id);
        const result = calculatePayroll({
          grossSalary: item.gross_salary || 0,
          workingDays: item.working_days || 0,
          workedDays: item.worked_days || 0,
          hoursRegular: item.hours_regular || 0,
          hoursOvertime: item.hours_overtime || 0,
          mealAllowance: item.meal_allowance || 0,
          transportAllowance: item.transport_allowance || 0,
          otherAdditions: item.other_additions || 0,
          otherDeductions: deductionsTotal + (item.other_deductions || 0),
        }, activeParam);
        return { ...item, ...result };
      })
    );
    toast.success("Obračun rekalkulisan");
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItemField = (idx: number, field: string, value: number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const handleSave = async () => {
    if (!id || isNew) return;
    try {
      await updateCalculation.mutateAsync({
        id,
        ...header,
        note: header.note || null,
        parameter_id: activeParam?.id || null,
      } as any);
      await saveItems.mutateAsync({ calculationId: id, items });
    } catch { /* handled by mutation */ }
  };

  const totals = useMemo(() => {
    const base = items.reduce(
      (acc, it) => ({
        gross: acc.gross + (it.gross_salary || 0),
        net: acc.net + (it.net_salary || 0),
        tax: acc.tax + (it.income_tax || 0),
        empContr: acc.empContr + (it.total_employee_contributions || 0),
        erlContr: acc.erlContr + (it.total_employer_contributions || 0),
        cost: acc.cost + (it.total_cost || 0),
        deductions: acc.deductions + (deductionsByEmployee[it.employee_id || ""] || []).reduce((s, d) => s + d.amount_per_installment, 0),
      }),
      { gross: 0, net: 0, tax: 0, empContr: 0, erlContr: 0, cost: 0, deductions: 0 }
    );
    return base;
  }, [items, deductionsByEmployee]);

  const fmt = (n: number) => formatPrice(n);

  if (calcLoading) return <MainLayout title="Obračun zarada"><div className="p-8 text-center text-muted-foreground">Učitavanje...</div></MainLayout>;

  return (
    <MainLayout title={`Obračun ${header.calculation_number}`}>
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate("/zarade/obracun")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Nazad
          </Button>
          <div className="flex-1" />
          <Badge variant={isPosted ? "default" : "secondary"} className="text-sm">
            {isPosted ? "Proknjižen" : "Nacrt"}
          </Badge>
          {!isPosted && (
            <>
              <Button variant="outline" size="sm" onClick={recalculateAll}>
                <Calculator className="w-4 h-4 mr-1" /> Rekalkuliši sve
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateCalculation.isPending || saveItems.isPending}>
                <Save className="w-4 h-4 mr-1" /> Sačuvaj
              </Button>
            </>
          )}
        </div>

        {/* Header */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border rounded-lg p-4 bg-card">
          <div className="space-y-1">
            <Label className="text-xs">Broj obračuna</Label>
            <Input value={header.calculation_number} disabled={isPosted}
              onChange={(e) => setHeader({ ...header, calculation_number: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tip obračuna</Label>
            <Select value={header.calculation_type} disabled={isPosted}
              onValueChange={(v) => setHeader({ ...header, calculation_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CALCULATION_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Period</Label>
            <div className="flex gap-2">
              <Select value={String(header.period_month)} disabled={isPosted}
                onValueChange={(v) => setHeader({ ...header, period_month: parseInt(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <LocaleNumberInput
                value={String(header.period_year)}
                className="w-24"
                decimalPlaces={0}
                disabled={isPosted}
                onChange={(value) => setHeader({ ...header, period_year: parseInt(String(parseLocaleNumber(value))) || header.period_year })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum obračuna</Label>
            <LocaleDateInput
              value={header.calculation_date}
              onChange={(value) => setHeader({ ...header, calculation_date: value })}
              disabled={isPosted}
              required
            />
          </div>
        </div>

        {/* Add employees */}
        {!isPosted && (
          <div className="flex gap-2 flex-wrap">
            <Select onValueChange={(empId) => {
              const emp = employees?.find((e) => e.id === empId);
              if (emp) addEmployee(emp);
            }}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Dodaj zaposlenog..." />
              </SelectTrigger>
              <SelectContent>
                {employees?.filter((e) => e.is_active).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.employee_number} - {e.last_name} {e.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={addAllEmployees}>
              <UserPlus className="w-4 h-4 mr-1" /> Dodaj sve aktivne
            </Button>
          </div>
        )}

        {/* Items table */}
        <TableScrollContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="min-w-[60px]">Šifra</TableHead>
                <TableHead className="min-w-[160px]">Zaposleni</TableHead>
                <TableHead className="min-w-[120px] text-right">Bruto</TableHead>
                <TableHead className="min-w-[100px] text-right">Porez</TableHead>
                <TableHead className="min-w-[100px] text-right">Dop. zap.</TableHead>
                <TableHead className="min-w-[100px] text-right">Dop. posl.</TableHead>
                <TableHead className="min-w-[100px] text-right">Obustave</TableHead>
                <TableHead className="min-w-[120px] text-right">Neto</TableHead>
                <TableHead className="min-w-[120px] text-right">Trošak</TableHead>
                {!isPosted && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!items.length ? (
                <TableRow><TableCell colSpan={isPosted ? 10 : 11} className="text-center py-8 text-muted-foreground">Dodajte zaposlene u obračun</TableCell></TableRow>
              ) : items.map((item, idx) => {
                const empDeds = deductionsByEmployee[item.employee_id || ""] || [];
                const dedsTotal = empDeds.reduce((s, d) => s + d.amount_per_installment, 0);
                const isExpanded = expandedRows.has(idx);

                return (
                  <React.Fragment key={item.employee_id || idx}>
                    <TableRow>
                      <TableCell className="px-1">
                        {empDeds.length > 0 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(idx)}>
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.employee_number}</TableCell>
                      <TableCell className="font-medium text-sm">{item.employee_name}</TableCell>
                      <TableCell className="text-right">
                        {isPosted ? (
                          <span className="font-mono">{fmt(item.gross_salary || 0)}</span>
                        ) : (
                          <LocaleNumberInput
                            className="text-right w-28 h-8 text-sm"
                            value={String(item.gross_salary ?? "")}
                            onChange={(value) => updateItemField(idx, "gross_salary", parseLocaleNumber(value))}
                            onBlur={() => recalculateItem(idx)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(item.income_tax || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(item.total_employee_contributions || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(item.total_employer_contributions || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {dedsTotal > 0 ? (
                          <span className="text-destructive font-semibold">{fmt(dedsTotal)}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">{fmt(item.net_salary || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(item.total_cost || 0)}</TableCell>
                      {!isPosted && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                    {isExpanded && empDeds.map((ded) => (
                      <TableRow key={ded.id} className="bg-muted/20">
                        <TableCell />
                        <TableCell />
                        <TableCell colSpan={2} className="text-xs text-muted-foreground pl-8">
                          {DEDUCTION_TYPE_LABELS[ded.deduction_type] || ded.deduction_type}
                          {ded.description ? ` — ${ded.description}` : ""}
                          {ded.creditor_name ? ` (${ded.creditor_name})` : ""}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground text-center">
                          {ded.is_credit ? `Rata ${ded.paid_installments + 1}/${ded.total_installments}` : ""}
                        </TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right font-mono text-xs">{fmt(ded.amount_per_installment)}</TableCell>
                        <TableCell colSpan={isPosted ? 2 : 3} />
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })}
              {items.length > 0 && (
                <TableRow className="border-t-2 font-semibold bg-muted/30">
                  <TableCell />
                  <TableCell colSpan={2} className="text-right">UKUPNO:</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totals.gross)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totals.tax)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totals.empContr)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totals.erlContr)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totals.deductions)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totals.net)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totals.cost)}</TableCell>
                  {!isPosted && <TableCell />}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>

        {/* Note */}
        <div className="space-y-1">
          <Label className="text-xs">Napomena</Label>
          <Textarea value={header.note} disabled={isPosted} rows={2}
            onChange={(e) => setHeader({ ...header, note: e.target.value })} />
        </div>

        {/* Summary cards */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            {[
              { label: "Ukupno bruto", value: totals.gross },
              { label: "Ukupno porez", value: totals.tax },
              { label: "Doprinosi zaposleni", value: totals.empContr },
              { label: "Doprinosi poslodavac", value: totals.erlContr },
              { label: "Obustave", value: totals.deductions },
              { label: "Ukupno neto", value: totals.net },
              { label: "Ukupan trošak", value: totals.cost },
            ].map((s) => (
              <div key={s.label} className="border rounded-lg p-3 bg-card">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold font-mono text-foreground">{fmt(s.value)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
