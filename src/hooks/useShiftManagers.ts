import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ShiftManager {
  id: string;
  company_id: string;
  slot_number: number;
  first_name: string;
  last_name: string;
}

export function useShiftManagers() {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;

  const query = useQuery({
    queryKey: ["shift-managers", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from("shift_managers")
        .select("*")
        .eq("company_id", companyId)
        .order("slot_number");
      if (error) throw error;

      // If fewer than 3 records, insert missing slots
      const existing = (data as ShiftManager[]) || [];
      const existingSlots = existing.map((r) => r.slot_number);
      const missing = [1, 2, 3].filter((s) => !existingSlots.includes(s));

      if (missing.length > 0) {
        const rows = missing.map((slot_number) => ({
          company_id: companyId,
          slot_number,
          first_name: "",
          last_name: "",
        }));
        const { data: inserted, error: insErr } = await (supabase as any)
          .from("shift_managers")
          .insert(rows)
          .select("*");
        if (insErr) throw insErr;
        return [...existing, ...(inserted as ShiftManager[])].sort(
          (a, b) => a.slot_number - b.slot_number
        );
      }

      return existing;
    },
    enabled: !!companyId,
  });

  const updateManager = useMutation({
    mutationFn: async ({
      id,
      first_name,
      last_name,
    }: {
      id: string;
      first_name: string;
      last_name: string;
    }) => {
      const { error } = await (supabase as any)
        .from("shift_managers")
        .update({ first_name, last_name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-managers"] });
      toast.success("Šef smene ažuriran");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  return {
    managers: query.data ?? [],
    isLoading: query.isLoading,
    updateManager,
  };
}
