import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PayrollParameter {
  id: string;
  company_id: string;
  valid_from: string;
  valid_to: string | null;
  income_tax_rate: number;
  pio_employee_rate: number;
  pio_employer_rate: number;
  health_employee_rate: number;
  health_employer_rate: number;
  unemployment_rate: number;
  non_taxable_amount: number;
  min_base_pio: number;
  max_base_pio: number;
  min_base_health: number;
  regres_daily: number;
  meal_daily: number;
  sick_leave_employer_rate: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export function usePayrollParameters() {
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;

  return useQuery({
    queryKey: ["payroll_parameters", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_parameters")
        .select("*")
        .eq("company_id", companyId!)
        .order("valid_from", { ascending: false });
      if (error) throw error;
      return data as PayrollParameter[];
    },
    enabled: !!companyId,
  });
}

export function useActivePayrollParameter() {
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;

  return useQuery({
    queryKey: ["payroll_parameters_active", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_parameters")
        .select("*")
        .eq("company_id", companyId!)
        .eq("is_active", true)
        .order("valid_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as PayrollParameter | null;
    },
    enabled: !!companyId,
  });
}

export function usePayrollParameterMutations() {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;

  const createParameter = useMutation({
    mutationFn: async (data: Partial<PayrollParameter>) => {
      const { error } = await supabase.from("payroll_parameters").insert({
        ...data,
        company_id: companyId!,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_parameters"] });
      toast.success("Parametri obračuna sačuvani");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateParameter = useMutation({
    mutationFn: async ({ id, ...data }: Partial<PayrollParameter> & { id: string }) => {
      const { error } = await supabase
        .from("payroll_parameters")
        .update({ ...data, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_parameters"] });
      toast.success("Parametri obračuna ažurirani");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteParameter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_parameters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_parameters"] });
      toast.success("Parametri obrisani");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { createParameter, updateParameter, deleteParameter };
}
