import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface WorkHour {
  id: string;
  company_id: string;
  employee_id: string;
  business_year_id: string;
  year: number;
  month: number;
  working_days: number;
  worked_days: number;
  hours_regular: number;
  hours_overtime: number;
  hours_holiday: number;
  hours_night: number;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useWorkHours(year: number, month: number) {
  const { selectedCompany } = useAuth();

  return useQuery({
    queryKey: ["work-hours", selectedCompany?.id, year, month],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const { data, error } = await (supabase as any)
        .from("work_hours")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .eq("year", year)
        .eq("month", month);

      if (error) throw error;
      return (data || []) as WorkHour[];
    },
    enabled: !!selectedCompany?.id && !!year && !!month,
  });
}

export function useUpsertWorkHours() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: Omit<WorkHour, "id" | "created_at" | "updated_at">[]) => {
      const { data, error } = await (supabase as any)
        .from("work_hours")
        .upsert(rows, { onConflict: "company_id,employee_id,year,month" })
        .select();

      if (error) throw error;
      return data as WorkHour[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-hours"] });
      toast.success("Evidencija radnog vremena sačuvana");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });
}
