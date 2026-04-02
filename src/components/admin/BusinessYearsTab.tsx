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
import { Plus, Calendar, Lock, Unlock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";

interface Company {
  id: string;
  name: string;
  code: string;
}

interface BusinessYear {
  id: string;
  year: number;
  company_id: string;
  is_active: boolean | null;
  is_closed: boolean | null;
  company?: Company;
}

export function BusinessYearsTab() {
  const { isSuperAdmin, localAdminCompanyIds } = useAuth();
  const [businessYears, setBusinessYears] = useState<BusinessYear[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [filterCompanyId, setFilterCompanyId] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, [isSuperAdmin, localAdminCompanyIds]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch companies - local admins only see their companies
    let companiesQuery = supabase
      .from("companies")
      .select("id, name, code")
      .order("name");

    if (!isSuperAdmin && localAdminCompanyIds.length > 0) {
      companiesQuery = companiesQuery.in("id", localAdminCompanyIds);
    }

    const { data: companiesData } = await companiesQuery;

    // Fetch business years - local admins only see years for their companies
    let yearsQuery = supabase
      .from("business_years")
      .select("*")
      .order("year", { ascending: false });

    if (!isSuperAdmin && localAdminCompanyIds.length > 0) {
      yearsQuery = yearsQuery.in("company_id", localAdminCompanyIds);
    }

    const { data: yearsData, error } = await yearsQuery;

    if (error) {
      toast.error("Greška pri učitavanju poslovnih godina");
      setLoading(false);
      return;
    }

    setCompanies(companiesData || []);

    // Combine data
    const combined: BusinessYear[] = (yearsData || []).map((by) => ({
      ...by,
      company: companiesData?.find((c) => c.id === by.company_id),
    }));

    setBusinessYears(combined);
    setLoading(false);
  };

  const handleAddYear = async () => {
    if (!selectedCompanyId || !newYear) {
      toast.error("Izaberite firmu i unesite godinu");
      return;
    }

    const yearNum = parseInt(newYear);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      toast.error("Unesite validnu godinu (2000-2100)");
      return;
    }

    // Check if year already exists for this company
    const exists = businessYears.find(
      (by) => by.company_id === selectedCompanyId && by.year === yearNum
    );

    if (exists) {
      toast.error("Ova poslovna godina već postoji za izabranu firmu");
      return;
    }

    const { error } = await supabase.from("business_years").insert({
      company_id: selectedCompanyId,
      year: yearNum,
      is_active: true,
      is_closed: false,
    });

    if (error) {
      toast.error("Greška pri kreiranju poslovne godine");
      return;
    }

    toast.success("Poslovna godina uspešno kreirana");
    setIsDialogOpen(false);
    setSelectedCompanyId("");
    setNewYear(new Date().getFullYear().toString());
    fetchData();
  };

  const handleToggleActive = async (by: BusinessYear) => {
    const { error } = await supabase
      .from("business_years")
      .update({ is_active: !by.is_active })
      .eq("id", by.id);

    if (error) {
      toast.error("Greška pri ažuriranju");
      return;
    }

    toast.success(
      !by.is_active ? "Godina aktivirana" : "Godina deaktivirana"
    );
    fetchData();
  };

  const handleToggleClosed = async (by: BusinessYear) => {
    if (!by.is_closed && by.is_active) {
      // If closing an active year, deactivate it first
      const { error } = await supabase
        .from("business_years")
        .update({ is_closed: true, is_active: false })
        .eq("id", by.id);

      if (error) {
        toast.error("Greška pri zatvaranju godine");
        return;
      }
      toast.success("Godina zatvorena");
    } else if (by.is_closed) {
      // Reopen year
      const { error } = await supabase
        .from("business_years")
        .update({ is_closed: false })
        .eq("id", by.id);

      if (error) {
        toast.error("Greška pri otvaranju godine");
        return;
      }
      toast.success("Godina ponovo otvorena");
    } else {
      // Just close
      const { error } = await supabase
        .from("business_years")
        .update({ is_closed: true })
        .eq("id", by.id);

      if (error) {
        toast.error("Greška pri zatvaranju godine");
        return;
      }
      toast.success("Godina zatvorena");
    }
    fetchData();
  };

  const filteredYears = filterCompanyId === "all"
    ? businessYears
    : businessYears.filter((by) => by.company_id === filterCompanyId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1 max-w-sm">
          <Select value={filterCompanyId} onValueChange={setFilterCompanyId}>
            <SelectTrigger>
              <SelectValue placeholder="Filtriraj po firmi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Sve firme</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name} ({company.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova poslovna godina
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Nova poslovna godina</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="year">Godina</Label>
                <Input
                  id="year"
                  type="number"
                  min="2000"
                  max="2100"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Otkaži
                </Button>
                <Button onClick={handleAddYear}>Kreiraj</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="erp-card overflow-hidden">
        <TableScrollContainer>
          {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Učitavanje...
          </div>
        ) : filteredYears.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nema poslovnih godina</p>
          </div>
        ) : (
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Firma</TableHead>
                <TableHead>Godina</TableHead>
                <TableHead>Aktivna</TableHead>
                <TableHead>Zatvorena</TableHead>
                <TableHead className="w-32">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredYears.map((by) => (
                <TableRow key={by.id}>
                  <TableCell>
                    {by.company?.name} ({by.company?.code})
                  </TableCell>
                  <TableCell className="font-mono font-medium">
                    {by.year}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        by.is_active
                          ? "erp-badge-success"
                          : "erp-badge-destructive"
                      }
                    >
                      {by.is_active ? "Da" : "Ne"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        by.is_closed
                          ? "bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs"
                          : "bg-primary/10 text-primary px-2 py-1 rounded-full text-xs"
                      }
                    >
                      {by.is_closed ? "Zatvorena" : "Otvorena"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(by)}
                        title={by.is_active ? "Deaktiviraj" : "Aktiviraj"}
                        disabled={by.is_closed === true}
                      >
                        {by.is_active ? (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-primary" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleClosed(by)}
                        title={by.is_closed ? "Otvori godinu" : "Zatvori godinu"}
                      >
                        {by.is_closed ? (
                          <Unlock className="w-4 h-4 text-primary" />
                        ) : (
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </TableScrollContainer>
      </div>  
    </div>
  );
}
