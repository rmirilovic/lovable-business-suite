import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AttributeDataType = 'text' | 'string' | 'predefined' | 'bit' | 'integer' | 'decimal' | 'date';

export interface ArticleAttribute {
  id: string;
  code: string;
  name: string;
  data_type: AttributeDataType;
  is_repeatable: boolean;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface AttributePredefinedValue {
  id: string;
  attribute_id: string;
  value: string;
  sort_order: number;
  created_at: string;
}

export interface ArticleAttributeAssignment {
  id: string;
  article_id: string;
  attribute_id: string;
  value: string;
  company_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  attribute?: ArticleAttribute;
}

export const DATA_TYPE_LABELS: Record<AttributeDataType, string> = {
  text: 'Tekst (do 511 karaktera)',
  string: 'Kratki tekst (do 31 karakter)',
  predefined: 'Predefinisana vrednost',
  bit: 'Da/Ne (0/1)',
  integer: 'Ceo broj (do 65535)',
  decimal: 'Decimalni broj (do 6 decimala)',
  date: 'Datum (YYYY-MM-DD)',
};

export const DATA_TYPE_SHORT_LABELS: Record<AttributeDataType, string> = {
  text: 'Tekst',
  string: 'String',
  predefined: 'Izbor',
  bit: 'Da/Ne',
  integer: 'Broj',
  decimal: 'Decimalni',
  date: 'Datum',
};

async function fetchAttributes(companyId: string): Promise<ArticleAttribute[]> {
  const { data, error } = await supabase
    .from("article_attributes")
    .select("*")
    .eq("company_id", companyId)
    .order("code");

  if (error) throw error;
  return (data || []) as ArticleAttribute[];
}

async function fetchPredefinedValues(attributeId: string): Promise<AttributePredefinedValue[]> {
  const { data, error } = await supabase
    .from("article_attribute_predefined_values")
    .select("*")
    .eq("attribute_id", attributeId)
    .order("sort_order")
    .order("value");

  if (error) throw error;
  return (data || []) as AttributePredefinedValue[];
}

async function fetchArticleAssignments(articleId: string): Promise<ArticleAttributeAssignment[]> {
  const { data, error } = await supabase
    .from("article_attribute_assignments")
    .select(`
      *,
      attribute:article_attributes(*)
    `)
    .eq("article_id", articleId)
    .order("created_at");

  if (error) throw error;
  return (data || []) as ArticleAttributeAssignment[];
}

export function useArticleAttributes(companyId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["article-attributes", companyId],
    queryFn: () => fetchAttributes(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["article-attributes", companyId] });
  };

  return {
    attributes: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    invalidate,
  };
}

export function usePredefinedValues(attributeId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["attribute-predefined-values", attributeId],
    queryFn: () => fetchPredefinedValues(attributeId!),
    enabled: !!attributeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["attribute-predefined-values", attributeId] });
  };

  return {
    values: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    invalidate,
  };
}

export function useArticleAssignments(articleId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["article-attribute-assignments", articleId],
    queryFn: () => fetchArticleAssignments(articleId!),
    enabled: !!articleId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["article-attribute-assignments", articleId] });
  };

  return {
    assignments: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    invalidate,
  };
}
