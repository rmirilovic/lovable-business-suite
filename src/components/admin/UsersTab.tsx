import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Search, Shield, Users } from "lucide-react";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

interface UserWithRole extends Profile {
  role?: AppRole;
  roleId?: string;
}

export function UsersTab() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("email");

    if (profilesError) {
      toast.error("Greška pri učitavanju korisnika");
      setLoading(false);
      return;
    }

    // Fetch all user roles
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("*");

    if (rolesError) {
      toast.error("Greška pri učitavanju uloga");
      setLoading(false);
      return;
    }

    // Combine profiles with roles
    const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
      const userRole = roles?.find((r) => r.user_id === profile.id);
      return {
        ...profile,
        role: userRole?.role,
        roleId: userRole?.id,
      };
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const handleEditRole = (user: UserWithRole) => {
    setSelectedUser(user);
    setSelectedRole(user.role || "");
    setIsDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser) return;

    if (!selectedRole) {
      // Remove role if exists
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
      // Update existing role
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
      // Create new role
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

    setIsDialogOpen(false);
    fetchUsers();
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
                <TableHead className="w-24">Akcije</TableHead>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditRole(user)}
                    >
                      <Shield className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                onClick={() => setIsDialogOpen(false)}
              >
                Otkaži
              </Button>
              <Button onClick={handleSaveRole}>Sačuvaj</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
