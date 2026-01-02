import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Search, Shield, Users, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface Company {
  id: string;
  name: string;
  code: string;
}

interface UserCompany {
  id: string;
  user_id: string;
  company_id: string;
  is_local_admin: boolean;
}

interface UserCompanyWithName extends UserCompany {
  companyName: string;
  companyCode: string;
}

interface UserWithRole extends Profile {
  role?: AppRole;
  roleId?: string;
  assignedCompanies: UserCompanyWithName[];
}

export function UsersTab() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Role dialog
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");
  
  // Company assignment dialog
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [userCompanies, setUserCompanies] = useState<UserCompany[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [localAdminCompanyIds, setLocalAdminCompanyIds] = useState<string[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    
    const [profilesRes, rolesRes, userCompaniesRes, companiesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("email"),
      supabase.from("user_roles").select("*"),
      supabase.from("user_companies").select("*"),
      supabase.from("companies").select("id, name, code").eq("is_active", true).order("name"),
    ]);

    if (profilesRes.error) {
      toast.error("Greška pri učitavanju korisnika");
      setLoading(false);
      return;
    }

    if (rolesRes.error || userCompaniesRes.error || companiesRes.error) {
      toast.error("Greška pri učitavanju podataka");
      setLoading(false);
      return;
    }

    const companiesMap = new Map(
      (companiesRes.data || []).map((c) => [c.id, { name: c.name, code: c.code }])
    );

    setCompanies(companiesRes.data || []);

    const usersWithRoles: UserWithRole[] = (profilesRes.data || []).map((profile) => {
      const userRole = rolesRes.data?.find((r) => r.user_id === profile.id);
      const userCompanyAssignments = (userCompaniesRes.data || [])
        .filter((uc) => uc.user_id === profile.id)
        .map((uc) => ({
          ...uc,
          companyName: companiesMap.get(uc.company_id)?.name || "Nepoznata",
          companyCode: companiesMap.get(uc.company_id)?.code || "",
        }));

      return {
        ...profile,
        role: userRole?.role,
        roleId: userRole?.id,
        assignedCompanies: userCompanyAssignments,
      };
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, code")
      .eq("is_active", true)
      .order("name");

    if (error) {
      toast.error("Greška pri učitavanju firmi");
      return;
    }

    setCompanies(data || []);
  };

  const fetchUserCompanies = async (userId: string) => {
    const assignments = users.find((u) => u.id === userId)?.assignedCompanies || [];
    const mapped: UserCompany[] = assignments.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      company_id: a.company_id,
      is_local_admin: a.is_local_admin,
    }));
    setUserCompanies(mapped);
    setSelectedCompanyIds(assignments.map((uc) => uc.company_id));
    setLocalAdminCompanyIds(
      assignments.filter((uc) => uc.is_local_admin).map((uc) => uc.company_id)
    );
  };

  const handleEditRole = (user: UserWithRole) => {
    setSelectedUser(user);
    setSelectedRole(user.role || "");
    setIsRoleDialogOpen(true);
  };

  const handleEditCompanies = async (user: UserWithRole) => {
    setSelectedUser(user);
    await fetchUserCompanies(user.id);
    setIsCompanyDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser) return;

    if (!selectedRole) {
      if (selectedUser.roleId) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("id", selectedUser.roleId);

        if (error) {
          toast.error("Greška pri uklanjanju uloge");
          return;
        }
      }
      toast.success("Uloga uklonjena");
    } else if (selectedUser.roleId) {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: selectedRole as AppRole })
        .eq("id", selectedUser.roleId);

      if (error) {
        toast.error("Greška pri ažuriranju uloge");
        return;
      }
      toast.success("Uloga ažurirana");
    } else {
      const { error } = await supabase.from("user_roles").insert({
        user_id: selectedUser.id,
        role: selectedRole as AppRole,
      });

      if (error) {
        toast.error("Greška pri dodeli uloge");
        return;
      }
      toast.success("Uloga dodeljena");
    }

    setIsRoleDialogOpen(false);
    fetchUsers();
  };

  const handleSaveCompanies = async () => {
    if (!selectedUser) return;

    // Get current assignments
    const currentIds = userCompanies.map((uc) => uc.company_id);
    
    // Companies to add
    const toAdd = selectedCompanyIds.filter((id) => !currentIds.includes(id));
    
    // Companies to remove
    const toRemove = currentIds.filter((id) => !selectedCompanyIds.includes(id));
    
    // Companies to update (local admin status changed)
    const toUpdate = selectedCompanyIds.filter((id) => {
      const existing = userCompanies.find((uc) => uc.company_id === id);
      if (!existing) return false;
      const wasLocalAdmin = existing.is_local_admin;
      const isNowLocalAdmin = localAdminCompanyIds.includes(id);
      return wasLocalAdmin !== isNowLocalAdmin;
    });

    // Perform deletions
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from("user_companies")
        .delete()
        .eq("user_id", selectedUser.id)
        .in("company_id", toRemove);

      if (error) {
        toast.error("Greška pri uklanjanju firmi");
        return;
      }
    }

    // Perform insertions
    if (toAdd.length > 0) {
      const { error } = await supabase.from("user_companies").insert(
        toAdd.map((companyId) => ({
          user_id: selectedUser.id,
          company_id: companyId,
          is_local_admin: localAdminCompanyIds.includes(companyId),
        }))
      );

      if (error) {
        toast.error("Greška pri dodavanju firmi");
        return;
      }
    }

    // Perform updates
    for (const companyId of toUpdate) {
      const { error } = await supabase
        .from("user_companies")
        .update({ is_local_admin: localAdminCompanyIds.includes(companyId) })
        .eq("user_id", selectedUser.id)
        .eq("company_id", companyId);

      if (error) {
        toast.error("Greška pri ažuriranju statusa lokalnog admina");
        return;
      }
    }

    toast.success("Firme ažurirane");
    setIsCompanyDialogOpen(false);
  };

  const toggleCompany = (companyId: string) => {
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
    // Remove from local admin if unchecking company
    if (selectedCompanyIds.includes(companyId)) {
      setLocalAdminCompanyIds((prev) => prev.filter((id) => id !== companyId));
    }
  };

  const toggleLocalAdmin = (companyId: string) => {
    setLocalAdminCompanyIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
  };

  const getRoleBadgeClass = (role?: AppRole) => {
    switch (role) {
      case "super_admin":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "local_admin":
        return "bg-primary/10 text-primary border-primary/20";
      case "user":
        return "bg-secondary text-secondary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getRoleLabel = (role?: AppRole) => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
      case "local_admin":
        return "Lokalni Admin";
      case "user":
        return "Korisnik";
      default:
        return "Bez uloge";
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pretraži korisnike..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="erp-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Učitavanje...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nema pronađenih korisnika</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Ime</TableHead>
                <TableHead>Prezime</TableHead>
                <TableHead>Uloga</TableHead>
                <TableHead>Dodeljene firme</TableHead>
                <TableHead className="w-32">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.email || "-"}
                  </TableCell>
                  <TableCell>{user.first_name || "-"}</TableCell>
                  <TableCell>{user.last_name || "-"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClass(
                        user.role
                      )}`}
                    >
                      {getRoleLabel(user.role)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {user.assignedCompanies.length === 0 ? (
                        <span className="text-muted-foreground text-xs">-</span>
                      ) : (
                        user.assignedCompanies.map((uc) => (
                          <span
                            key={uc.id}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                              uc.is_local_admin
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                            title={uc.is_local_admin ? "Lokalni admin" : "Korisnik"}
                          >
                            {uc.companyCode}
                          </span>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditRole(user)}
                        title="Dodeli ulogu"
                      >
                        <Shield className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditCompanies(user)}
                        title="Dodeli firme"
                      >
                        <Building2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dodeli ulogu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Korisnik</Label>
              <p className="text-sm text-muted-foreground">
                {selectedUser?.email}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Uloga</Label>
              <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as AppRole | "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite ulogu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Korisnik</SelectItem>
                  <SelectItem value="local_admin">Lokalni Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRoleDialogOpen(false)}
              >
                Otkaži
              </Button>
              <Button onClick={handleSaveRole}>Sačuvaj</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Company Assignment Dialog */}
      <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dodeli firme korisniku</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Korisnik</Label>
              <p className="text-sm text-muted-foreground">
                {selectedUser?.email}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Firme</Label>
              <div className="border rounded-md max-h-64 overflow-y-auto">
                {companies.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    Nema dostupnih firmi
                  </div>
                ) : (
                  <div className="divide-y">
                    {companies.map((company) => (
                      <div
                        key={company.id}
                        className="flex items-center justify-between p-3 hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`company-${company.id}`}
                            checked={selectedCompanyIds.includes(company.id)}
                            onCheckedChange={() => toggleCompany(company.id)}
                          />
                          <label
                            htmlFor={`company-${company.id}`}
                            className="text-sm cursor-pointer"
                          >
                            <span className="font-medium">{company.name}</span>
                            <span className="text-muted-foreground ml-2">
                              ({company.code})
                            </span>
                          </label>
                        </div>
                        {selectedCompanyIds.includes(company.id) && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`admin-${company.id}`}
                              checked={localAdminCompanyIds.includes(company.id)}
                              onCheckedChange={() => toggleLocalAdmin(company.id)}
                            />
                            <label
                              htmlFor={`admin-${company.id}`}
                              className="text-xs text-muted-foreground cursor-pointer"
                            >
                              Lokalni admin
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCompanyDialogOpen(false)}
              >
                Otkaži
              </Button>
              <Button onClick={handleSaveCompanies}>Sačuvaj</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
