import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Shield, Settings2, Search, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  useRoles,
  useRolePermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useSaveRolePermissions,
  Role,
  RolePermission,
} from "@/hooks/useRoles";
import { useModules } from "@/hooks/useModules";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import {
  buildPermissionSections,
  collectPermissionCodes,
  type PermissionDisplayNode,
} from "@/lib/buildPermissionSections";

const ACCESS_LEVELS = [
  { value: "none", label: "Bez pristupa" },
  { value: "read", label: "Čitanje" },
  { value: "write", label: "Pisanje" },
  { value: "admin", label: "Puna prava" },
] as const;

type PermissionState = {
  access_level: string;
  can_post: boolean;
  can_unpost: boolean;
};

const DEFAULT_PERMISSION: PermissionState = {
  access_level: "none",
  can_post: false,
  can_unpost: false,
};

const filterNodes = (nodes: PermissionDisplayNode[], query: string): PermissionDisplayNode[] =>
  nodes.flatMap((node) => {
    const matches = node.name.toLowerCase().includes(query);
    const filteredChildren = matches ? node.children : filterNodes(node.children, query);

    if (!matches && filteredChildren.length === 0) {
      return [];
    }

    return [
      {
        ...node,
        children: filteredChildren,
      },
    ];
  });

export function RolesTab() {
  const { selectedCompany, isSuperAdmin, isLocalAdmin } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
  });
  const [permissionsMap, setPermissionsMap] = useState<Record<string, PermissionState>>({});
  const [moduleSearch, setModuleSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const { data: roles, isLoading } = useRoles(selectedCompany?.id);
  const { data: permissions, isLoading: permissionsLoading } = useRolePermissions(editingRole?.id);
  const { data: modules, isLoading: modulesLoading } = useModules();

  useEffect(() => {
    if (permissions && isPermissionsDialogOpen) {
      const map: Record<string, PermissionState> = {};
      permissions.forEach((permission) => {
        map[permission.module_code] = {
          access_level: permission.access_level,
          can_post: permission.can_post,
          can_unpost: permission.can_unpost,
        };
      });
      setPermissionsMap(map);
    }
  }, [permissions, isPermissionsDialogOpen]);

  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const savePermissions = useSaveRolePermissions();

  const canManageRoles = isSuperAdmin || isLocalAdmin;

  const permissionSections = useMemo(() => {
    if (!modules) return [];
    return buildPermissionSections(modules);
  }, [modules]);

  const filteredSections = useMemo(() => {
    if (!moduleSearch.trim()) return permissionSections;

    const query = moduleSearch.toLowerCase();

    return permissionSections.flatMap((section) => {
      if (section.name.toLowerCase().includes(query)) {
        return [section];
      }

      const children = filterNodes(section.children, query);
      if (children.length === 0) {
        return [];
      }

      return [{ ...section, children }];
    });
  }, [permissionSections, moduleSearch]);

  const handleOpenCreate = () => {
    setEditingRole(null);
    setFormData({ code: "", name: "", description: "" });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      code: role.code,
      name: role.name,
      description: role.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenPermissions = (role: Role) => {
    setPermissionsMap({});
    setModuleSearch("");
    setCollapsedGroups(new Set());
    setEditingRole(role);
    setIsPermissionsDialogOpen(true);
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Šifra i naziv su obavezni");
      return;
    }

    if (!selectedCompany?.id) return;

    if (editingRole) {
      await updateRole.mutateAsync({
        id: editingRole.id,
        code: formData.code.trim(),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });
    } else {
      await createRole.mutateAsync({
        company_id: selectedCompany.id,
        code: formData.code.trim(),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        is_system: false,
        is_active: true,
      });
    }

    setIsDialogOpen(false);
  };

  const handleDelete = async (role: Role) => {
    if (role.is_system) {
      toast.error("Sistemske uloge se ne mogu brisati");
      return;
    }

    if (!confirm(`Da li ste sigurni da želite obrisati ulogu "${role.name}"?`)) {
      return;
    }

    await deleteRole.mutateAsync({ id: role.id, companyId: role.company_id });
  };

  const handleSavePermissions = async () => {
    if (!editingRole) return;

    const permsToSave: Omit<RolePermission, "id">[] = Object.entries(permissionsMap)
      .filter(([, value]) => value.access_level !== "none")
      .map(([moduleCode, value]) => ({
        role_id: editingRole.id,
        module_code: moduleCode,
        access_level: value.access_level as RolePermission["access_level"],
        can_post: value.can_post,
        can_unpost: value.can_unpost,
      }));

    await savePermissions.mutateAsync({
      roleId: editingRole.id,
      permissions: permsToSave,
    });

    setIsPermissionsDialogOpen(false);
  };

  const updatePermission = (
    moduleCode: string,
    field: keyof PermissionState,
    value: string | boolean,
  ) => {
    setPermissionsMap((prev) => ({
      ...prev,
      [moduleCode]: {
        ...DEFAULT_PERMISSION,
        ...prev[moduleCode],
        [field]: value,
      },
    }));
  };

  const updateCodes = (codes: string[], updater: (current: PermissionState) => PermissionState) => {
    setPermissionsMap((prev) => {
      const updated = { ...prev };

      codes.forEach((code) => {
        updated[code] = updater({ ...DEFAULT_PERMISSION, ...prev[code] });
      });

      return updated;
    });
  };

  const setAccessForNodes = (nodes: PermissionDisplayNode[], level: string) => {
    const codes = collectPermissionCodes(nodes);
    updateCodes(codes, (current) => ({
      access_level: level,
      can_post: level === "none" ? false : current.can_post,
      can_unpost: level === "none" ? false : current.can_unpost,
    }));
  };

  const setCanPostForNodes = (nodes: PermissionDisplayNode[], value: boolean) => {
    const codes = collectPermissionCodes(nodes);
    updateCodes(codes, (current) =>
      current.access_level === "none" ? current : { ...current, can_post: value },
    );
  };

  const setCanUnpostForNodes = (nodes: PermissionDisplayNode[], value: boolean) => {
    const codes = collectPermissionCodes(nodes);
    updateCodes(codes, (current) =>
      current.access_level === "none" ? current : { ...current, can_unpost: value },
    );
  };

  const renderNodes = (nodes: PermissionDisplayNode[], depth = 0): React.ReactNode =>
    nodes.map((node) => {
      const permission = permissionsMap[node.code] || DEFAULT_PERMISSION;
      const indentClass = depth === 0 ? "pl-8 font-medium" : depth === 1 ? "pl-14 text-sm text-muted-foreground" : "pl-20 text-sm text-muted-foreground";
      const rowClass = depth === 0 ? "border-l-2 border-l-border" : "bg-muted/20 border-l-2 border-l-border";

      return (
        <React.Fragment key={node.key}>
          <TableRow className={rowClass}>
            <TableCell className={indentClass}>{depth > 0 ? `↳ ${node.name}` : node.name}</TableCell>
            <TableCell>
              <Select
                value={permission.access_level}
                onValueChange={(value) => updatePermission(node.code, "access_level", value)}
                disabled={!canManageRoles}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={permission.can_post}
                onCheckedChange={(value) => updatePermission(node.code, "can_post", !!value)}
                disabled={!canManageRoles || permission.access_level === "none"}
              />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox
                checked={permission.can_unpost}
                onCheckedChange={(value) => updatePermission(node.code, "can_unpost", !!value)}
                disabled={!canManageRoles || permission.access_level === "none"}
              />
            </TableCell>
          </TableRow>
          {node.children.length > 0 ? renderNodes(node.children, depth + 1) : null}
        </React.Fragment>
      );
    });

  if (!selectedCompany) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Izaberite firmu za upravljanje ulogama
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Definišite uloge i njihove dozvole za pristup modulima
        </p>
        {canManageRoles && (
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova uloga
          </Button>
        )}
      </div>

      <div className="erp-card overflow-hidden">
        <TableScrollContainer>
          {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Učitavanje...</div>
        ) : !roles || roles.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nema definisanih uloga</p>
            <p className="text-sm mt-2">Kreirajte uloge za kontrolu pristupa korisnika</p>
          </div>
        ) : (
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Šifra</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead className="w-32">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-mono">{role.code}</TableCell>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="text-muted-foreground">{role.description || "-"}</TableCell>
                  <TableCell>
                    {role.is_system ? (
                      <Badge variant="secondary">Sistemska</Badge>
                    ) : (
                      <Badge variant="outline">Prilagođena</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenPermissions(role)}
                        title="Dozvole"
                      >
                        <Settings2 className="w-4 h-4" />
                      </Button>
                      {canManageRoles && !role.is_system && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(role)}
                            title="Izmeni"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(role)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Obriši"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </TableScrollContainer>
      </div>  

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Izmeni ulogu" : "Nova uloga"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Šifra *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="MAGACIONER"
                />
              </div>
              <div className="space-y-2">
                <Label>Naziv *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Magacioner"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Opis</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Opis uloge i odgovornosti..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Otkaži
              </Button>
              <Button onClick={handleSave} disabled={createRole.isPending || updateRole.isPending}>
                {editingRole ? "Sačuvaj" : "Kreiraj"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Dozvole za ulogu: {editingRole?.name}</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={moduleSearch}
              onChange={(e) => setModuleSearch(e.target.value)}
              placeholder="Pretraži module..."
              className="pl-9"
            />
          </div>
          <div className="flex-1 overflow-auto">
            {modulesLoading || permissionsLoading ? (
              <div className="p-4 text-center text-muted-foreground">Učitavanje...</div>
            ) : filteredSections.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">Nema rezultata za „{moduleSearch}"</div>
            ) : (
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Modul</TableHead>
                    <TableHead className="w-[28%]">Nivo pristupa</TableHead>
                    <TableHead className="w-[16%] text-center">Knjiženje</TableHead>
                    <TableHead className="w-[16%] text-center">Storniranje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSections.map((section) => {
                    const isCollapsed = collapsedGroups.has(section.key) && !moduleSearch.trim();

                    return (
                      <React.Fragment key={section.key}>
                        <TableRow className="bg-muted/50 cursor-pointer" onClick={() => toggleGroup(section.key)}>
                          <TableCell className="font-semibold">
                            <span className="inline-flex items-center gap-1">
                              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              {section.name}
                            </span>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setAccessForNodes(section.children, "admin")}
                                disabled={!canManageRoles}
                                className="text-xs h-7"
                              >
                                Puna prava
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setAccessForNodes(section.children, "none")}
                                disabled={!canManageRoles}
                                className="text-xs h-7"
                              >
                                Bez pristupa
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1 justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCanPostForNodes(section.children, true)}
                                disabled={!canManageRoles}
                                className="text-xs h-7 px-2"
                              >
                                Sve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCanPostForNodes(section.children, false)}
                                disabled={!canManageRoles}
                                className="text-xs h-7 px-2"
                              >
                                Ništa
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1 justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCanUnpostForNodes(section.children, true)}
                                disabled={!canManageRoles}
                                className="text-xs h-7 px-2"
                              >
                                Sve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCanUnpostForNodes(section.children, false)}
                                disabled={!canManageRoles}
                                className="text-xs h-7 px-2"
                              >
                                Ništa
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed ? renderNodes(section.children) : null}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsPermissionsDialogOpen(false)}>
              Zatvori
            </Button>
            {canManageRoles && (
              <Button onClick={handleSavePermissions} disabled={savePermissions.isPending}>
                Sačuvaj dozvole
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}