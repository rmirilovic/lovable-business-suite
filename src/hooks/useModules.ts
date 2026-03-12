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

  const tree = modules?.reduce((acc, mod) => {
    if (!mod.parent_code) {
      acc.push({
        ...mod,
        children: (modules.filter((m) => m.parent_code === mod.code) || []).map((child) => ({
          ...child,
          children: modules.filter((m) => m.parent_code === child.code).map((gc) => ({
            ...gc,
            children: [],
          })),
        })),
      });
    }
    return acc;
  }, [] as ModuleWithChildren[]);

  return { tree, isLoading, error };
}
