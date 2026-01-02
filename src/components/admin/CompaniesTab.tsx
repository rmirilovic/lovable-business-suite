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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit2, Trash2, Search, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Company {
  id: string;
  code: string;
  name: string;
  pib: string | null;
  mb: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean | null;
}

export function CompaniesTab() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    pib: "",
    mb: "",
    address: "",
    city: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Greška pri učitavanju firmi");
    } else {
      setCompanies(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code || !formData.name) {
      toast.error("Šifra i naziv su obavezni");
      return;
    }

    if (editingCompany) {
      const { error } = await supabase
        .from("companies")
        .update({
          code: formData.code,
          name: formData.name,
          pib: formData.pib || null,
          mb: formData.mb || null,
          address: formData.address || null,
          city: formData.city || null,
          phone: formData.phone || null,
          email: formData.email || null,
        })
        .eq("id", editingCompany.id);

      if (error) {
        toast.error("Greška pri ažuriranju firme");
      } else {
        toast.success("Firma uspešno ažurirana");
        setIsDialogOpen(false);
        fetchCompanies();
      }
    } else {
      const { error } = await supabase.from("companies").insert({
        code: formData.code,
        name: formData.name,
        pib: formData.pib || null,
        mb: formData.mb || null,
        address: formData.address || null,
        city: formData.city || null,
        phone: formData.phone || null,
        email: formData.email || null,
      });

      if (error) {
        toast.error("Greška pri kreiranju firme");
      } else {
        toast.success("Firma uspešno kreirana");
        setIsDialogOpen(false);
        fetchCompanies();
      }
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      code: company.code,
      name: company.name,
      pib: company.pib || "",
      mb: company.mb || "",
      address: company.address || "",
      city: company.city || "",
      phone: company.phone || "",
      email: company.email || "",
    });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCompany(null);
    setFormData({
      code: "",
      name: "",
      pib: "",
      mb: "",
      address: "",
      city: "",
      phone: "",
      email: "",
    });
    setIsDialogOpen(true);
  };

  const filteredCompanies = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pretraži firme..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd} className="gap-2">
              <Plus className="w-4 h-4" />
              Nova firma
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCompany ? "Izmeni firmu" : "Nova firma"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Šifra *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Naziv *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pib">PIB</Label>
                  <Input
                    id="pib"
                    value={formData.pib}
                    onChange={(e) =>
                      setFormData({ ...formData, pib: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mb">Matični broj</Label>
                  <Input
                    id="mb"
                    value={formData.mb}
                    onChange={(e) =>
                      setFormData({ ...formData, mb: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adresa</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Grad</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
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
                <Button type="submit">
                  {editingCompany ? "Sačuvaj" : "Kreiraj"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="erp-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Učitavanje...
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nema pronađenih firmi</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Šifra</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead>PIB</TableHead>
                <TableHead>Grad</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-mono text-primary">
                    {company.code}
                  </TableCell>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>{company.pib || "-"}</TableCell>
                  <TableCell>{company.city || "-"}</TableCell>
                  <TableCell>
                    <span
                      className={
                        company.is_active !== false
                          ? "erp-badge-success"
                          : "erp-badge-destructive"
                      }
                    >
                      {company.is_active !== false ? "Aktivna" : "Neaktivna"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(company)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
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
