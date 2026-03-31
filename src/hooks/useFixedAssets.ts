import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface FixedAsset {
  id: string;
  company_id: string;
  inventory_number: string;
  name: string;
  description: string | null;
  group_id: string | null;
  acquisition_date: string;
  activation_date: string | null;
  acquisition_value: number;
  current_value: number;
  accumulated_depreciation: number;
  residual_value: number;
  depreciation_rate: number;
  useful_life_months: number | null;
  status: string;
  location: string | null;
  responsible_person: string | null;
  supplier_id: string | null;
  invoice_reference: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  fixed_asset_groups?: { code: string; name: string } | null;
  partners?: { name: string } | null;
}

export interface FixedAssetChange {
  id: string;
  company_id: string;
  fixed_asset_id: string;
  change_type: string;
  change_date: string;
  amount: number;
  description: string | null;
  document_reference: string | null;
  created_by: string;
  created_at: string;
}

export function useFixedAssets() {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;

  const query = useQuery({
    queryKey: ["fixed_assets", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_assets")
        .select("*, fixed_asset_groups(code, name), partners(name)")
        .eq("company_id", companyId!)
        .order("inventory_number");
      if (error) throw error;
      return data as FixedAsset[];
    },
    enabled: !!companyId,
  });

  const upsertAsset = useMutation({
    mutationFn: async (asset: Partial<FixedAsset> & { company_id: string }) => {
      const { fixed_asset_groups, partners, ...cleanAsset } = asset as any;
      if (cleanAsset.id) {
        const { data, error } = await supabase
          .from("fixed_assets")
          .update(cleanAsset)
          .eq("id", cleanAsset.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("fixed_assets")
          .insert(cleanAsset)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed_assets", companyId] });
      toast.success("Osnovno sredstvo sačuvano");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fixed_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed_assets", companyId] });
      toast.success("Osnovno sredstvo obrisano");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return { ...query, upsertAsset, deleteAsset };
}

export function useFixedAsset(id?: string) {
  return useQuery({
    queryKey: ["fixed_asset", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_assets")
        .select("*, fixed_asset_groups(code, name), partners(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as FixedAsset;
    },
    enabled: !!id && id !== "new",
  });
}

export function useFixedAssetChanges(assetId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["fixed_asset_changes", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_asset_changes")
        .select("*")
        .eq("fixed_asset_id", assetId!)
        .order("change_date", { ascending: false });
      if (error) throw error;
      return data as FixedAssetChange[];
    },
    enabled: !!assetId && assetId !== "new",
  });

  const addChange = useMutation({
    mutationFn: async (change: Omit<FixedAssetChange, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("fixed_asset_changes")
        .insert(change as any)
        .select()
        .single();
      if (error) throw error;

      // Update asset values based on change type
      const asset = await supabase.from("fixed_assets").select("*").eq("id", change.fixed_asset_id).single();
      if (asset.data) {
        let updates: any = {};
        const ct = change.change_type;
        if (ct === "depreciation") {
          updates.accumulated_depreciation = Number(asset.data.accumulated_depreciation) + Number(change.amount);
          updates.current_value = Number(asset.data.acquisition_value) - updates.accumulated_depreciation;
        } else if (ct === "write_off") {
          updates.accumulated_depreciation = Number(asset.data.acquisition_value);
          updates.current_value = 0;
          updates.status = "written_off";
        } else if (ct === "disposal") {
          updates.status = "disposed";
        } else if (ct === "revaluation" || ct === "value_adjustment") {
          updates.acquisition_value = Number(asset.data.acquisition_value) + Number(change.amount);
          updates.current_value = updates.acquisition_value - Number(asset.data.accumulated_depreciation);
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from("fixed_assets").update(updates).eq("id", change.fixed_asset_id);
        }
      }
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["fixed_asset_changes", vars.fixed_asset_id] });
      queryClient.invalidateQueries({ queryKey: ["fixed_asset", vars.fixed_asset_id] });
      queryClient.invalidateQueries({ queryKey: ["fixed_assets"] });
      toast.success("Promena evidentirana");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteChange = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fixed_asset_changes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed_asset_changes", assetId] });
      queryClient.invalidateQueries({ queryKey: ["fixed_asset", assetId] });
      queryClient.invalidateQueries({ queryKey: ["fixed_assets"] });
      toast.success("Promena obrisana");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return { ...query, addChange, deleteChange };
}
