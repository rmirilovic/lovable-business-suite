import { PayrollParameter } from "@/hooks/usePayrollParameters";

export interface PayrollInput {
  grossSalary: number;
  workingDays: number;
  workedDays: number;
  hoursRegular: number;
  hoursOvertime: number;
  mealAllowance: number;
  transportAllowance: number;
  otherAdditions: number;
  otherDeductions: number;
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
 * Calculate payroll per RS regulations.
 * Gross → contributions → tax → net
 */
export function calculatePayroll(input: PayrollInput, params: PayrollParameter): PayrollResult {
  const gross = Math.round(input.grossSalary * 100) / 100;

  // Ensure gross is within contribution base limits
  const pioBase = Math.min(Math.max(gross, params.min_base_pio), params.max_base_pio);
  const healthBase = Math.max(gross, params.min_base_health);

  // Employee contributions
  const pioEmployee = Math.round(pioBase * params.pio_employee_rate) / 100;
  const healthEmployee = Math.round(healthBase * params.health_employee_rate) / 100;
  const unemployment = Math.round(gross * params.unemployment_rate) / 100;
  const totalEmployeeContributions = Math.round((pioEmployee + healthEmployee + unemployment) * 100) / 100;

  // Tax base = gross - non_taxable_amount
  const nonTaxable = params.non_taxable_amount;
  const taxBase = Math.max(gross - nonTaxable, 0);
  const incomeTax = Math.round(taxBase * params.income_tax_rate) / 100;

  // Net = gross - employee contributions - tax + additions - deductions
  const netSalary = Math.round(
    (gross - totalEmployeeContributions - incomeTax + input.mealAllowance + input.transportAllowance + input.otherAdditions - input.otherDeductions) * 100
  ) / 100;

  // Employer contributions
  const pioEmployer = Math.round(pioBase * params.pio_employer_rate) / 100;
  const healthEmployer = Math.round(healthBase * params.health_employer_rate) / 100;
  const totalEmployerContributions = Math.round((pioEmployer + healthEmployer) * 100) / 100;

  // Total cost to employer
  const totalCost = Math.round((gross + totalEmployerContributions + input.mealAllowance + input.transportAllowance) * 100) / 100;

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
