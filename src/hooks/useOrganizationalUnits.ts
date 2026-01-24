import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrganizationalUnit {
  id: string;
  code: string;
  name: string;
  parent_code: string | null;
  is_active: boolean;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationalUnitNode extends OrganizationalUnit {
  children: OrganizationalUnitNode[];
  level: number;
}

async function fetchOrganizationalUnits(companyId: string): Promise<OrganizationalUnit[]> {
  const { data, error } = await supabase
    .from("organizational_units")
    .select("*")
    .eq("company_id", companyId)
    .order("code");

  if (error) throw error;
  return data || [];
}

// Build tree structure from flat list
export function buildOrgTree(units: OrganizationalUnit[]): OrganizationalUnitNode[] {
  const map = new Map<string, OrganizationalUnitNode>();
  const roots: OrganizationalUnitNode[] = [];

  // First pass: create nodes
  units.forEach((u) => {
    map.set(u.code, { ...u, children: [], level: 0 });
  });

  // Second pass: build tree
  units.forEach((u) => {
    const node = map.get(u.code)!;
    if (u.parent_code && map.has(u.parent_code)) {
      const parent = map.get(u.parent_code)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort children at each level
  const sortChildren = (nodes: OrganizationalUnitNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

// Flatten tree for table display with proper ordering
export function flattenOrgTree(nodes: OrganizationalUnitNode[]): OrganizationalUnitNode[] {
  const result: OrganizationalUnitNode[] = [];
  
  const traverse = (nodes: OrganizationalUnitNode[], level: number) => {
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

export function useOrganizationalUnits(companyId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["organizational_units", companyId],
    queryFn: () => fetchOrganizationalUnits(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refetch = () => query.refetch();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["organizational_units", companyId] });
  };

  return {
    units: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}
