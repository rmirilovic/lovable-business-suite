import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const CALCULATION_TYPE_LABELS: Record<string, string> = {
  redovna_zarada: "Redovna zarada",
  ugovor_o_delu: "Ugovor o delu",
  autorski_ugovor: "Autorski ugovor",
  vlasnik: "Vlasnik",
  penzioner: "Penzioner",
};

export interface PayrollCalculation {
  id: string;
  company_id: string;
  business_year_id: string;
  calculation_number: string;
  calculation_type: string;
  calculation_date: string;
  period_month: number;
  period_year: number;
  parameter_id: string | null;
  status: string;
  total_gross: number;
  total_net: number;
  total_tax: number;
  total_employee_contributions: number;
  total_employer_contributions: number;
  total_cost: number;
  total_meal_allowance: number;
  total_transport_allowance: number;
  note: string | null;
  created_by: string;
  posted_at: string | null;
  posted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollCalculationItem {
  id: string;
  calculation_id: string;
  company_id: string;
  employee_id: string;
  employee_number: string;
  employee_name: string;
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
  working_days: number;
  worked_days: number;
  hours_regular: number;
  hours_overtime: number;
  regres: number;
  meal_allowance: number;
  transport_allowance: number;
  other_additions: number;
  other_deductions: number;
  item_order: number;
  note: string | null;
  created_at: string;
}

export function usePayrollCalculations() {
  const { selectedCompany, selectedYear } = useAuth();

  return useQuery({
    queryKey: ["payroll_calculations", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_calculations")
        .select("*")
        .eq("company_id", selectedCompany!.id)
        .eq("business_year_id", selectedYear!.id)
        .order("calculation_date", { ascending: false });
      if (error) throw error;
      return data as PayrollCalculation[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });
}

export function usePayrollCalculation(id: string | undefined) {
  return useQuery({
    queryKey: ["payroll_calculation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_calculations")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as PayrollCalculation;
    },
    enabled: !!id && id !== "new",
  });
}

export function usePayrollCalculationItems(calculationId: string | undefined) {
  return useQuery({
    queryKey: ["payroll_calculation_items", calculationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_calculation_items")
        .select("*")
        .eq("calculation_id", calculationId!)
        .order("item_order");
      if (error) throw error;
      return data as PayrollCalculationItem[];
    },
    enabled: !!calculationId && calculationId !== "new",
  });
}

export function usePayrollCalculationMutations() {
  const { selectedCompany, selectedYear } = useAuth();
  const queryClient = useQueryClient();

  const createCalculation = useMutation({
    mutationFn: async (data: Partial<PayrollCalculation>) => {
      const { data: result, error } = await supabase
        .from("payroll_calculations")
        .insert({
          ...data,
          company_id: selectedCompany!.id,
          business_year_id: selectedYear!.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_calculations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCalculation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<PayrollCalculation> & { id: string }) => {
      const { error } = await supabase
        .from("payroll_calculations")
        .update({ ...data, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_calculations"] });
      queryClient.invalidateQueries({ queryKey: ["payroll_calculation"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCalculation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_calculations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_calculations"] });
      toast.success("Obračun obrisan");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveItems = useMutation({
    mutationFn: async ({ calculationId, items }: { calculationId: string; items: Partial<PayrollCalculationItem>[] }) => {
      // Delete existing items
      const { error: delError } = await supabase
        .from("payroll_calculation_items")
        .delete()
        .eq("calculation_id", calculationId);
      if (delError) throw delError;

      if (items.length > 0) {
        const { error } = await supabase
          .from("payroll_calculation_items")
          .insert(items.map((item, idx) => ({
            ...item,
            calculation_id: calculationId,
            company_id: selectedCompany!.id,
            item_order: idx,
          })) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_calculation_items"] });
      queryClient.invalidateQueries({ queryKey: ["payroll_calculations"] });
      queryClient.invalidateQueries({ queryKey: ["payroll_calculation"] });
      toast.success("Stavke obračuna sačuvane");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { createCalculation, updateCalculation, deleteCalculation, saveItems };
}
