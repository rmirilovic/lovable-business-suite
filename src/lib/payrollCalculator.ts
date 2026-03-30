import { PayrollParameter } from "@/hooks/usePayrollParameters";

export interface PayrollInput {
  baseSalary: number;
  seniorityBonus: number;
  regres: number;
  mealAllowance: number;
  transportAllowance: number;
  otherAdditions: number;
  otherDeductions: number;
  workingDays: number;
  workedDays: number;
  hoursRegular: number;
  hoursOvertime: number;
}

export interface PayrollResult {
  gross_salary: number;
  non_taxable_amount: number;
  tax_base: number;
  income_tax: number;
  pio_employee: number;
  pio_employer: number;
  health_employee: number;
  health_employer: number;
  unemployment: number;
  total_employee_contributions: number;
  total_employer_contributions: number;
  net_salary: number;
  total_cost: number;
  seniority_bonus: number;
  regres: number;
  meal_allowance: number;
  transport_allowance: number;
  other_additions: number;
  other_deductions: number;
  working_days: number;
  worked_days: number;
  hours_regular: number;
  hours_overtime: number;
}

/**
 * Calculate gross from desired net (reverse).
 * desiredNet is the "clean net" = totalGross - contributions - tax.
 * Supplements (regres, meal, transport) are NOT part of desiredNet here —
 * they will be added separately in the UI before calling this.
 */
export function calculateGrossFromNet(desiredNet: number, params: PayrollParameter): number {
  if (desiredNet <= 0) return 0;

  const rateSum = (params.pio_employee_rate + params.health_employee_rate + params.unemployment_rate + params.income_tax_rate) / 100;
  const taxCredit = params.non_taxable_amount * params.income_tax_rate / 100;
  let gross = (desiredNet - taxCredit) / (1 - rateSum);

  for (let i = 0; i < 20; i++) {
    const result = calculatePayroll({
      baseSalary: gross,
      seniorityBonus: 0, regres: 0, mealAllowance: 0, transportAllowance: 0,
      otherAdditions: 0, otherDeductions: 0,
      workingDays: 0, workedDays: 0,
      hoursRegular: 0, hoursOvertime: 0,
    }, params);
    const cleanNet = result.gross_salary - result.total_employee_contributions - result.income_tax;
    const diff = desiredNet - cleanNet;
    if (Math.abs(diff) < 0.01) break;
    gross += diff;
  }

  return Math.round(gross * 100) / 100;
}

/**
 * Calculate payroll per RS regulations.
 * Gross = baseSalary + regres + mealAllowance + transportAllowance + otherAdditions
 * All supplements are TAXABLE and included in contribution/tax base.
 */
export function calculatePayroll(input: PayrollInput, params: PayrollParameter): PayrollResult {
  // Total gross includes all taxable supplements
  const gross = Math.round(
    (input.baseSalary + input.regres + input.mealAllowance + input.transportAllowance + input.otherAdditions) * 100
  ) / 100;

  // Contribution bases
  const pioBase = Math.min(Math.max(gross, params.min_base_pio), params.max_base_pio);
  const healthBase = Math.max(gross, params.min_base_health);

  // Employee contributions
  const pioEmployee = Math.round(pioBase * params.pio_employee_rate) / 100;
  const healthEmployee = Math.round(healthBase * params.health_employee_rate) / 100;
  const unemployment = Math.round(gross * params.unemployment_rate) / 100;
  const totalEmployeeContributions = Math.round((pioEmployee + healthEmployee + unemployment) * 100) / 100;

  // Tax
  const nonTaxable = params.non_taxable_amount;
  const taxBase = Math.max(gross - nonTaxable, 0);
  const incomeTax = Math.round(taxBase * params.income_tax_rate) / 100;

  // Net = gross - contributions - tax - deductions
  const netSalary = Math.round(
    (gross - totalEmployeeContributions - incomeTax - input.otherDeductions) * 100
  ) / 100;

  // Employer contributions
  const pioEmployer = Math.round(pioBase * params.pio_employer_rate) / 100;
  const healthEmployer = Math.round(healthBase * params.health_employer_rate) / 100;
  const totalEmployerContributions = Math.round((pioEmployer + healthEmployer) * 100) / 100;

  // Total cost
  const totalCost = Math.round((gross + totalEmployerContributions) * 100) / 100;

  return {
    gross_salary: gross,
    non_taxable_amount: nonTaxable,
    tax_base: taxBase,
    income_tax: incomeTax,
    pio_employee: pioEmployee,
    pio_employer: pioEmployer,
    health_employee: healthEmployee,
    health_employer: healthEmployer,
    unemployment,
    total_employee_contributions: totalEmployeeContributions,
    total_employer_contributions: totalEmployerContributions,
    net_salary: netSalary,
    total_cost: totalCost,
    regres: input.regres,
    meal_allowance: input.mealAllowance,
    transport_allowance: input.transportAllowance,
    other_additions: input.otherAdditions,
    other_deductions: input.otherDeductions,
    working_days: input.workingDays,
    worked_days: input.workedDays,
    hours_regular: input.hoursRegular,
    hours_overtime: input.hoursOvertime,
  };
}
