import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Classification {
  id: string;
  code: string;
  name: string;
  parent_code: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface ClassificationNode extends Classification {
  children: ClassificationNode[];
  level: number;
}

async function fetchClassifications(companyId: string): Promise<Classification[]> {
  const { data, error } = await supabase
    .from("article_classifications")
    .select("*")
    .eq("company_id", companyId)
    .order("code");

  if (error) throw error;
  return data || [];
}

// Build tree structure from flat list
export function buildTree(classifications: Classification[]): ClassificationNode[] {
  const map = new Map<string, ClassificationNode>();
  const roots: ClassificationNode[] = [];

  // First pass: create nodes
  classifications.forEach((c) => {
    map.set(c.code, { ...c, children: [], level: 0 });
  });

  // Second pass: build tree
  classifications.forEach((c) => {
    const node = map.get(c.code)!;
    if (c.parent_code && map.has(c.parent_code)) {
      const parent = map.get(c.parent_code)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort children at each level
  const sortChildren = (nodes: ClassificationNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

// Flatten tree for table display with proper ordering
export function flattenTree(nodes: ClassificationNode[]): ClassificationNode[] {
  const result: ClassificationNode[] = [];
  
  const traverse = (nodes: ClassificationNode[], level: number) => {
    nodes.forEach((node) => {
      result.push({ ...node, level });
      if (node.children.length > 0) {
        traverse(node.children, level + 1);
      }
    });
  };
  
  traverse(nodes, 0);
  return result;
}

export function useClassifications(companyId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["classifications", companyId],
    queryFn: () => fetchClassifications(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refetch = () => query.refetch();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["classifications", companyId] });
  };

  return {
    classifications: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}
