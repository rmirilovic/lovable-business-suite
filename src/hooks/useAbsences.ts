import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Absence {
  id: string;
  company_id: string;
  employee_id: string;
  absence_type: string;
  start_date: string;
  end_date: string;
  work_days: number;
  compensation_rate: number | null;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const ABSENCE_TYPE_LABELS: Record<string, string> = {
  godisnji_odmor: "Godišnji odmor",
  bolovanje: "Bolovanje",
  bolovanje_poslodavac: "Bolovanje na teret poslodavca (do 30 dana)",
  bolovanje_rfzo: "Bolovanje na teret RFZO (preko 30 dana)",
  placeno_odsustvo: "Plaćeno odsustvo",
  neplaceno_odsustvo: "Neplaćeno odsustvo",
};

export const ABSENCE_TYPE_COLORS: Record<string, string> = {
  godisnji_odmor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  bolovanje: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  bolovanje_poslodavac: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  bolovanje_rfzo: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  placeno_odsustvo: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  neplaceno_odsustvo: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export function useAbsences() {
  const { selectedCompany } = useAuth();
  return useQuery({
    queryKey: ["absences", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from("employee_absences")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as Absence[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useAbsence(id?: string) {
  return useQuery({
    queryKey: ["absence", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("employee_absences")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Absence;
    },
    enabled: !!id,
  });
}

export function useCreateAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("employee_absences")
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["absences"] });
      toast.success("Odsustvo je kreirano");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase
        .from("employee_absences")
        .update({ ...payload, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["absences"] });
      qc.invalidateQueries({ queryKey: ["absence"] });
      toast.success("Odsustvo je ažurirano");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from("employee_absences")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["absences"] });
      toast.success("Odsustvo je obrisano");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEmployeeAbsenceSummary(employeeId?: string, year?: number) {
  const { selectedCompany } = useAuth();
  return useQuery({
    queryKey: ["absence-summary", selectedCompany?.id, employeeId, year],
    queryFn: async () => {
      if (!selectedCompany?.id || !employeeId || !year) return null;
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      const { data, error } = await supabase
        .from("employee_absences")
        .select("absence_type, work_days")
        .eq("company_id", selectedCompany.id)
        .eq("employee_id", employeeId)
        .gte("start_date", startOfYear)
        .lte("start_date", endOfYear);
      if (error) throw error;
      const summary: Record<string, number> = {
        godisnji_odmor: 0,
        bolovanje: 0,
        bolovanje_poslodavac: 0,
        bolovanje_rfzo: 0,
        placeno_odsustvo: 0,
        neplaceno_odsustvo: 0,
      };
      for (const row of data || []) {
        summary[row.absence_type] = (summary[row.absence_type] || 0) + row.work_days;
      }
      return summary;
    },
    enabled: !!selectedCompany?.id && !!employeeId && !!year,
  });
}
