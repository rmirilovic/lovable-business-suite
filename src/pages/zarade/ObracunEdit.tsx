import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calculator, ChevronDown, ChevronRight, FileText, Save, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  CALCULATION_TYPE_LABELS,
  PayrollCalculationItem,
  usePayrollCalculation,
  usePayrollCalculationItems,
  usePayrollCalculationMutations,
} from "@/hooks/usePayrollCalculations";
import { Employee, useEmployees } from "@/hooks/useEmployees";
import { DEDUCTION_TYPE_LABELS, EmployeeDeduction, useAllActiveDeductions } from "@/hooks/useEmployeeDeductions";
import { useActivePayrollParameter } from "@/hooks/usePayrollParameters";
import { useWorkHours } from "@/hooks/useWorkHours";
import { useAbsences } from "@/hooks/useAbsences";
import { parseLocaleNumber, formatPrice } from "@/lib/formatting";
import { calculateGrossFromNet, calculatePayroll } from "@/lib/payrollCalculator";
import { generateRfzoRefundPdf } from "@/lib/rfzoRefundPdfGenerator";
import { initializePdfFonts } from "@/lib/pdfFonts";

const MONTH_NAMES = ["Januar", "Februar", "Mart", "April", "Maj", "Jun", "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];

type InputMode = "bruto" | "neto";

export default function ObracunEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedYear, selectedCompany } = useAuth();
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
    input_mode: "bruto" as InputMode,
  });

  // Fetch work hours for the calculation period
  const { data: workHoursData } = useWorkHours(header.period_year, header.period_month);
  const { data: absences } = useAbsences();

  const [items, setItems] = useState<Partial<PayrollCalculationItem>[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const isPosted = calculation?.status === "posted";

  const deductionsByEmployee = useMemo(() => {
    const map: Record<string, EmployeeDeduction[]> = {};

    activeDeductions?.forEach((deduction) => {
      if (!deduction.is_active) return;
      if (deduction.is_credit && deduction.total_installments > 0 && deduction.paid_installments >= deduction.total_installments) return;
      if (!map[deduction.employee_id]) map[deduction.employee_id] = [];
      map[deduction.employee_id].push(deduction);
    });

    return map;
  }, [activeDeductions]);

  const toggleExpand = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const getEffectiveDeductionAmount = (deduction: EmployeeDeduction) => {
    if (deduction.is_credit && deduction.total_amount > 0) {
      const remaining = Math.max(deduction.total_amount - deduction.paid_amount, 0);
      return Math.min(deduction.amount_per_installment, remaining);
    }

    return deduction.amount_per_installment;
  };

  const getEmployeeDeductionsTotal = (employeeId: string | undefined) => {
    if (!employeeId) return 0;
    const employeeDeductions = deductionsByEmployee[employeeId] || [];
    return employeeDeductions.reduce((sum, deduction) => sum + getEffectiveDeductionAmount(deduction), 0);
  };

  const calculateSeniorityBonus = (employeeId: string | undefined, baseSalary: number, ratio: number): number => {
    if (!employeeId || !activeParam) return 0;
    const emp = employees?.find((e) => e.id === employeeId);
    if (!emp?.employment_date) return 0;
    const start = new Date(emp.employment_date);
    const now = new Date();
    if (start > now) return 0;
    const diffMs = now.getTime() - start.getTime();
    const fullYears = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
    if (fullYears <= 0) return 0;
    const rate = (activeParam as any).seniority_bonus_rate ?? 0.4;
    return Math.round(baseSalary * fullYears * rate / 100 * ratio * 100) / 100;
  };

  const calculateItemValues = (item: Partial<PayrollCalculationItem>, inputMode: InputMode): Partial<PayrollCalculationItem> => {
    if (!activeParam) return item;

    const deductionsTotal = getEmployeeDeductionsTotal(item.employee_id);
    const workingDays = item.working_days || 0;
    const workedDays = item.worked_days || 0;
    const ratio = workingDays > 0 ? workedDays / workingDays : 0;

    // Pro-rata supplements (taxable)
    const regres = Math.round(((activeParam as any).regres_daily || 0) * workedDays * 100) / 100;
    const mealAllowance = Math.round(((activeParam as any).meal_daily || 0) * workedDays * 100) / 100;

    // Transport: get from employee record, pro-rata by days
    const emp = employees?.find((e) => e.id === item.employee_id);
    const transportMonthly = (emp as any)?.transport_monthly || item.transport_allowance || 0;
    const transportAllowance = Math.round(transportMonthly * ratio * 100) / 100;

    const desiredNet = item.net_salary || 0;
    let baseSalary = item.gross_salary || 0;
    if (inputMode === "neto") {
      const totalGrossNeeded = calculateGrossFromNet(desiredNet + deductionsTotal, activeParam);
      baseSalary = Math.max(totalGrossNeeded - regres - mealAllowance - transportAllowance - (item.other_additions || 0), 0);
    }

    // Seniority bonus based on base salary and years at employer
    const seniorityBonus = calculateSeniorityBonus(item.employee_id, baseSalary, ratio);

    const result = calculatePayroll({
      baseSalary,
      seniorityBonus,
      regres,
      mealAllowance,
      transportAllowance,
      workingDays,
      workedDays,
      hoursRegular: item.hours_regular || 0,
      hoursOvertime: item.hours_overtime || 0,
      otherAdditions: item.other_additions || 0,
      otherDeductions: deductionsTotal,
    }, activeParam);

    return {
      ...item,
      ...result,
      gross_salary: baseSalary,
      seniority_bonus: seniorityBonus,
      other_deductions: 0,
      net_salary: inputMode === "neto" ? desiredNet : result.net_salary,
    };
  };

  useEffect(() => {
    if (!calculation) return;

    setHeader({
      calculation_number: calculation.calculation_number,
      calculation_type: calculation.calculation_type,
      calculation_date: calculation.calculation_date,
      period_month: calculation.period_month,
      period_year: calculation.period_year,
      note: calculation.note || "",
      input_mode: ((calculation as any).input_mode as InputMode) || "bruto",
    });
  }, [calculation]);

  useEffect(() => {
    if (!savedItems) return;

    if (!activeParam) {
      setItems(savedItems.map((item) => ({ ...item, other_deductions: 0 })));
      return;
    }

    const inputMode = ((calculation as any)?.input_mode as InputMode) || "bruto";
    setItems(savedItems.map((item) => calculateItemValues(item, inputMode)));
  }, [savedItems, activeParam, calculation, deductionsByEmployee]);

  const getWorkHoursForEmployee = (employeeId: string) => {
    const wh = workHoursData?.find((w) => w.employee_id === employeeId);
    return {
      working_days: wh?.working_days ?? 0,
      worked_days: wh?.worked_days ?? 0,
      hours_regular: wh?.hours_regular ?? 0,
      hours_overtime: wh?.hours_overtime ?? 0,
    };
  };

  const isSickLeaveType = header.calculation_type === "bolovanje_poslodavac" || header.calculation_type === "bolovanje_rfzo";

  const getEmployeeAbsenceForPeriod = (employeeId: string) => {
    if (!absences) return null;
    const absType = header.calculation_type === "bolovanje_poslodavac" ? "bolovanje_poslodavac" : "bolovanje_rfzo";
    return absences.find(a =>
      a.employee_id === employeeId &&
      a.absence_type === absType
    ) || null;
  };

  const addEmployee = (employee: Employee) => {
    if (items.some((item) => item.employee_id === employee.id)) {
      toast.error("Zaposleni je već dodat");
      return;
    }

    const wh = getWorkHoursForEmployee(employee.id);
    const contractedSalary = (employee as any).contracted_salary || 0;

    // For sick leave, use contracted salary as base (will be refined with avg salary on recalculate)
    let initialGross = 0;
    if (isSickLeaveType && contractedSalary > 0) {
      const absence = getEmployeeAbsenceForPeriod(employee.id);
      const rate = absence?.compensation_rate || (header.calculation_type === "bolovanje_poslodavac" ? (activeParam as any)?.sick_leave_employer_rate || 65 : 65);
      initialGross = Math.round(contractedSalary * rate / 100 * 100) / 100;
    } else if (contractedSalary > 0) {
      initialGross = contractedSalary;
    }

    setItems((prev) => [
      ...prev,
      {
        employee_id: employee.id,
        employee_number: employee.employee_number,
        employee_name: `${employee.last_name} ${employee.first_name}`,
        gross_salary: initialGross,
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
        ...wh,
        seniority_bonus: 0,
        meal_allowance: 0,
        transport_allowance: 0,
        other_additions: 0,
        other_deductions: 0,
      },
    ]);
  };

  const addAllEmployees = () => {
    if (!employees) return;

    const availableEmployees = employees.filter((employee) => employee.is_active && !items.some((item) => item.employee_id === employee.id));
    if (!availableEmployees.length) {
      toast.info("Svi aktivni zaposleni su već dodati");
      return;
    }

    setItems((prev) => [
      ...prev,
      ...availableEmployees.map((employee) => {
        const wh = getWorkHoursForEmployee(employee.id);
        const contractedSalary = (employee as any).contracted_salary || 0;

        let initialGross = 0;
        if (isSickLeaveType && contractedSalary > 0) {
          const absence = getEmployeeAbsenceForPeriod(employee.id);
          const rate = absence?.compensation_rate || (header.calculation_type === "bolovanje_poslodavac" ? (activeParam as any)?.sick_leave_employer_rate || 65 : 65);
          initialGross = Math.round(contractedSalary * rate / 100 * 100) / 100;
        } else if (contractedSalary > 0) {
          initialGross = contractedSalary;
        }

        return {
          employee_id: employee.id,
          employee_number: employee.employee_number,
          employee_name: `${employee.last_name} ${employee.first_name}`,
          gross_salary: initialGross,
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
          ...wh,
          meal_allowance: 0,
          transport_allowance: 0,
          other_additions: 0,
          other_deductions: 0,
        };
      }),
    ]);

    toast.success(`Dodato ${availableEmployees.length} zaposlenih`);
  };

  const handleExportRfzoPdf = async () => {
    if (header.calculation_type !== "bolovanje_rfzo") return;

    await initializePdfFonts();
    const company = selectedCompany as any;
    const rfzoItems = items.map((item) => {
      const emp = employees?.find(e => e.id === item.employee_id);
      const absence = absences?.find(a => a.employee_id === item.employee_id && a.absence_type === "bolovanje_rfzo");
      return {
        employee_number: item.employee_number || "",
        employee_name: item.employee_name || "",
        jmbg: emp?.jmbg || "",
        absence_start: absence?.start_date || "",
        absence_end: absence?.end_date || "",
        work_days: absence?.work_days || item.worked_days || 0,
        compensation_rate: absence?.compensation_rate || 65,
        average_salary: (emp as any)?.contracted_salary || item.gross_salary || 0,
        daily_amount: item.worked_days ? Math.round((item.gross_salary || 0) / item.worked_days * 100) / 100 : 0,
        total_amount: item.gross_salary || 0,
        gross_salary: (item.gross_salary || 0) + (item.regres || 0) + (item.meal_allowance || 0) + (item.transport_allowance || 0),
        pio_employee: item.pio_employee || 0,
        health_employee: item.health_employee || 0,
        unemployment: item.unemployment || 0,
        income_tax: item.income_tax || 0,
        pio_employer: item.pio_employer || 0,
        health_employer: item.health_employer || 0,
      };
    });

    const doc = generateRfzoRefundPdf({
      companyName: company?.name || "",
      companyPib: company?.pib || "",
      companyMb: company?.mb || "",
      companyAddress: company?.address || "",
      periodMonth: header.period_month,
      periodYear: header.period_year,
      items: rfzoItems,
    });

    doc.save(`RFZO_Refundacija_${header.period_month}_${header.period_year}.pdf`);
    toast.success("PDF za refundaciju generisan");
  };

  const recalculateItem = (idx: number) => {
    if (!activeParam) {
      toast.error("Nema aktivnih parametara obračuna");
      return;
    }

    setItems((prev) => prev.map((item, index) => (index === idx ? calculateItemValues(item, header.input_mode) : item)));
  };

  const recalculateAll = () => {
    if (!activeParam) {
      toast.error("Nema aktivnih parametara obračuna");
      return;
    }

    // Update work hours from evidence before recalculating
    setItems((prev) => prev.map((item) => {
      const wh = item.employee_id ? getWorkHoursForEmployee(item.employee_id) : {};
      return calculateItemValues({ ...item, ...wh }, header.input_mode);
    }));
    toast.success("Obračun rekalkulisan");
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, index) => index !== idx));
  };

  const updateItemField = (idx: number, field: string, value: number) => {
    setItems((prev) => prev.map((item, index) => (index === idx ? { ...item, [field]: value } : item)));
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
    } catch {
      // handled by mutation
    }
  };

  interface Totals { gross: number; seniority: number; regres: number; meal: number; transport: number; totalGross: number; net: number; tax: number; empContr: number; erlContr: number; cost: number; deductions: number; }
  const totals: Totals = useMemo(() => {
    const init: Totals = { gross: 0, seniority: 0, regres: 0, meal: 0, transport: 0, totalGross: 0, net: 0, tax: 0, empContr: 0, erlContr: 0, cost: 0, deductions: 0 };
    return items.reduce<Totals>((acc, item) => {
      return {
        gross: acc.gross + (item.gross_salary || 0),
        seniority: acc.seniority + (item.seniority_bonus || 0),
        regres: acc.regres + (item.regres || 0),
        meal: acc.meal + (item.meal_allowance || 0),
        transport: acc.transport + (item.transport_allowance || 0),
        totalGross: acc.totalGross + (item.gross_salary || 0) + (item.seniority_bonus || 0) + (item.regres || 0) + (item.meal_allowance || 0) + (item.transport_allowance || 0) + (item.other_additions || 0),
        net: acc.net + (item.net_salary || 0),
        tax: acc.tax + (item.income_tax || 0),
        empContr: acc.empContr + (item.total_employee_contributions || 0),
        erlContr: acc.erlContr + (item.total_employer_contributions || 0),
        cost: acc.cost + (item.total_cost || 0),
        deductions: acc.deductions + getEmployeeDeductionsTotal(item.employee_id),
      };
    }, init);
  }, [items, deductionsByEmployee]);

  const fmt = (value: number) => formatPrice(value);

  if (calcLoading) {
    return (
      <MainLayout title="Obračun zarada">
        <div className="p-8 text-center text-muted-foreground">Učitavanje...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={`Obračun ${header.calculation_number}`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/zarade/obracun")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Nazad
          </Button>
          <div className="flex-1" />
          <Badge variant={isPosted ? "default" : "secondary"} className="text-sm">
            {isPosted ? "Proknjižen" : "Nacrt"}
          </Badge>
          {!isPosted && (
            <>
              <Button variant="outline" size="sm" onClick={recalculateAll}>
                <Calculator className="mr-1 h-4 w-4" /> Rekalkuliši sve
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateCalculation.isPending || saveItems.isPending}>
                <Save className="mr-1 h-4 w-4" /> Sačuvaj
              </Button>
            </>
          )}
          {header.calculation_type === "bolovanje_rfzo" && items.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportRfzoPdf}>
              <FileText className="mr-1 h-4 w-4" /> RFZO Refundacija PDF
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 md:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">Broj obračuna</Label>
            <Input value={header.calculation_number} disabled={isPosted} onChange={(e) => setHeader({ ...header, calculation_number: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tip obračuna</Label>
            <Select value={header.calculation_type} disabled={isPosted} onValueChange={(value) => setHeader({ ...header, calculation_type: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CALCULATION_TYPE_LABELS).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Period</Label>
            <div className="flex gap-2">
              <Select value={String(header.period_month)} disabled={isPosted} onValueChange={(value) => setHeader({ ...header, period_month: parseInt(value) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((month, index) => (
                    <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>
                  ))}
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
            <LocaleDateInput value={header.calculation_date} onChange={(value) => setHeader({ ...header, calculation_date: value })} disabled={isPosted} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Režim unosa</Label>
            <Select value={header.input_mode} disabled={isPosted} onValueChange={(value) => setHeader({ ...header, input_mode: value as InputMode })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bruto">Unos Bruto</SelectItem>
                <SelectItem value="neto">Unos Neto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {!isPosted && (
          <div className="flex flex-wrap gap-2">
            <Select onValueChange={(employeeId) => {
              const employee = employees?.find((entry) => entry.id === employeeId);
              if (employee) addEmployee(employee);
            }}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Dodaj zaposlenog..." />
              </SelectTrigger>
              <SelectContent>
                {employees?.filter((employee) => employee.is_active).map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.employee_number} - {employee.last_name} {employee.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={addAllEmployees}>
              <UserPlus className="mr-1 h-4 w-4" /> Dodaj sve aktivne
            </Button>
          </div>
        )}

        <TableScrollContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="min-w-[60px]">Šifra</TableHead>
                <TableHead className="min-w-[140px]">Zaposleni</TableHead>
                <TableHead className="min-w-[50px] text-center">Rad. d.</TableHead>
                <TableHead className="min-w-[50px] text-center">Odr. d.</TableHead>
                <TableHead className="min-w-[110px] text-right">
                  {header.input_mode === "neto" ? <span className="text-muted-foreground">Osnovna <span className="text-xs">(izr.)</span></span> : "Osnovna"}
                </TableHead>
                <TableHead className="min-w-[80px] text-right">Min. rad</TableHead>
                <TableHead className="min-w-[80px] text-right">Regres</TableHead>
                <TableHead className="min-w-[80px] text-right">T. obrok</TableHead>
                <TableHead className="min-w-[80px] text-right">Prevoz</TableHead>
                <TableHead className="min-w-[110px] text-right">Uk. bruto</TableHead>
                <TableHead className="min-w-[90px] text-right">Porez</TableHead>
                <TableHead className="min-w-[90px] text-right">Dop. zap.</TableHead>
                <TableHead className="min-w-[90px] text-right">Dop. posl.</TableHead>
                <TableHead className="min-w-[90px] text-right">Obustave</TableHead>
                <TableHead className="min-w-[110px] text-right">
                  {header.input_mode === "neto" ? <span className="font-semibold">Neto <span className="text-xs">(unos)</span></span> : "Neto"}
                </TableHead>
                <TableHead className="min-w-[110px] text-right">Trošak</TableHead>
                {!isPosted && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!items.length ? (
                <TableRow>
                  <TableCell colSpan={isPosted ? 17 : 18} className="py-8 text-center text-muted-foreground">Dodajte zaposlene u obračun</TableCell>
                </TableRow>
              ) : items.map((item, idx) => {
                const employeeDeductions = deductionsByEmployee[item.employee_id || ""] || [];
                const deductionsTotal = employeeDeductions.reduce((sum, deduction) => sum + getEffectiveDeductionAmount(deduction), 0);
                const isExpanded = expandedRows.has(idx);

                return (
                  <React.Fragment key={item.employee_id || idx}>
                    <TableRow>
                      <TableCell className="px-1">
                        {employeeDeductions.length > 0 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(idx)}>
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.employee_number}</TableCell>
                      <TableCell className="text-sm font-medium">{item.employee_name}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{item.working_days || 0}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{item.worked_days || 0}</TableCell>
                      <TableCell className="text-right">
                        {isPosted || header.input_mode === "neto" ? (
                          <span className="font-mono">{fmt(item.gross_salary || 0)}</span>
                        ) : (
                          <LocaleNumberInput
                            className="h-8 w-28 text-right text-sm"
                            value={String(item.gross_salary ?? "")}
                            onChange={(value) => updateItemField(idx, "gross_salary", parseLocaleNumber(value))}
                            onBlur={() => recalculateItem(idx)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(item.seniority_bonus || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(item.regres || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(item.meal_allowance || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(item.transport_allowance || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">{fmt((item.gross_salary || 0) + (item.seniority_bonus || 0) + (item.regres || 0) + (item.meal_allowance || 0) + (item.transport_allowance || 0) + (item.other_additions || 0))}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(item.income_tax || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(item.total_employee_contributions || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(item.total_employer_contributions || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {deductionsTotal > 0 ? <span className="font-semibold text-destructive">{fmt(deductionsTotal)}</span> : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isPosted || header.input_mode === "bruto" ? (
                          <span className="font-mono font-semibold">{fmt(item.net_salary || 0)}</span>
                        ) : (
                          <LocaleNumberInput
                            className="h-8 w-28 text-right text-sm font-semibold"
                            value={String(item.net_salary ?? "")}
                            onChange={(value) => updateItemField(idx, "net_salary", parseLocaleNumber(value))}
                            onBlur={() => recalculateItem(idx)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(item.total_cost || 0)}</TableCell>
                      {!isPosted && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                    {isExpanded && employeeDeductions.map((deduction) => (
                      <TableRow key={deduction.id} className="bg-muted/20">
                        <TableCell />
                        <TableCell />
                        <TableCell colSpan={7} className="pl-8 text-xs text-muted-foreground">
                          {DEDUCTION_TYPE_LABELS[deduction.deduction_type] || deduction.deduction_type}
                          {deduction.description ? ` — ${deduction.description}` : ""}
                          {deduction.creditor_name ? ` (${deduction.creditor_name})` : ""}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {deduction.is_credit ? `Rata ${deduction.paid_installments + 1}/${deduction.total_installments}` : ""}
                        </TableCell>
                        <TableCell colSpan={3} />
                        <TableCell className="text-right font-mono text-xs">{fmt(getEffectiveDeductionAmount(deduction))}</TableCell>
                        <TableCell colSpan={isPosted ? 2 : 3} />
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })}
              {items.length > 0 && (
                <TableRow className="border-t-2 bg-muted/30 font-semibold">
                  <TableCell />
                  <TableCell colSpan={4} className="text-right">UKUPNO:</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totals.gross)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totals.seniority)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totals.regres)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totals.meal)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totals.transport)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totals.totalGross)}</TableCell>
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

        <div className="space-y-1">
          <Label className="text-xs">Napomena</Label>
          <Textarea value={header.note} disabled={isPosted} rows={2} onChange={(e) => setHeader({ ...header, note: e.target.value })} />
        </div>

        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
            {[
              { label: "Osnovna zarada", value: totals.gross },
              { label: "Minuli rad", value: totals.seniority },
              { label: "Ukupno bruto", value: totals.totalGross },
              { label: "Ukupno porez", value: totals.tax },
              { label: "Doprinosi zaposleni", value: totals.empContr },
              { label: "Doprinosi poslodavac", value: totals.erlContr },
              { label: "Obustave", value: totals.deductions },
              { label: "Ukupno neto", value: totals.net },
              { label: "Ukupan trošak", value: totals.cost },
            ].map((summary) => (
              <div key={summary.label} className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">{summary.label}</p>
                <p className="text-lg font-bold text-foreground font-mono">{fmt(summary.value)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
