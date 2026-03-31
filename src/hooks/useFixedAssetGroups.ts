import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface FixedAssetGroup {
  id: string;
  company_id: string;
  code: string;
  name: string;
  depreciation_rate: number;
  account_code: string | null;
  depreciation_expense_account: string | null;
  accumulated_depreciation_account: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useFixedAssetGroups() {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;

  const query = useQuery({
    queryKey: ["fixed_asset_groups", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_asset_groups")
        .select("*")
        .eq("company_id", companyId!)
        .order("sort_order");
      if (error) throw error;
      return data as FixedAssetGroup[];
    },
    enabled: !!companyId,
  });

  const upsertGroup = useMutation({
    mutationFn: async (group: Partial<FixedAssetGroup> & { company_id: string }) => {
      if (group.id) {
        const { data, error } = await supabase
          .from("fixed_asset_groups")
          .update(group)
          .eq("id", group.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("fixed_asset_groups")
          .insert(group)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed_asset_groups", companyId] });
      toast.success("Grupa sačuvana");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fixed_asset_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed_asset_groups", companyId] });
      toast.success("Grupa obrisana");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return { ...query, upsertGroup, deleteGroup };
}
