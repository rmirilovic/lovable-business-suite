import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SvkType = '0' | '1' | '2' | '6' | '8' | '9';

export interface Article {
  id: string;
  code: string;
  name: string;
  article_group: string | null;
  unit: string;
  purchase_price: number;
  selling_price: number;
  stock: number;
  min_stock: number;
  is_active: boolean;
  svk: SvkType | null;
  kg_po_jm: number | null;
  kol_mas: number | null;
}

async function fetchArticles(companyId: string): Promise<Article[]> {
  let allArticles: Article[] = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("company_id", companyId)
      .order("code")
      .range(from, from + batchSize - 1);

    if (error) throw error;

    if (!data || data.length === 0) break;

    allArticles = [...allArticles, ...data];

    if (data.length < batchSize) break;
    from += batchSize;
  }

  return allArticles;
}

export function useArticles(companyId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["articles", companyId],
    queryFn: () => fetchArticles(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  // Update a single article in the cache
  const updateArticleInCache = (updatedArticle: Article) => {
    queryClient.setQueryData<Article[]>(
      ["articles", companyId],
      (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((article) =>
          article.id === updatedArticle.id ? updatedArticle : article
        );
      }
    );
  };

  // Add a new article to the cache
  const addArticleToCache = (newArticle: Article) => {
    queryClient.setQueryData<Article[]>(
      ["articles", companyId],
      (oldData) => {
        if (!oldData) return [newArticle];
        return [...oldData, newArticle].sort((a, b) => a.code.localeCompare(b.code));
      }
    );
  };

  // Remove an article from the cache
  const removeArticleFromCache = (articleId: string) => {
    queryClient.setQueryData<Article[]>(
      ["articles", companyId],
      (oldData) => {
        if (!oldData) return oldData;
        return oldData.filter((article) => article.id !== articleId);
      }
    );
  };

  // Force refetch from server
  const refetch = () => {
    return query.refetch();
  };

  return {
    articles: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    updateArticleInCache,
    addArticleToCache,
    removeArticleFromCache,
    refetch,
  };
}
