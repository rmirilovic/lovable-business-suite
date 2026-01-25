import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Role {
  id: string;
  company_id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  module_code: string;
  access_level: "none" | "read" | "write" | "admin";
  can_post: boolean;
  can_unpost: boolean;
}

export function useRoles(companyId?: string) {
  const { selectedCompany } = useAuth();
  const effectiveCompanyId = companyId || selectedCompany?.id;

  return useQuery({
    queryKey: ["roles", effectiveCompanyId],
    queryFn: async () => {
      if (!effectiveCompanyId) return [];

      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .eq("company_id", effectiveCompanyId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Role[];
    },
    enabled: !!effectiveCompanyId,
  });
}

export function useRolePermissions(roleId?: string) {
  return useQuery({
    queryKey: ["role-permissions", roleId],
    queryFn: async () => {
      if (!roleId) return [];

      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("role_id", roleId);

      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: !!roleId,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (role: Omit<Role, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("roles")
        .insert(role)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roles", variables.company_id] });
      toast.success("Uloga uspešno kreirana");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Role> & { id: string }) => {
      const { data, error } = await supabase
        .from("roles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["roles", data.company_id] });
      toast.success("Uloga ažurirana");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase.from("roles").delete().eq("id", id);
      if (error) throw error;
      return { companyId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roles", variables.companyId] });
      toast.success("Uloga obrisana");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });
}

export function useSaveRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleId,
      permissions,
    }: {
      roleId: string;
      permissions: Omit<RolePermission, "id">[];
    }) => {
      // Delete existing permissions
      await supabase.from("role_permissions").delete().eq("role_id", roleId);

      // Insert new permissions
      if (permissions.length > 0) {
        const { error } = await supabase.from("role_permissions").insert(permissions);
        if (error) throw error;
      }

      return { roleId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions", variables.roleId] });
      toast.success("Dozvole sačuvane");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });
}
