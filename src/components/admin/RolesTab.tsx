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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Shield, Settings2, Users, Search, ChevronDown, ChevronRight } from "lucide-react";
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
import { useModuleTree, Module, ModuleWithChildren } from "@/hooks/useModules";

const ACCESS_LEVELS = [
  { value: "none", label: "Bez pristupa", color: "bg-muted text-muted-foreground" },
  { value: "read", label: "Čitanje", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "write", label: "Pisanje", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "admin", label: "Puna prava", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
];

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
  const [permissionsMap, setPermissionsMap] = useState<
    Record<string, { access_level: string; can_post: boolean; can_unpost: boolean }>
  >({});

  const { data: roles, isLoading } = useRoles(selectedCompany?.id);
  const { data: permissions, isLoading: permissionsLoading } = useRolePermissions(editingRole?.id);
  const { tree: moduleTree, isLoading: modulesLoading } = useModuleTree();

  // Update permissionsMap when permissions data is loaded
  useEffect(() => {
    if (permissions && isPermissionsDialogOpen) {
      const map: typeof permissionsMap = {};
      permissions.forEach((p) => {
        map[p.module_code] = {
          access_level: p.access_level,
          can_post: p.can_post,
          can_unpost: p.can_unpost,
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
    // Reset permissions map - will be populated by useEffect when data loads
    setPermissionsMap({});
    setEditingRole(role);
    setIsPermissionsDialogOpen(true);
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
      .filter(([_, value]) => value.access_level !== "none")
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
    field: "access_level" | "can_post" | "can_unpost",
    value: string | boolean
  ) => {
    setPermissionsMap((prev) => ({
      ...prev,
      [moduleCode]: {
        access_level: prev[moduleCode]?.access_level || "none",
        can_post: prev[moduleCode]?.can_post || false,
        can_unpost: prev[moduleCode]?.can_unpost || false,
        [field]: value,
      },
    }));
  };

  const setAllChildrenAccessLevel = (parentCode: string, level: string) => {
    const parent = moduleTree?.find((m) => m.code === parentCode);
    if (!parent) return;

    setPermissionsMap((prev) => {
      const updated = { ...prev };
      parent.children.forEach((child) => {
        updated[child.code] = {
          access_level: level,
          can_post: level === "none" ? false : prev[child.code]?.can_post || false,
          can_unpost: level === "none" ? false : prev[child.code]?.can_unpost || false,
        };
        child.children?.forEach((gc) => {
          updated[gc.code] = {
            access_level: level,
            can_post: level === "none" ? false : prev[gc.code]?.can_post || false,
            can_unpost: level === "none" ? false : prev[gc.code]?.can_unpost || false,
          };
        });
      });
      return updated;
    });
  };

  const setAllChildrenCanPost = (parentCode: string, value: boolean) => {
    const parent = moduleTree?.find((m) => m.code === parentCode);
    if (!parent) return;

    setPermissionsMap((prev) => {
      const updated = { ...prev };
      parent.children.forEach((child) => {
        const current = prev[child.code] || { access_level: "none", can_post: false, can_unpost: false };
        if (current.access_level !== "none") {
          updated[child.code] = { ...current, can_post: value };
        }
        child.children?.forEach((gc) => {
          const gcCurrent = prev[gc.code] || { access_level: "none", can_post: false, can_unpost: false };
          if (gcCurrent.access_level !== "none") {
            updated[gc.code] = { ...gcCurrent, can_post: value };
          }
        });
      });
      return updated;
    });
  };

  const setAllChildrenCanUnpost = (parentCode: string, value: boolean) => {
    const parent = moduleTree?.find((m) => m.code === parentCode);
    if (!parent) return;

    setPermissionsMap((prev) => {
      const updated = { ...prev };
      parent.children.forEach((child) => {
        const current = prev[child.code] || { access_level: "none", can_post: false, can_unpost: false };
        if (current.access_level !== "none") {
          updated[child.code] = { ...current, can_unpost: value };
        }
        child.children?.forEach((gc) => {
          const gcCurrent = prev[gc.code] || { access_level: "none", can_post: false, can_unpost: false };
          if (gcCurrent.access_level !== "none") {
            updated[gc.code] = { ...gcCurrent, can_unpost: value };
          }
        });
      });
      return updated;
    });
  };

  const getAccessLevelBadge = (level: string) => {
    const config = ACCESS_LEVELS.find((a) => a.value === level);
    return config ? (
      <Badge className={config.color}>{config.label}</Badge>
    ) : null;
  };

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
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Učitavanje...</div>
        ) : !roles || roles.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nema definisanih uloga</p>
            <p className="text-sm mt-2">Kreirajte uloge za kontrolu pristupa korisnika</p>
          </div>
        ) : (
          <Table>
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
                  <TableCell className="text-muted-foreground">
                    {role.description || "-"}
                  </TableCell>
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
      </div>

      {/* Create/Edit Role Dialog */}
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
              <Button
                onClick={handleSave}
                disabled={createRole.isPending || updateRole.isPending}
              >
                {editingRole ? "Sačuvaj" : "Kreiraj"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Dozvole za ulogu: {editingRole?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {modulesLoading || permissionsLoading ? (
              <div className="p-4 text-center text-muted-foreground">Učitavanje...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Modul</TableHead>
                    <TableHead>Nivo pristupa</TableHead>
                    <TableHead className="text-center">Knjiženje</TableHead>
                    <TableHead className="text-center">Storniranje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moduleTree?.map((parent) => (
                    <React.Fragment key={parent.code}>
                      <TableRow className="bg-muted/50">
                        <TableCell className="font-semibold">{parent.name}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAllChildrenAccessLevel(parent.code, "admin")}
                              disabled={!canManageRoles}
                              className="text-xs h-7"
                            >
                              Puna prava
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAllChildrenAccessLevel(parent.code, "none")}
                              disabled={!canManageRoles}
                              className="text-xs h-7"
                            >
                              Bez pristupa
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAllChildrenCanPost(parent.code, true)}
                              disabled={!canManageRoles}
                              className="text-xs h-7 px-2"
                            >
                              Sve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAllChildrenCanPost(parent.code, false)}
                              disabled={!canManageRoles}
                              className="text-xs h-7 px-2"
                            >
                              Ništa
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAllChildrenCanUnpost(parent.code, true)}
                              disabled={!canManageRoles}
                              className="text-xs h-7 px-2"
                            >
                              Sve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAllChildrenCanUnpost(parent.code, false)}
                              disabled={!canManageRoles}
                              className="text-xs h-7 px-2"
                            >
                              Ništa
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {parent.children.map((mod) => {
                        const perm = permissionsMap[mod.code] || {
                          access_level: "none",
                          can_post: false,
                          can_unpost: false,
                        };
                        return (
                          <React.Fragment key={mod.code}>
                            <TableRow>
                              <TableCell className="pl-8">{mod.name}</TableCell>
                              <TableCell>
                                <Select
                                  value={perm.access_level}
                                  onValueChange={(v) => updatePermission(mod.code, "access_level", v)}
                                  disabled={!canManageRoles}
                                >
                                  <SelectTrigger className="w-40">
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
                                  checked={perm.can_post}
                                  onCheckedChange={(v) => updatePermission(mod.code, "can_post", !!v)}
                                  disabled={!canManageRoles || perm.access_level === "none"}
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={perm.can_unpost}
                                  onCheckedChange={(v) => updatePermission(mod.code, "can_unpost", !!v)}
                                  disabled={!canManageRoles || perm.access_level === "none"}
                                />
                              </TableCell>
                            </TableRow>
                            {mod.children?.map((subMod) => {
                              const subPerm = permissionsMap[subMod.code] || {
                                access_level: "none",
                                can_post: false,
                                can_unpost: false,
                              };
                              return (
                                <TableRow key={subMod.code} className="bg-muted/20">
                                  <TableCell className="pl-14 text-sm text-muted-foreground">↳ {subMod.name}</TableCell>
                                  <TableCell>
                                    <Select
                                      value={subPerm.access_level}
                                      onValueChange={(v) => updatePermission(subMod.code, "access_level", v)}
                                      disabled={!canManageRoles}
                                    >
                                      <SelectTrigger className="w-40">
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
                                      checked={subPerm.can_post}
                                      onCheckedChange={(v) => updatePermission(subMod.code, "can_post", !!v)}
                                      disabled={!canManageRoles || subPerm.access_level === "none"}
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Checkbox
                                      checked={subPerm.can_unpost}
                                      onCheckedChange={(v) => updatePermission(subMod.code, "can_unpost", !!v)}
                                      disabled={!canManageRoles || subPerm.access_level === "none"}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ))}
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
