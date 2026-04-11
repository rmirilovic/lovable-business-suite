import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ArticleVariant {
  id: string;
  company_id: string;
  code: string;
  length_value: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ArticleVariantAssignment {
  id: string;
  company_id: string;
  article_id: string;
  variant_id: string;
  created_at: string;
  variant?: ArticleVariant;
}

export function useArticleVariants(companyId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["article-variants", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_variants")
        .select("*")
        .eq("company_id", companyId!)
        .order("code");
      if (error) throw error;
      return data as ArticleVariant[];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const createVariant = useMutation({
    mutationFn: async (form: { code: string; length_value: number; description: string }) => {
      const { data, error } = await supabase
        .from("article_variants")
        .insert({ ...form, company_id: companyId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-variants", companyId] });
      toast.success("Varijanta uspešno kreirana");
    },
    onError: (e: any) => {
      if (e.code === "23505") toast.error("Varijanta sa ovom šifrom već postoji");
      else toast.error("Greška: " + e.message);
    },
  });

  const updateVariant = useMutation({
    mutationFn: async ({ id, ...form }: { id: string; code: string; length_value: number; description: string }) => {
      const { error } = await supabase.from("article_variants").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-variants", companyId] });
      toast.success("Varijanta uspešno ažurirana");
    },
    onError: (e: any) => toast.error("Greška: " + e.message),
  });

  const deleteVariant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("article_variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-variants", companyId] });
      toast.success("Varijanta obrisana");
    },
    onError: (e: any) => toast.error("Greška: " + e.message),
  });

  return {
    variants: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    createVariant,
    updateVariant,
    deleteVariant,
  };
}

export function useArticleVariantAssignments(articleId: string | undefined, companyId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["article-variant-assignments", articleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_variant_assignments")
        .select("*, variant:article_variants(*)")
        .eq("article_id", articleId!)
        .order("created_at");
      if (error) throw error;
      return data as unknown as ArticleVariantAssignment[];
    },
    enabled: !!articleId,
    staleTime: 2 * 60 * 1000,
  });

  const assignVariant = useMutation({
    mutationFn: async (variantId: string) => {
      const { error } = await supabase.from("article_variant_assignments").insert({
        article_id: articleId!,
        variant_id: variantId,
        company_id: companyId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-variant-assignments", articleId] });
      toast.success("Varijanta dodeljena");
    },
    onError: (e: any) => {
      if (e.code === "23505") toast.error("Varijanta je već dodeljena ovom artiklu");
      else toast.error("Greška: " + e.message);
    },
  });

  const removeAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from("article_variant_assignments").delete().eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-variant-assignments", articleId] });
      toast.success("Varijanta uklonjena");
    },
    onError: (e: any) => toast.error("Greška: " + e.message),
  });

  return {
    assignments: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    assignVariant,
    removeAssignment,
  };
}
