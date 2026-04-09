import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Edit2, Search, Building2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";

interface Company {
  id: string;
  code: string;
  name: string;
  pib: string | null;
  mb: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  mesto_prometa: string | null;
  municipality_code: string | null;
  municipality: string | null;
  activity_code: string | null;
  phone: string | null;
  email: string | null;
  responsible_person_name: string | null;
  responsible_person_email: string | null;
  invoice_note_1: string | null;
  invoice_note_2: string | null;
  quote_note_1: string | null;
  quote_note_2: string | null;
  logo_url: string | null;
  logo_text: string | null;
  is_active: boolean | null;
   idle_timeout_hours: number | null;
   max_concurrent_sessions: number | null;
   vat_period_type: string;
}

interface FormData {
  code: string;
  name: string;
  pib: string;
  mb: string;
  address: string;
  city: string;
  postal_code: string;
  mesto_prometa: string;
  municipality_code: string;
  municipality: string;
  activity_code: string;
  phone: string;
  email: string;
  responsible_person_name: string;
  responsible_person_email: string;
  responsible_person_jmbg: string;
  api_token: string;
  api_demo_token: string;
  invoice_note_1: string;
  invoice_note_2: string;
  quote_note_1: string;
  quote_note_2: string;
  logo_url: string;
  logo_text: string;
  idle_timeout_hours: string;
  max_concurrent_sessions: string;
  vat_period_type: string;
}

const emptyFormData: FormData = {
  code: "",
  name: "",
  pib: "",
  mb: "",
  address: "",
  city: "",
  postal_code: "",
  mesto_prometa: "",
  municipality_code: "",
  municipality: "",
  activity_code: "",
  phone: "",
  email: "",
  responsible_person_name: "",
  responsible_person_email: "",
  responsible_person_jmbg: "",
  api_token: "",
  api_demo_token: "",
  invoice_note_1: "",
  invoice_note_2: "",
  quote_note_1: "",
  quote_note_2: "",
  logo_url: "",
  logo_text: "",
  idle_timeout_hours: "",
  max_concurrent_sessions: "",
  vat_period_type: "monthly",
};

export function CompaniesTab() {
  const { isSuperAdmin, isLocalAdmin, localAdminCompanyIds } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [activeFormTab, setActiveFormTab] = useState("basic");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local admins can only edit, not create new companies
  const canCreateCompany = isSuperAdmin;

  useEffect(() => {
    fetchCompanies();
  }, [isSuperAdmin, localAdminCompanyIds]);

  const fetchCompanies = async () => {
    setLoading(true);
    
    let query = supabase.from("companies").select("*").order("name");
    
    // Local admins only see their companies
    if (!isSuperAdmin && isLocalAdmin && localAdminCompanyIds.length > 0) {
      query = query.in("id", localAdminCompanyIds);
    }
    
    const { data, error } = await query;

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

    let logoUrl = formData.logo_url;

    // Upload logo if a new file was selected
    if (logoFile) {
      setUploadingLogo(true);
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${formData.code}-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, logoFile, { upsert: true });

      if (uploadError) {
        toast.error("Greška pri uploadu loga");
        setUploadingLogo(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      logoUrl = publicUrlData.publicUrl;
      setUploadingLogo(false);
    }
    const companyData = {
      code: formData.code,
      name: formData.name,
      pib: formData.pib || null,
      mb: formData.mb || null,
      address: formData.address || null,
      city: formData.city || null,
      postal_code: formData.postal_code || null,
      mesto_prometa: formData.mesto_prometa || null,
      municipality_code: formData.municipality_code || null,
      municipality: formData.municipality || null,
      activity_code: formData.activity_code || null,
      phone: formData.phone || null,
      email: formData.email || null,
      responsible_person_name: formData.responsible_person_name || null,
      responsible_person_email: formData.responsible_person_email || null,
      invoice_note_1: formData.invoice_note_1 || null,
      invoice_note_2: formData.invoice_note_2 || null,
      quote_note_1: formData.quote_note_1 || null,
      quote_note_2: formData.quote_note_2 || null,
      logo_url: logoUrl || null,
      logo_text: formData.logo_text || null,
      idle_timeout_hours: formData.idle_timeout_hours ? parseFloat(formData.idle_timeout_hours) : null,
      max_concurrent_sessions: formData.max_concurrent_sessions ? parseInt(formData.max_concurrent_sessions, 10) : null,
      vat_period_type: formData.vat_period_type || "monthly",
    };

    if (editingCompany) {
      const { error } = await supabase
        .from("companies")
        .update(companyData)
        .eq("id", editingCompany.id);

      if (error) {
        toast.error("Greška pri ažuriranju firme");
      } else {
        // Save secrets separately
        const secretsData = {
          api_token: formData.api_token || null,
          api_demo_token: formData.api_demo_token || null,
          responsible_person_jmbg: formData.responsible_person_jmbg || null,
        };
        await supabase
          .from("company_secrets")
          .upsert({ company_id: editingCompany.id, ...secretsData }, { onConflict: "company_id" });

        toast.success("Firma uspešno ažurirana");
        setIsDialogOpen(false);
        fetchCompanies();
      }
    } else {
      const { data: inserted, error } = await supabase.from("companies").insert(companyData).select("id").single();

      if (error) {
        toast.error("Greška pri kreiranju firme");
      } else {
        // Save secrets for new company
        const secretsData = {
          company_id: inserted.id,
          api_token: formData.api_token || null,
          api_demo_token: formData.api_demo_token || null,
          responsible_person_jmbg: formData.responsible_person_jmbg || null,
        };
        await supabase.from("company_secrets").insert(secretsData);

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
      postal_code: company.postal_code || "",
      mesto_prometa: company.mesto_prometa || "",
      municipality_code: company.municipality_code || "",
      municipality: company.municipality || "",
      activity_code: company.activity_code || "",
      phone: company.phone || "",
      email: company.email || "",
      responsible_person_name: company.responsible_person_name || "",
      responsible_person_email: company.responsible_person_email || "",
      responsible_person_jmbg: "",
      api_token: "",
      api_demo_token: "",
      invoice_note_1: company.invoice_note_1 || "",
      invoice_note_2: company.invoice_note_2 || "",
      quote_note_1: company.quote_note_1 || "",
      quote_note_2: company.quote_note_2 || "",
      logo_url: company.logo_url || "",
      logo_text: company.logo_text || "",
      idle_timeout_hours: company.idle_timeout_hours != null ? String(company.idle_timeout_hours) : "",
      max_concurrent_sessions: company.max_concurrent_sessions != null ? String(company.max_concurrent_sessions) : "",
      vat_period_type: (company as any).vat_period_type || "monthly",
    });
    setLogoFile(null);
    setLogoPreview(company.logo_url || null);
    setActiveFormTab("basic");
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCompany(null);
    setFormData(emptyFormData);
    setLogoFile(null);
    setLogoPreview(null);
    setActiveFormTab("basic");
    setIsDialogOpen(true);
  };

  const updateFormField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    updateFormField("logo_url", "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
          {canCreateCompany && (
            <DialogTrigger asChild>
              <Button onClick={handleAdd} className="gap-2">
                <Plus className="w-4 h-4" />
                Nova firma
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCompany ? "Izmeni firmu" : "Nova firma"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs value={activeFormTab} onValueChange={setActiveFormTab}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="basic">Osnovno</TabsTrigger>
                  <TabsTrigger value="location">Lokacija</TabsTrigger>
                  <TabsTrigger value="person">Osoba</TabsTrigger>
                  <TabsTrigger value="api">API</TabsTrigger>
                  <TabsTrigger value="docs">Dokumenti</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="code">Šifra *</Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => updateFormField("code", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Naziv *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => updateFormField("name", e.target.value)}
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
                        onChange={(e) => updateFormField("pib", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mb">Matični broj</Label>
                      <Input
                        id="mb"
                        value={formData.mb}
                        onChange={(e) => updateFormField("mb", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="activity_code">Šifra delatnosti</Label>
                      <Input
                        id="activity_code"
                        value={formData.activity_code}
                        onChange={(e) => updateFormField("activity_code", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefon</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => updateFormField("phone", e.target.value)}
                      />
                    </div>
                  </div>
                   <div className="space-y-2">
                     <Label htmlFor="email">Email</Label>
                     <Input
                       id="email"
                       type="email"
                       value={formData.email}
                       onChange={(e) => updateFormField("email", e.target.value)}
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="vat_period_type">PDV obveznik</Label>
                     <select
                       id="vat_period_type"
                       value={formData.vat_period_type}
                       onChange={(e) => updateFormField("vat_period_type", e.target.value)}
                       className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                     >
                       <option value="monthly">Mesečni</option>
                       <option value="quarterly">Kvartalni</option>
                     </select>
                   </div>
                </TabsContent>

                <TabsContent value="location" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Adresa</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => updateFormField("address", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Mesto</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => updateFormField("city", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Poštanski broj</Label>
                      <Input
                        id="postal_code"
                        value={formData.postal_code}
                        onChange={(e) => updateFormField("postal_code", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mesto_prometa">Mesto prometa</Label>
                    <Input
                      id="mesto_prometa"
                      value={formData.mesto_prometa}
                      onChange={(e) => updateFormField("mesto_prometa", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="municipality_code">Šifra opštine</Label>
                      <Input
                        id="municipality_code"
                        value={formData.municipality_code}
                        onChange={(e) => updateFormField("municipality_code", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="municipality">Opština</Label>
                      <Input
                        id="municipality"
                        value={formData.municipality}
                        onChange={(e) => updateFormField("municipality", e.target.value)}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="person" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="responsible_person_name">Ime i prezime odgovorne osobe</Label>
                    <Input
                      id="responsible_person_name"
                      value={formData.responsible_person_name}
                      onChange={(e) => updateFormField("responsible_person_name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="responsible_person_email">E-mail odgovorne osobe</Label>
                    <Input
                      id="responsible_person_email"
                      type="email"
                      value={formData.responsible_person_email}
                      onChange={(e) => updateFormField("responsible_person_email", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="responsible_person_jmbg">JMBG odgovorne osobe</Label>
                    <Input
                      id="responsible_person_jmbg"
                      value={formData.responsible_person_jmbg}
                      onChange={(e) => updateFormField("responsible_person_jmbg", e.target.value)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="api" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="api_token">Token (produkcija)</Label>
                    <Input
                      id="api_token"
                      value={formData.api_token}
                      onChange={(e) => updateFormField("api_token", e.target.value)}
                      placeholder="Ključ za produkcioni API"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api_demo_token">Demo Token (testiranje)</Label>
                    <Input
                      id="api_demo_token"
                      value={formData.api_demo_token}
                      onChange={(e) => updateFormField("api_demo_token", e.target.value)}
                      placeholder="Ključ za testni API"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="idle_timeout_hours">Tajmout neaktivnosti (u satima)</Label>
                    <Input
                      id="idle_timeout_hours"
                      type="number"
                      min="0.5"
                      max="24"
                      step="0.5"
                      value={formData.idle_timeout_hours}
                      onChange={(e) => updateFormField("idle_timeout_hours", e.target.value)}
                      placeholder="Npr. 2 (prazno = isključeno)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Nakon zadatog broja sati neaktivnosti korisnik će biti upozoren, a zatim automatski odjavljen. Ostavite prazno da biste isključili ovu funkciju.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_concurrent_sessions">Maks. broj istovremenih sesija</Label>
                    <Input
                      id="max_concurrent_sessions"
                      type="number"
                      min="1"
                      max="999"
                      step="1"
                      value={formData.max_concurrent_sessions}
                      onChange={(e) => updateFormField("max_concurrent_sessions", e.target.value)}
                      placeholder="Npr. 5 (prazno = neograničeno)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maksimalan broj istovremenih aktivnih sesija za ovu firmu. Kada se dostigne limit, novi korisnici neće moći da pristupe dok se neka sesija ne oslobodi. Ostavite prazno za neograničen pristup.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="docs" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Logo (memorandum)</Label>
                      <div className="flex flex-col gap-3">
                        {logoPreview ? (
                          <div className="relative w-full max-w-[200px]">
                            <img 
                              src={logoPreview} 
                              alt="Logo preview" 
                              className="w-full h-auto max-h-24 object-contain border rounded-md p-2 bg-muted"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6"
                              onClick={handleRemoveLogo}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className="w-full max-w-[200px] h-24 border-2 border-dashed rounded-md flex items-center justify-center cursor-pointer hover:border-primary transition-colors bg-muted/50"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <div className="text-center text-muted-foreground">
                              <Upload className="h-6 w-6 mx-auto mb-1" />
                              <span className="text-xs">Klikni za upload</span>
                            </div>
                          </div>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileChange}
                          className="hidden"
                        />
                        {logoPreview && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-fit"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Promeni logo
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logo_text">Tekst uz logo</Label>
                      <Textarea
                        id="logo_text"
                        value={formData.logo_text}
                        onChange={(e) => updateFormField("logo_text", e.target.value)}
                        rows={5}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice_note_1">Napomena faktura 1</Label>
                    <Textarea
                      id="invoice_note_1"
                      value={formData.invoice_note_1}
                      onChange={(e) => updateFormField("invoice_note_1", e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice_note_2">Napomena faktura 2</Label>
                    <Textarea
                      id="invoice_note_2"
                      value={formData.invoice_note_2}
                      onChange={(e) => updateFormField("invoice_note_2", e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quote_note_1">Napomena ponuda 1</Label>
                    <Textarea
                      id="quote_note_1"
                      value={formData.quote_note_1}
                      onChange={(e) => updateFormField("quote_note_1", e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quote_note_2">Napomena ponuda 2</Label>
                    <Textarea
                      id="quote_note_2"
                      value={formData.quote_note_2}
                      onChange={(e) => updateFormField("quote_note_2", e.target.value)}
                      rows={2}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-4 border-t">
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
        <TableScrollContainer>
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
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Šifra</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead>PIB</TableHead>
                <TableHead>Mesto</TableHead>
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
        </TableScrollContainer>
      </div>  
    </div>
  );
}
