import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const DEDUCTION_TYPE_LABELS: Record<string, string> = {
  alimentacija: "Alimentacija",
  izvrsenje: "Izvršenje",
  kredit_banka: "Kredit banka",
  kredit_firma: "Kredit firma",
  administrativna_zabrana: "Administrativna zabrana",
  sindikat: "Sindikat",
  dobrovoljni_pio: "Dobrovoljni PIO",
  osiguranje: "Osiguranje",
  dug_radnika: "Dug radnika firmi",
  manjak: "Manjak",
  akontacija: "Akontacija",
  ostale_obustave: "Ostale obustave",
};

export const CREDIT_DEDUCTION_TYPES = ["kredit_banka", "kredit_firma", "administrativna_zabrana"];

export interface EmployeeDeduction {
  id: string;
  company_id: string;
  employee_id: string;
  deduction_type: string;
  description: string;
  creditor_name: string | null;
  reference_number: string | null;
  amount_per_installment: number;
  total_amount: number;
  total_installments: number;
  paid_installments: number;
  paid_amount: number;
  is_active: boolean;
  is_credit: boolean;
  start_date: string | null;
  end_date: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export function useEmployeeDeductions(employeeId?: string) {
  const { selectedCompany } = useAuth();

  return useQuery({
    queryKey: ["employee_deductions", selectedCompany?.id, employeeId],
    queryFn: async () => {
      let query = supabase
        .from("employee_deductions")
        .select("*")
        .eq("company_id", selectedCompany!.id)
        .order("created_at", { ascending: false });

      if (employeeId) {
        query = query.eq("employee_id", employeeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmployeeDeduction[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useAllActiveDeductions() {
  const { selectedCompany } = useAuth();

  return useQuery({
    queryKey: ["employee_deductions_active", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_deductions")
        .select("*")
        .eq("company_id", selectedCompany!.id)
        .eq("is_active", true)
        .order("employee_id");
      if (error) throw error;
      return data as EmployeeDeduction[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useEmployeeDeductionMutations() {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const createDeduction = useMutation({
    mutationFn: async (data: Partial<EmployeeDeduction>) => {
      const isCredit = CREDIT_DEDUCTION_TYPES.includes(data.deduction_type || "");
      const { data: result, error } = await supabase
        .from("employee_deductions")
        .insert({
          ...data,
          company_id: selectedCompany!.id,
          is_credit: isCredit,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee_deductions"] });
      toast.success("Obustava kreirana");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateDeduction = useMutation({
    mutationFn: async ({ id, ...data }: Partial<EmployeeDeduction> & { id: string }) => {
      const isCredit = CREDIT_DEDUCTION_TYPES.includes(data.deduction_type || "");
      const { error } = await supabase
        .from("employee_deductions")
        .update({ ...data, is_credit: isCredit, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee_deductions"] });
      toast.success("Obustava ažurirana");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDeduction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_deductions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee_deductions"] });
      toast.success("Obustava obrisana");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { createDeduction, updateDeduction, deleteDeduction };
}
