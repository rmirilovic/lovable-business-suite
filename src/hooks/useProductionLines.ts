import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProductionLine {
  id: string;
  company_id: string;
  code: number;
  name: string;
  production_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface ProductionLineHistoryEntry {
  id: string;
  production_line_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  changed_by: string | null;
  changed_at: string;
  profile?: { first_name: string | null; last_name: string | null; email: string | null };
}

export function useProductionLines() {
  const { selectedCompany, user } = useAuth();
  const qc = useQueryClient();
  const companyId = selectedCompany?.id;

  const query = useQuery({
    queryKey: ["production_lines", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_lines" as any)
        .select("*")
        .eq("company_id", companyId!)
        .order("code");
      if (error) throw error;
      return (data ?? []) as unknown as ProductionLine[];
    },
    enabled: !!companyId,
  });

  const upsert = useMutation({
    mutationFn: async (line: Partial<ProductionLine> & { code: number; name: string; production_type: string }) => {
      if (line.id) {
        const { error } = await supabase
          .from("production_lines" as any)
          .update({
            code: line.code,
            name: line.name,
            production_type: line.production_type,
            is_active: line.is_active ?? true,
            updated_by: user?.id ?? null,
          } as any)
          .eq("id", line.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("production_lines" as any)
          .insert({
            company_id: companyId!,
            code: line.code,
            name: line.name,
            production_type: line.production_type,
            is_active: line.is_active ?? true,
            created_by: user?.id ?? null,
            updated_by: user?.id ?? null,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production_lines", companyId] });
      toast.success("Sačuvano");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_lines" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production_lines", companyId] });
      toast.success("Obrisano");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, upsert, remove };
}

export async function fetchProductionLineHistory(productionLineId: string): Promise<ProductionLineHistoryEntry[]> {
  const { data, error } = await supabase
    .from("production_lines_history" as any)
    .select("*")
    .eq("production_line_id", productionLineId)
    .order("changed_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const userIds = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))];
  let profileMap = new Map<string, any>();
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", userIds);
    profileMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
  }
  return rows.map((r) => ({ ...r, profile: r.changed_by ? profileMap.get(r.changed_by) : undefined })) as ProductionLineHistoryEntry[];
}
