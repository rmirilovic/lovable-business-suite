// Generator broja obračuna zarada
// Format: OZ-YYMMNN (YY = poslednje 2 cifre godine, MM = mesec 01-12, NN = redni broj 01-99 u tom mesecu)

export interface CalcNumberItem {
  calculation_number: string;
  period_month: number;
  period_year: number;
}

/**
 * Vraća prefiks za zadati period: OZ-YYMM
 */
export function payrollCalcPrefix(periodMonth: number, periodYear: number): string {
  const yy = String(periodYear % 100).padStart(2, "0");
  const mm = String(periodMonth).padStart(2, "0");
  return `OZ-${yy}${mm}`;
}

/**
 * Vraća sledeći raspoloživi broj obračuna za zadati mesec/godinu
 * Format: OBR-YYMMNN (npr. OBR-26040 1 -> "OBR-260401")
 */
export function generatePayrollCalcNumber(
  existing: CalcNumberItem[],
  periodMonth: number,
  periodYear: number,
  excludeId?: string
): string {
  const prefix = payrollCalcPrefix(periodMonth, periodYear);
  const re = new RegExp(`^${prefix}(\\d{2})$`);

  let maxN = 0;
  for (const c of existing) {
    if (excludeId && (c as any).id === excludeId) continue;
    const m = c.calculation_number?.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
  }
  const next = Math.min(maxN + 1, 99);
  return `${prefix}${String(next).padStart(2, "0")}`;
}

/**
 * Da li broj odgovara auto-generisanom šablonu (OBR-YYMMNN)?
 */
export function isAutoPayrollCalcNumber(value: string): boolean {
  return /^OBR-\d{6}$/.test(value || "");
}
