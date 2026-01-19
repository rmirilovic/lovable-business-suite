import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AttributeCount {
  article_id: string;
  count: number;
}

async function fetchAttributeCounts(companyId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("article_attribute_assignments")
    .select("article_id")
    .eq("company_id", companyId);

  if (error) throw error;

  // Count occurrences per article
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    counts[row.article_id] = (counts[row.article_id] || 0) + 1;
  }

  return counts;
}

export function useArticleAttributeCounts(companyId: string | undefined) {
  const query = useQuery({
    queryKey: ["article-attribute-counts", companyId],
    queryFn: () => fetchAttributeCounts(companyId!),
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // Fresh for 2 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
  });

  return {
    attributeCounts: query.data ?? {},
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
