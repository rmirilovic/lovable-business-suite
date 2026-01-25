import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface UserRoleAssignment {
  id: string;
  user_id: string;
  company_id: string;
  role_id: string;
  org_unit_id: string | null;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
}

export interface UserRoleAssignmentWithDetails extends UserRoleAssignment {
  role?: {
    id: string;
    name: string;
    code: string;
  };
  org_unit?: {
    id: string;
    name: string;
    code: string;
  } | null;
  profile?: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
  };
}

export function useUserRoleAssignments(companyId?: string) {
  const { selectedCompany } = useAuth();
  const effectiveCompanyId = companyId || selectedCompany?.id;

  return useQuery({
    queryKey: ["user-role-assignments", effectiveCompanyId],
    queryFn: async () => {
      if (!effectiveCompanyId) return [];

      const { data, error } = await supabase
        .from("user_role_assignments")
        .select(`
          *,
          role:roles(id, name, code),
          org_unit:organizational_units(id, name, code)
        `)
        .eq("company_id", effectiveCompanyId)
        .eq("is_active", true);

      if (error) throw error;

      // Fetch profiles separately due to RLS
      const userIds = [...new Set((data || []).map((d) => d.user_id))];
      let profiles: any[] = [];

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name")
          .in("id", userIds);
        profiles = profilesData || [];
      }

      return (data || []).map((assignment) => ({
        ...assignment,
        profile: profiles.find((p) => p.id === assignment.user_id),
      })) as UserRoleAssignmentWithDetails[];
    },
    enabled: !!effectiveCompanyId,
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignment: Omit<UserRoleAssignment, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("user_role_assignments")
        .insert(assignment)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-role-assignments", variables.company_id] });
      toast.success("Uloga dodeljena korisniku");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.error("Korisnik već ima ovu ulogu");
      } else {
        toast.error(`Greška: ${error.message}`);
      }
    },
  });
}

export function useRemoveRoleAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase
        .from("user_role_assignments")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { companyId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-role-assignments", variables.companyId] });
      toast.success("Uloga uklonjena");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });
}
