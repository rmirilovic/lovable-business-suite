import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Module {
  id: string;
  code: string;
  name: string;
  module_type: string;
  parent_code: string | null;
  sort_order: number;
  description: string | null;
  is_active: boolean;
}

export interface ModuleWithChildren extends Module {
  children: ModuleWithChildren[];
}

export function useModules() {
  return useQuery({
    queryKey: ["modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (error) throw error;
      return data as Module[];
    },
  });
}

export function useModuleTree() {
  const { data: modules, isLoading, error } = useModules();

  const tree = useMemo(() => {
    if (!modules) return undefined;

    // Build a map of parent_code -> children for efficient lookup
    const childrenMap = new Map<string, Module[]>();
    const topLevel: Module[] = [];

    for (const mod of modules) {
      if (!mod.parent_code) {
        topLevel.push(mod);
      } else {
        const siblings = childrenMap.get(mod.parent_code) || [];
        siblings.push(mod);
        childrenMap.set(mod.parent_code, siblings);
      }
    }

    // Build tree recursively (supports any depth)
    const buildChildren = (parentCode: string, depth: number): ModuleWithChildren[] => {
      const children = childrenMap.get(parentCode) || [];
      return children.map((child) => ({
        ...child,
        children: depth < 3 ? buildChildren(child.code, depth + 1) : [],
      }));
    };

    return topLevel.map((mod) => ({
      ...mod,
      children: buildChildren(mod.code, 1),
    })) as ModuleWithChildren[];
  }, [modules]);

  return { tree, isLoading, error };
}
