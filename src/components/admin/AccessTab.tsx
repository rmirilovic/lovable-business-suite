import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Trash2, Shield, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  code: string;
}

interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface UserCompany {
  id: string;
  user_id: string;
  company_id: string;
  is_local_admin: boolean | null;
  profile?: Profile;
  company?: Company;
}

export function AccessTab() {
  const [userCompanies, setUserCompanies] = useState<UserCompany[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [isLocalAdmin, setIsLocalAdmin] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch companies
    const { data: companiesData } = await supabase
      .from("companies")
      .select("id, name, code")
      .order("name");

    // Fetch profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .order("email");

    // Fetch user_companies
    const { data: userCompaniesData, error } = await supabase
      .from("user_companies")
      .select("*");

    if (error) {
      toast.error("Greška pri učitavanju pristupa");
      setLoading(false);
      return;
    }

    setCompanies(companiesData || []);
    setProfiles(profilesData || []);

    // Combine data
    const combined: UserCompany[] = (userCompaniesData || []).map((uc) => ({
      ...uc,
      profile: profilesData?.find((p) => p.id === uc.user_id),
      company: companiesData?.find((c) => c.id === uc.company_id),
    }));

    setUserCompanies(combined);
    setLoading(false);
  };

  const handleAddAccess = async () => {
    if (!selectedUserId || !selectedCompanyId) {
      toast.error("Izaberite korisnika i firmu");
      return;
    }

    // Check if already exists
    const exists = userCompanies.find(
      (uc) => uc.user_id === selectedUserId && uc.company_id === selectedCompanyId
    );

    if (exists) {
      toast.error("Korisnik već ima pristup ovoj firmi");
      return;
    }

    const { error } = await supabase.from("user_companies").insert({
      user_id: selectedUserId,
      company_id: selectedCompanyId,
      is_local_admin: isLocalAdmin,
    });

    if (error) {
      toast.error("Greška pri dodeli pristupa");
      return;
    }

    toast.success("Pristup uspešno dodeljen");
    setIsDialogOpen(false);
    setSelectedUserId("");
    setSelectedCompanyId("");
    setIsLocalAdmin(false);
    fetchData();
  };

  const handleRemoveAccess = async (id: string) => {
    const { error } = await supabase.from("user_companies").delete().eq("id", id);

    if (error) {
      toast.error("Greška pri uklanjanju pristupa");
      return;
    }

    toast.success("Pristup uklonjen");
    fetchData();
  };

  const handleToggleLocalAdmin = async (uc: UserCompany) => {
    const { error } = await supabase
      .from("user_companies")
      .update({ is_local_admin: !uc.is_local_admin })
      .eq("id", uc.id);

    if (error) {
      toast.error("Greška pri ažuriranju");
      return;
    }

    toast.success(
      !uc.is_local_admin
        ? "Korisnik je sada lokalni admin"
        : "Uklonjena lokalna admin prava"
    );
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Upravljanje pristupom korisnika firmama
        </p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              Dodeli pristup
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Dodeli pristup firmi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Korisnik</Label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite korisnika" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.email || `${profile.first_name} ${profile.last_name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Firma</Label>
                <Select
                  value={selectedCompanyId}
                  onValueChange={setSelectedCompanyId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite firmu" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name} ({company.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isLocalAdmin"
                  checked={isLocalAdmin}
                  onCheckedChange={(checked) =>
                    setIsLocalAdmin(checked as boolean)
                  }
                />
                <Label htmlFor="isLocalAdmin" className="cursor-pointer">
                  Lokalni administrator
                </Label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Otkaži
                </Button>
                <Button onClick={handleAddAccess}>Dodeli</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="erp-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Učitavanje...
          </div>
        ) : userCompanies.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nema dodeljenih pristupa</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Korisnik</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Lokalni Admin</TableHead>
                <TableHead className="w-24">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userCompanies.map((uc) => (
                <TableRow key={uc.id}>
                  <TableCell className="font-medium">
                    {uc.profile?.email || "-"}
                  </TableCell>
                  <TableCell>
                    {uc.company?.name} ({uc.company?.code})
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={uc.is_local_admin || false}
                      onCheckedChange={() => handleToggleLocalAdmin(uc)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAccess(uc.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
