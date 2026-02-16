import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MaterialNorm {
  id: string;
  company_id: string;
  article_id: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  // joined
  article_code?: string;
  article_name?: string;
  article_unit?: string;
}

export interface MaterialNormVariant {
  id: string;
  norm_id: string;
  company_id: string;
  variant_number: number;
  variant_name: string;
  is_default: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialNormItem {
  id: string;
  variant_id: string;
  company_id: string;
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  qty_per_kg: number;
  qty_per_m: number;
  qty_per_pc: number;
  item_order: number;
  created_at: string;
}

export function useMaterialNorms(companyId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["material_norms", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_norms")
        .select("*, articles!material_norms_article_id_fkey(code, name, unit)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((n: any) => ({
        id: n.id,
        company_id: n.company_id,
        article_id: n.article_id,
        note: n.note,
        created_at: n.created_at,
        updated_at: n.updated_at,
        article_code: n.articles?.code,
        article_name: n.articles?.name,
        article_unit: n.articles?.unit,
      })) as MaterialNorm[];
    },
    enabled: !!companyId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["material_norms", companyId] });

  return { norms: query.data ?? [], isLoading: query.isLoading, error: query.error, invalidate };
}

export function useMaterialNorm(normId: string | undefined) {
  return useQuery({
    queryKey: ["material_norm", normId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_norms")
        .select("*, articles!material_norms_article_id_fkey(code, name, unit)")
        .eq("id", normId!)
        .single();

      if (error) throw error;

      return {
        ...data,
        article_code: (data as any).articles?.code,
        article_name: (data as any).articles?.name,
        article_unit: (data as any).articles?.unit,
      } as MaterialNorm;
    },
    enabled: !!normId,
  });
}

export function useMaterialNormVariants(normId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["material_norm_variants", normId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_norm_variants")
        .select("*")
        .eq("norm_id", normId!)
        .order("variant_number");

      if (error) throw error;
      return data as MaterialNormVariant[];
    },
    enabled: !!normId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["material_norm_variants", normId] });

  return { variants: query.data ?? [], isLoading: query.isLoading, invalidate };
}

export function useMaterialNormItems(variantId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["material_norm_items", variantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_norm_items")
        .select("*")
        .eq("variant_id", variantId!)
        .order("item_order");

      if (error) throw error;
      return data as MaterialNormItem[];
    },
    enabled: !!variantId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["material_norm_items", variantId] });

  return { items: query.data ?? [], isLoading: query.isLoading, invalidate };
}
