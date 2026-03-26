import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface LeaveFund {
  id: string;
  company_id: string;
  employee_id: string;
  year: number;
  total_days: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export function useLeaveFunds(year?: number) {
  const { selectedCompany } = useAuth();
  return useQuery({
    queryKey: ["leave-funds", selectedCompany?.id, year],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      let q = supabase
        .from("employee_leave_funds")
        .select("*")
        .eq("company_id", selectedCompany.id);
      if (year) q = q.eq("year", year);
      const { data, error } = await q.order("year", { ascending: false });
      if (error) throw error;
      return data as LeaveFund[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useUpsertLeaveFund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      company_id: string;
      employee_id: string;
      year: number;
      total_days: number;
      note?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("employee_leave_funds")
        .upsert(payload as any, { onConflict: "company_id,employee_id,year" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-funds"] });
      toast.success("Fond odmora je sačuvan");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
