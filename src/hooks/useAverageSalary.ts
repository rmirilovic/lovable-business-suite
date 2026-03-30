import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AverageSalaryResult {
  avg_3: number;
  avg_6: number;
  avg_12: number;
  months_found: number;
  fallback_contracted: number;
  effective_base: number; // whichever is used
}

/**
 * Calculate average gross salary for an employee over past 3, 6, 12 months.
 * Falls back to contracted_salary from employee card if insufficient data.
 */
export function useAverageSalary(employeeId?: string, referenceYear?: number, referenceMonth?: number) {
  const { selectedCompany } = useAuth();

  return useQuery({
    queryKey: ["average_salary", selectedCompany?.id, employeeId, referenceYear, referenceMonth],
    queryFn: async () => {
      if (!selectedCompany?.id || !employeeId || !referenceYear || !referenceMonth) return null;

      // Fetch past payroll items for this employee (only posted or any status)
      const { data: items, error } = await supabase
        .from("payroll_calculation_items")
        .select("gross_salary, meal_allowance, transport_allowance, regres, other_additions")
        .eq("company_id", selectedCompany.id)
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Also get contracted salary from employee
      const { data: empData } = await (supabase as any)
        .from("employees")
        .select("contracted_salary")
        .eq("id", employeeId)
        .single();

      const contractedSalary = empData?.contracted_salary || 0;

      // We need to get the calculation headers to filter by period
      // For simplicity, fetch calculation items joined with calculation period
      const { data: detailedItems, error: err2 } = await supabase
        .from("payroll_calculation_items")
        .select(`
          gross_salary,
          calculation_id
        `)
        .eq("company_id", selectedCompany.id)
        .eq("employee_id", employeeId);

      if (err2) throw err2;

      // Get all calculations to map periods
      const calcIds = [...new Set((detailedItems || []).map(i => i.calculation_id))];
      if (calcIds.length === 0) {
        return {
          avg_3: contractedSalary,
          avg_6: contractedSalary,
          avg_12: contractedSalary,
          months_found: 0,
          fallback_contracted: contractedSalary,
          effective_base: contractedSalary,
        } as AverageSalaryResult;
      }

      const { data: calcs } = await supabase
        .from("payroll_calculations")
        .select("id, period_month, period_year, calculation_type")
        .in("id", calcIds)
        .eq("calculation_type", "redovna_zarada");

      // Build monthly salary map
      const monthlySalaries: { year: number; month: number; gross: number }[] = [];
      for (const calc of calcs || []) {
        const calcItems = (detailedItems || []).filter(i => i.calculation_id === calc.id);
        const totalGross = calcItems.reduce((s, i) => s + (i.gross_salary || 0), 0);
        if (totalGross > 0) {
          monthlySalaries.push({ year: calc.period_year, month: calc.period_month, gross: totalGross });
        }
      }

      // Sort descending (most recent first), exclude current month
      monthlySalaries.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

      const pastMonths = monthlySalaries.filter(m => {
        if (m.year < referenceYear) return true;
        if (m.year === referenceYear && m.month < referenceMonth) return true;
        return false;
      });

      const calcAvg = (n: number) => {
        const slice = pastMonths.slice(0, n);
        if (slice.length === 0) return contractedSalary;
        return Math.round(slice.reduce((s, m) => s + m.gross, 0) / slice.length * 100) / 100;
      };

      const avg3 = calcAvg(3);
      const avg6 = calcAvg(6);
      const avg12 = calcAvg(12);

      return {
        avg_3: avg3,
        avg_6: avg6,
        avg_12: avg12,
        months_found: pastMonths.length,
        fallback_contracted: contractedSalary,
        effective_base: pastMonths.length >= 3 ? avg12 : contractedSalary,
      } as AverageSalaryResult;
    },
    enabled: !!selectedCompany?.id && !!employeeId && !!referenceYear && !!referenceMonth,
  });
}
