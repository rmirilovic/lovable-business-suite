import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, UserCheck, Building2, MoreHorizontal, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useUserRoleAssignments,
  useAssignRole,
  useRemoveRoleAssignment,
  UserRoleAssignmentWithDetails,
} from "@/hooks/useUserRoleAssignments";
import { useRoles } from "@/hooks/useRoles";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useQuery } from "@tanstack/react-query";

interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

export function UserRolesTab() {
  const { selectedCompany, isSuperAdmin, isLocalAdmin } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState("");
  const [prefilledUserName, setPrefilledUserName] = useState("");

  const { data: assignments, isLoading } = useUserRoleAssignments(selectedCompany?.id);
  const { data: roles } = useRoles(selectedCompany?.id);
  const { units: orgUnits } = useOrganizationalUnits(selectedCompany?.id || "");

  const assignRole = useAssignRole();
  const removeAssignment = useRemoveRoleAssignment();

  // Fetch profiles for selection
  const { data: profiles } = useQuery({
    queryKey: ["profiles-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .order("email");

      if (error) throw error;
      return data as Profile[];
    },
  });

  const canManageRoles = isSuperAdmin || isLocalAdmin;

  const handleOpenDialog = (userId?: string, roleId?: string, orgUnitId?: string) => {
    setSelectedUserId(userId || "");
    setSelectedRoleId(roleId || "");
    setSelectedOrgUnitId(orgUnitId || "");
    setPrefilledUserName(userId ? getUserDisplayName(profiles?.find(p => p.id === userId)) : "");
    setIsDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedUserId || !selectedRoleId || !selectedCompany?.id) {
      toast.error("Izaberite korisnika i ulogu");
      return;
    }

    await assignRole.mutateAsync({
      user_id: selectedUserId,
      company_id: selectedCompany.id,
      role_id: selectedRoleId,
      org_unit_id: selectedOrgUnitId || null,
      is_active: true,
      valid_from: null,
      valid_to: null,
    });

    setIsDialogOpen(false);
  };

  const handleRemove = async (assignment: UserRoleAssignmentWithDetails) => {
    if (!confirm("Da li ste sigurni da želite ukloniti ovu dodelu uloge?")) {
      return;
    }

    await removeAssignment.mutateAsync({
      id: assignment.id,
      companyId: assignment.company_id,
    });
  };

  const getUserDisplayName = (profile?: Profile | null) => {
    if (!profile) return "Nepoznat";
    if (profile.first_name || profile.last_name) {
      return `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    }
    return profile.email || "Nepoznat";
  };

  if (!selectedCompany) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Izaberite firmu za upravljanje dodelama uloga
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Dodelite uloge korisnicima za pristup modulima
        </p>
        {canManageRoles && (
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="w-4 h-4" />
            Dodeli ulogu
          </Button>
        )}
      </div>

      <div className="erp-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Učitavanje...</div>
        ) : !assignments || assignments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nema dodeljenih uloga</p>
            <p className="text-sm mt-2">
              Prvo kreirajte uloge u tabu "Uloge", zatim ih dodelite korisnicima
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Korisnik</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Uloga</TableHead>
                <TableHead>Org. jedinica</TableHead>
                <TableHead className="w-16">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow
                  key={assignment.id}
                  className={canManageRoles ? "cursor-pointer" : ""}
                  onClick={() => {
                    if (canManageRoles) {
                      handleOpenDialog(assignment.user_id, assignment.role_id, assignment.org_unit_id || undefined);
                    }
                  }}
                >
                  <TableCell className="font-medium">
                    {getUserDisplayName(assignment.profile)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {assignment.profile?.email || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{assignment.role?.name || "-"}</Badge>
                  </TableCell>
                  <TableCell>
                    {assignment.org_unit ? (
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-muted-foreground" />
                        <span>{assignment.org_unit.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sve jedinice</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canManageRoles && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDialog(assignment.user_id, assignment.role_id, assignment.org_unit_id || undefined);
                            }}
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Dodela uloge
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(assignment);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Brisanje uloge
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Assign Role Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dodeli ulogu korisniku</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Korisnik *</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite korisnika" />
                </SelectTrigger>
                <SelectContent>
                  {profiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {getUserDisplayName(profile)} ({profile.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Uloga *</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite ulogu" />
                </SelectTrigger>
                <SelectContent>
                  {roles?.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Organizaciona jedinica (opciono)</Label>
              <Select
                value={selectedOrgUnitId || "__all__"}
                onValueChange={(val) => setSelectedOrgUnitId(val === "__all__" ? "" : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sve jedinice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Sve jedinice</SelectItem>
                  {orgUnits?.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.code} - {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ostavite prazno za pristup svim org. jedinicama
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Otkaži
              </Button>
              <Button onClick={handleAssign} disabled={assignRole.isPending}>
                Dodeli
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
