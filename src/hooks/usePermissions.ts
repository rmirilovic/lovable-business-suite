import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AccessLevel = "none" | "read" | "write" | "admin";

interface UserRole {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

interface ModuleAccess {
  moduleCode: string;
  accessLevel: AccessLevel;
  canPost: boolean;
  canUnpost: boolean;
}

interface UsePermissionsReturn {
  userRoles: UserRole[];
  isLoading: boolean;
  hasAccess: (moduleCode: string, requiredLevel?: AccessLevel) => boolean;
  getAccessLevel: (moduleCode: string) => AccessLevel;
  canPost: (moduleCode: string) => boolean;
  canUnpost: (moduleCode: string) => boolean;
  moduleAccess: Map<string, ModuleAccess>;
  refetch: () => Promise<void>;
}

const ACCESS_LEVEL_ORDER: Record<AccessLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
};

const getModuleHierarchy = (moduleCode: string) => {
  const parts = moduleCode.split(".");

  return Array.from({ length: parts.length }, (_, index) =>
    parts.slice(0, parts.length - index).join(".")
  );
};

export function usePermissions(): UsePermissionsReturn {
  const { user, selectedCompany, isSuperAdmin, isLocalAdmin, initialLoadDone } = useAuth();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [moduleAccess, setModuleAccess] = useState<Map<string, ModuleAccess>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const resolveModuleAccess = useCallback(
    (moduleCode: string): ModuleAccess | undefined => {
      for (const code of getModuleHierarchy(moduleCode)) {
        const access = moduleAccess.get(code);
        if (access) return access;
      }

      return undefined;
    },
    [moduleAccess]
  );

  const fetchUserRoles = useCallback(async () => {
    if (!user) {
      setUserRoles([]);
      setModuleAccess(new Map());
      setIsLoading(false);
      return;
    }

    if (!initialLoadDone || !selectedCompany) {
      setIsLoading(true);
      return;
    }

    setIsLoading(true);

    if (isSuperAdmin || isLocalAdmin) {
      setUserRoles([]);
      setModuleAccess(new Map());
      setIsLoading(false);
      return;
    }

    try {
      const { data: roleAssignments, error: rolesError } = await supabase
        .from("user_role_assignments")
        .select(`
          role_id,
          roles (
            id,
            name,
            code,
            description
          )
        `)
        .eq("user_id", user.id)
        .eq("company_id", selectedCompany.id)
        .eq("is_active", true);

      if (rolesError) throw rolesError;

      const roles: UserRole[] = (roleAssignments || [])
        .filter((ra: any) => ra.roles)
        .map((ra: any) => ({
          id: ra.roles.id,
          name: ra.roles.name,
          code: ra.roles.code,
          description: ra.roles.description,
        }));

      setUserRoles(roles);

      if (roles.length === 0) {
        setModuleAccess(new Map());
        setIsLoading(false);
        return;
      }

      const roleIds = roles.map((role) => role.id);
      const { data: permissions, error: permError } = await supabase
        .from("role_permissions")
        .select("module_code, access_level, can_post, can_unpost")
        .in("role_id", roleIds);

      if (permError) throw permError;

      const accessMap = new Map<string, ModuleAccess>();

      for (const perm of permissions || []) {
        const existing = accessMap.get(perm.module_code);
        const newLevel = perm.access_level as AccessLevel;

        if (!existing || ACCESS_LEVEL_ORDER[newLevel] > ACCESS_LEVEL_ORDER[existing.accessLevel]) {
          accessMap.set(perm.module_code, {
            moduleCode: perm.module_code,
            accessLevel: newLevel,
            canPost: perm.can_post || existing?.canPost || false,
            canUnpost: perm.can_unpost || existing?.canUnpost || false,
          });
        } else if (existing) {
          existing.canPost = existing.canPost || perm.can_post;
          existing.canUnpost = existing.canUnpost || perm.can_unpost;
        }
      }

      setModuleAccess(accessMap);
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedCompany, isSuperAdmin, isLocalAdmin, initialLoadDone]);

  useEffect(() => {
    void fetchUserRoles();
  }, [fetchUserRoles]);

  const hasAccess = useCallback(
    (moduleCode: string, requiredLevel: AccessLevel = "read"): boolean => {
      if (isSuperAdmin || isLocalAdmin) return true;

      const access = resolveModuleAccess(moduleCode);
      if (!access) return false;

      return ACCESS_LEVEL_ORDER[access.accessLevel] >= ACCESS_LEVEL_ORDER[requiredLevel];
    },
    [resolveModuleAccess, isSuperAdmin, isLocalAdmin]
  );

  const getAccessLevel = useCallback(
    (moduleCode: string): AccessLevel => {
      if (isSuperAdmin || isLocalAdmin) return "admin";
      return resolveModuleAccess(moduleCode)?.accessLevel || "none";
    },
    [resolveModuleAccess, isSuperAdmin, isLocalAdmin]
  );

  const canPost = useCallback(
    (moduleCode: string): boolean => {
      if (isSuperAdmin || isLocalAdmin) return true;
      return resolveModuleAccess(moduleCode)?.canPost || false;
    },
    [resolveModuleAccess, isSuperAdmin, isLocalAdmin]
  );

  const canUnpost = useCallback(
    (moduleCode: string): boolean => {
      if (isSuperAdmin || isLocalAdmin) return true;
      return resolveModuleAccess(moduleCode)?.canUnpost || false;
    },
    [resolveModuleAccess, isSuperAdmin, isLocalAdmin]
  );

  return {
    userRoles,
    isLoading,
    hasAccess,
    getAccessLevel,
    canPost,
    canUnpost,
    moduleAccess,
    refetch: fetchUserRoles,
  };
}
