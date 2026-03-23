import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Employee {
  id: string;
  company_id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  jmbg: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  education_level: string | null;
  job_title: string | null;
  org_unit_id: string | null;
  employment_date: string | null;
  employment_type: string;
  contract_end_date: string | null;
  work_experience_years: number;
  work_experience_months: number;
  bank_account: string | null;
  is_active: boolean;
  status: string;
  termination_date: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  neodredjeno: "Neodređeno",
  odredjeno: "Određeno",
  probni: "Probni rad",
  privremeni: "Privremeni",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Aktivan",
  terminated: "Raskinut",
  suspended: "Suspendovan",
  maternity: "Porodiljsko",
};

export const EDUCATION_LEVELS = [
  "I - Nezavršena osnovna škola",
  "II - Osnovna škola",
  "III - Srednja škola (3 godine)",
  "IV - Srednja škola (4 godine)",
  "V - Viša škola",
  "VI-1 - Osnovne akademske studije",
  "VI-2 - Specijalističke strukovne studije",
  "VII-1 - Master/Diplomirani",
  "VII-2 - Specijalizacija/Magistratura",
  "VIII - Doktorat",
];

export function useEmployees() {
  const { selectedCompany } = useAuth();

  return useQuery({
    queryKey: ["employees", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const { data, error } = await (supabase as any)
        .from("employees")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("employee_number");

      if (error) throw error;
      return (data || []) as Employee[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await (supabase as any)
        .from("employees")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Employee;
    },
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employee: Omit<Employee, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any)
        .from("employees")
        .insert(employee)
        .select()
        .single();

      if (error) throw error;
      return data as Employee;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["employees", data.company_id] });
      toast.success("Zaposleni uspešno kreiran");
    },
    onError: (error: Error) => {
      if (error.message.includes("employees_company_id_employee_number_key")) {
        toast.error("Šifra zaposlenog već postoji");
      } else {
        toast.error(`Greška: ${error.message}`);
      }
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Employee> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("employees")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Employee;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["employees", data.company_id] });
      queryClient.invalidateQueries({ queryKey: ["employee", data.id] });
      toast.success("Zaposleni ažuriran");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await (supabase as any).from("employees").delete().eq("id", id);
      if (error) throw error;
      return { companyId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["employees", variables.companyId] });
      toast.success("Zaposleni obrisan");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });
}

export function useNextEmployeeNumber() {
  const { selectedCompany } = useAuth();

  return useQuery({
    queryKey: ["next-employee-number", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return "001";

      const { data, error } = await (supabase as any)
        .from("employees")
        .select("employee_number")
        .eq("company_id", selectedCompany.id)
        .order("employee_number", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) return "001";

      const lastNum = parseInt(data[0].employee_number, 10);
      if (isNaN(lastNum)) return "001";

      return String(lastNum + 1).padStart(3, "0");
    },
    enabled: !!selectedCompany?.id,
  });
}
