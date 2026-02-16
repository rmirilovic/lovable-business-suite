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
  article_group?: string | null;
  article_kg_po_jm?: number | null;
  article_kol_mas?: number | null;
  variant_count?: number;
  approved_variant_count?: number;
}

export interface MaterialNormVariant {
  id: string;
  norm_id: string;
  company_id: string;
  variant_number: number;
  variant_name: string;
  is_default: boolean;
  status: string;
  approved_at: string | null;
  approved_by: string | null;
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
      // Fetch all norms with batch pagination to avoid 1000 row limit
      let allNorms: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      while (true) {
        const { data: page, error } = await supabase
          .from("material_norms")
          .select("*, articles!material_norms_article_id_fkey(code, name, unit, article_group, kg_po_jm, kol_mas)")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        allNorms = allNorms.concat(page ?? []);
        if (!page || page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      // Fetch variant counts per norm (batched + parallel)
      const normIds = allNorms.map((n: any) => n.id);
      let variantCounts: Record<string, { total: number; approved: number }> = {};

      if (normIds.length > 0) {
        const BATCH_SIZE = 100;
        const batches: string[][] = [];
        for (let i = 0; i < normIds.length; i += BATCH_SIZE) {
          batches.push(normIds.slice(i, i + BATCH_SIZE));
        }

        const results = await Promise.all(
          batches.map((batch) =>
            supabase
              .from("material_norm_variants")
              .select("norm_id, status")
              .in("norm_id", batch)
              .limit(5000)
          )
        );

        for (const { data: variants } of results) {
          for (const v of variants ?? []) {
            if (!variantCounts[v.norm_id]) {
              variantCounts[v.norm_id] = { total: 0, approved: 0 };
            }
            variantCounts[v.norm_id].total++;
            if (v.status === "approved") {
              variantCounts[v.norm_id].approved++;
            }
          }
        }
      }

      return allNorms.map((n: any) => ({
        id: n.id,
        company_id: n.company_id,
        article_id: n.article_id,
        note: n.note,
        created_at: n.created_at,
        updated_at: n.updated_at,
        article_code: n.articles?.code,
        article_name: n.articles?.name,
        article_unit: n.articles?.unit,
        article_group: n.articles?.article_group,
        article_kg_po_jm: n.articles?.kg_po_jm,
        article_kol_mas: n.articles?.kol_mas,
        variant_count: variantCounts[n.id]?.total ?? 0,
        approved_variant_count: variantCounts[n.id]?.approved ?? 0,
      })) as MaterialNorm[];
    },
    enabled: !!companyId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["material_norms", companyId] });

  return { norms: query.data ?? [], isLoading: query.isLoading, error: query.error, invalidate };
}

export function useMaterialNorm(normId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["material_norm", normId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_norms")
        .select("*, articles!material_norms_article_id_fkey(code, name, unit, article_group, kg_po_jm, kol_mas)")
        .eq("id", normId!)
        .single();

      if (error) throw error;

      return {
        ...data,
        article_code: (data as any).articles?.code,
        article_name: (data as any).articles?.name,
        article_unit: (data as any).articles?.unit,
        article_group: (data as any).articles?.article_group,
        article_kg_po_jm: (data as any).articles?.kg_po_jm,
        article_kol_mas: (data as any).articles?.kol_mas,
      } as MaterialNorm;
    },
    enabled: !!normId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["material_norm", normId] });

  return { data: query.data, isLoading: query.isLoading, invalidate };
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
