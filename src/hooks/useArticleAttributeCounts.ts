import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AttributeInfo {
  code: string;
  name: string;
  value: string;
}

interface ArticleAttributeData {
  count: number;
  attributes: AttributeInfo[];
}

async function fetchAttributeData(companyId: string): Promise<Record<string, ArticleAttributeData>> {
  // Fetch assignments with attribute names and codes
  const { data: assignments, error: assignmentsError } = await supabase
    .from("article_attribute_assignments")
    .select(`
      article_id,
      value,
      attribute_id,
      article_attributes!inner(code, name)
    `)
    .eq("company_id", companyId);

  if (assignmentsError) throw assignmentsError;

  // Group by article_id
  const result: Record<string, ArticleAttributeData> = {};
  
  for (const row of assignments || []) {
    const articleId = row.article_id;
    const attrData = row.article_attributes as any;
    const attrCode = attrData?.code || "";
    const attrName = attrData?.name || "Nepoznat atribut";
    const attrValue = row.value;

    if (!result[articleId]) {
      result[articleId] = { count: 0, attributes: [] };
    }
    
    result[articleId].count++;
    result[articleId].attributes.push({ code: attrCode, name: attrName, value: attrValue });
  }

  // Sort attributes by code within each article
  for (const articleId in result) {
    result[articleId].attributes.sort((a, b) => a.code.localeCompare(b.code));
  }

  return result;
}

export function useArticleAttributeCounts(companyId: string | undefined) {
  const query = useQuery({
    queryKey: ["article-attribute-data", companyId],
    queryFn: () => fetchAttributeData(companyId!),
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Helper to get just count (for backward compatibility)
  const getCount = (articleId: string): number => {
    return query.data?.[articleId]?.count || 0;
  };

  // Helper to get attributes list
  const getAttributes = (articleId: string): AttributeInfo[] => {
    return query.data?.[articleId]?.attributes || [];
  };

  return {
    attributeData: query.data ?? {},
    getCount,
    getAttributes,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
