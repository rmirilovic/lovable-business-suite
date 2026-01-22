import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload, Copy, Check, Loader2, FileJson, FileText } from "lucide-react";

interface PartnerApiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExportResult {
  success: boolean;
  count: number;
  data: any[];
}

interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: { code: string; error: string }[];
}

export function PartnerApiDialog({ open, onOpenChange }: PartnerApiDialogProps) {
  const { selectedCompany } = useAuth();
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  
  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Import state
  const [importJson, setImportJson] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!selectedCompany) return;
    
    setExporting(true);
    setExportResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Niste prijavljeni");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partners-api?company_id=${selectedCompany.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Greška pri izvozu");
      }
      
      setExportResult(result);
      toast.success(`Izvezeno ${result.count} partnera`);
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(error.message || "Greška pri izvozu");
    } finally {
      setExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!exportResult) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportResult.data, null, 2));
      setCopied(true);
      toast.success("Kopirano u clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Greška pri kopiranju");
    }
  };

  const handleDownloadJson = () => {
    if (!exportResult) return;
    
    const blob = new Blob([JSON.stringify(exportResult.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partneri_${selectedCompany?.code || "export"}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("JSON fajl preuzet");
  };

  const validateJson = (text: string): boolean => {
    if (!text.trim()) {
      setJsonError(null);
      return false;
    }
    
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setJsonError("JSON mora biti niz partnera [ ... ]");
        return false;
      }
      if (parsed.length === 0) {
        setJsonError("Niz partnera je prazan");
        return false;
      }
      // Check if first item has required fields
      const first = parsed[0];
      if (!first.code || !first.name) {
        setJsonError("Svaki partner mora imati 'code' i 'name' polja");
        return false;
      }
      setJsonError(null);
      return true;
    } catch (e: any) {
      setJsonError(`Neispravan JSON format: ${e.message}`);
      return false;
    }
  };

  const handleJsonChange = (value: string) => {
    setImportJson(value);
    setImportResult(null);
    validateJson(value);
  };

  const handleImport = async () => {
    if (!selectedCompany) return;
    if (!validateJson(importJson)) {
      toast.error("Neispravan JSON format");
      return;
    }
    
    setImporting(true);
    setImportResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Niste prijavljeni");
        return;
      }

      const parsedData = JSON.parse(importJson);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partners-api?company_id=${selectedCompany.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: parsedData,
            update_existing: updateExisting,
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Greška pri uvozu");
      }
      
      setImportResult(result);
      toast.success(`Uvezeno: ${result.imported}, Ažurirano: ${result.updated}, Preskočeno: ${result.skipped}`);
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Greška pri uvozu");
    } finally {
      setImporting(false);
    }
  };

  const handleLoadFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportJson(text);
      validateJson(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDownloadDocs = () => {
    const docsContent = `# Partners API Dokumentacija

API za izvoz i uvoz partnera sa tekućim računima i kontakt osobama.

## Base URL

\`\`\`
${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partners-api
\`\`\`

## Autentifikacija

Svi zahtevi moraju sadržati JWT token u \`Authorization\` headeru:

\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

Token se dobija nakon uspešne prijave korisnika kroz Supabase Auth.

---

## Endpoints

### 1. Izvoz partnera (GET)

Vraća sve partnere za određenu firmu, zajedno sa njihovim tekućim računima i kontakt osobama.

#### Request

\`\`\`http
GET /partners-api?company_id=<uuid>
Authorization: Bearer <token>
\`\`\`

#### Query parametri

| Parametar    | Tip    | Obavezan | Opis                    |
|--------------|--------|----------|-------------------------|
| \`company_id\` | UUID   | Da       | ID firme za izvoz       |

#### Response (200 OK)

\`\`\`json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "code": "001",
      "name": "Primer Partner DOO",
      "legal_status": 1,
      "address": "Ulica 123",
      "postal_code": "11000",
      "city": "Beograd",
      "country": "Srbija",
      "email": "kontakt@primer.rs",
      "pib": "123456789",
      "mb": "12345678",
      "activity_code": "4791",
      "jbkjs": null,
      "website": "https://primer.rs",
      "responsible_person": "Petar Petrović",
      "phone": "+381111234567",
      "is_customer": true,
      "is_supplier": false,
      "is_in_pdv": true,
      "assigned_to": "Marko Marković",
      "note": "Napomena o partneru",
      "other_data": null,
      "is_active": true,
      "payment_priority": 1,
      "group_code": "GRUPA01",
      "bank_accounts": [
        {
          "account_number": "160-123456-78",
          "sort_order": 0
        }
      ],
      "contacts": [
        {
          "contact_name": "Ana Anić",
          "position": "Direktor",
          "phone1": "+381641234567",
          "phone2": "+381651234567",
          "email": "ana@primer.rs",
          "note": "Glavna kontakt osoba"
        }
      ]
    }
  ]
}
\`\`\`

---

### 2. Uvoz partnera (POST)

Uvozi partnere sa tekućim računima i kontakt osobama. Može kreirati nove ili ažurirati postojeće.

#### Request

\`\`\`http
POST /partners-api?company_id=<uuid>
Authorization: Bearer <token>
Content-Type: application/json
\`\`\`

#### Query parametri

| Parametar    | Tip    | Obavezan | Opis                    |
|--------------|--------|----------|-------------------------|
| \`company_id\` | UUID   | Da       | ID firme za uvoz        |

#### Body parametri

| Polje             | Tip      | Obavezan | Opis                                              |
|-------------------|----------|----------|---------------------------------------------------|
| \`data\`            | Array    | Da       | Niz partnera za uvoz                              |
| \`update_existing\` | Boolean  | Ne       | Ako je \`true\`, ažurira postojeće partnere po šifri (default: \`false\`) |

#### Primer request body

\`\`\`json
{
  "update_existing": true,
  "data": [
    {
      "code": "001",
      "name": "Primer Partner DOO",
      "legal_status": 1,
      "address": "Ulica 123",
      "postal_code": "11000",
      "city": "Beograd",
      "country": "Srbija",
      "email": "kontakt@primer.rs",
      "pib": "123456789",
      "mb": "12345678",
      "activity_code": "4791",
      "jbkjs": null,
      "website": "https://primer.rs",
      "responsible_person": "Petar Petrović",
      "phone": "+381111234567",
      "is_customer": true,
      "is_supplier": false,
      "is_in_pdv": true,
      "assigned_to": "Marko Marković",
      "note": "Napomena o partneru",
      "other_data": null,
      "is_active": true,
      "payment_priority": 1,
      "group_code": "GRUPA01",
      "bank_accounts": [
        {
          "account_number": "160-123456-78",
          "sort_order": 0
        }
      ],
      "contacts": [
        {
          "contact_name": "Ana Anić",
          "position": "Direktor",
          "phone1": "+381641234567",
          "phone2": null,
          "email": "ana@primer.rs",
          "note": null
        }
      ]
    }
  ]
}
\`\`\`

#### Response (200 OK)

\`\`\`json
{
  "success": true,
  "imported": 5,
  "updated": 2,
  "skipped": 1,
  "errors": [
    {
      "code": "ERR001",
      "error": "duplicate key value violates unique constraint"
    }
  ]
}
\`\`\`

---

## Struktura podataka

### Partner objekat

| Polje               | Tip      | Obavezan | Opis                                                    |
|---------------------|----------|----------|---------------------------------------------------------|
| \`code\`              | String   | Da       | Jedinstvena šifra partnera                              |
| \`name\`              | String   | Da       | Naziv partnera                                          |
| \`legal_status\`      | Integer  | Ne       | Pravni status: 1=Pravno lice, 2=Fizičko lice, 3=Javno preduzeće, 4=Ino partner |
| \`address\`           | String   | Ne       | Adresa                                                  |
| \`postal_code\`       | String   | Ne       | Poštanski broj                                          |
| \`city\`              | String   | Ne       | Grad/Mesto                                              |
| \`country\`           | String   | Ne       | Država (default: "Srbija", osim za legal_status=4)      |
| \`email\`             | String   | Ne       | Email adresa                                            |
| \`pib\`               | String   | Ne       | Poreski identifikacioni broj                            |
| \`mb\`                | String   | Ne       | Matični broj                                            |
| \`activity_code\`     | String   | Ne       | Šifra delatnosti                                        |
| \`jbkjs\`             | String   | Ne       | Jedinstveni broj korisnika javnih sredstava (max 31 kar)|
| \`website\`           | String   | Ne       | Web adresa                                              |
| \`responsible_person\`| String   | Ne       | Odgovorna osoba                                         |
| \`phone\`             | String   | Ne       | Telefon                                                 |
| \`is_customer\`       | Boolean  | Ne       | Da li je kupac (default: true)                          |
| \`is_supplier\`       | Boolean  | Ne       | Da li je dobavljač (default: false)                     |
| \`is_in_pdv\`         | Boolean  | Ne       | Da li je u sistemu PDV-a (default: true)                |
| \`assigned_to\`       | String   | Ne       | Zadužena osoba                                          |
| \`note\`              | String   | Ne       | Napomena                                                |
| \`other_data\`        | String   | Ne       | Ostali podaci                                           |
| \`is_active\`         | Boolean  | Ne       | Da li je aktivan (default: true)                        |
| \`payment_priority\`  | Integer  | Ne       | Prioritet plaćanja: 1, 2 ili 3 (default: 3)             |
| \`group_code\`        | String   | Ne       | Šifra grupe partnera (mora postojati u bazi)            |
| \`bank_accounts\`     | Array    | Ne       | Niz tekućih računa                                      |
| \`contacts\`          | Array    | Ne       | Niz kontakt osoba                                       |

### Tekući račun objekat

| Polje            | Tip     | Obavezan | Opis                           |
|------------------|---------|----------|--------------------------------|
| \`account_number\` | String  | Da       | Broj tekućeg računa            |
| \`sort_order\`     | Integer | Ne       | Redosled prikaza (default: 0)  |

### Kontakt osoba objekat

| Polje          | Tip    | Obavezan | Opis                    |
|----------------|--------|----------|-------------------------|
| \`contact_name\` | String | Da       | Ime i prezime kontakta  |
| \`position\`     | String | Ne       | Pozicija/funkcija       |
| \`phone1\`       | String | Ne       | Telefon 1               |
| \`phone2\`       | String | Ne       | Telefon 2               |
| \`email\`        | String | Ne       | Email adresa            |
| \`note\`         | String | Ne       | Napomena                |

---

## Greške

| Status | Opis                                          |
|--------|-----------------------------------------------|
| 400    | Neispravan zahtev (nedostaje company_id, loš format) |
| 401    | Nedostaje ili nevažeći token                  |
| 403    | Pristup odbijen (nema pristup firmi ili nije admin za uvoz) |
| 405    | Metoda nije dozvoljena                        |
| 500    | Interna greška servera                        |

### Primer greške

\`\`\`json
{
  "error": "Access denied to this company"
}
\`\`\`

---

## Primeri korišćenja

### cURL - Izvoz

\`\`\`bash
curl -X GET \\
  "${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partners-api?company_id=123e4567-e89b-12d3-a456-426614174000" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
\`\`\`

### cURL - Uvoz

\`\`\`bash
curl -X POST \\
  "${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partners-api?company_id=123e4567-e89b-12d3-a456-426614174000" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "update_existing": false,
    "data": [
      {
        "code": "TEST001",
        "name": "Test Partner",
        "is_customer": true
      }
    ]
  }'
\`\`\`

### JavaScript/TypeScript

\`\`\`typescript
import { supabase } from "@/integrations/supabase/client";

// Izvoz partnera
async function exportPartners(companyId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const res = await fetch(
    \`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partners-api?company_id=\${companyId}\`,
    {
      headers: {
        Authorization: \`Bearer \${session?.access_token}\`,
      },
    }
  );
  
  return res.json();
}

// Uvoz partnera
async function importPartners(companyId: string, partners: any[], updateExisting = false) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const res = await fetch(
    \`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partners-api?company_id=\${companyId}\`,
    {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${session?.access_token}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: partners,
        update_existing: updateExisting,
      }),
    }
  );
  
  return res.json();
}
\`\`\`

---

## Napomene

1. **Grupe partnera** - \`group_code\` mora odgovarati postojećoj šifri grupe u bazi za datu firmu. Ako grupa ne postoji, partner će biti uvezen bez grupe.

2. **Tekući računi i kontakti pri ažuriranju** - Kada se ažurira postojeći partner (\`update_existing: true\`), svi postojeći tekući računi i kontakti se brišu i zamenjuju novim iz zahteva.

3. **Minimalni podaci za uvoz** - Jedini obavezni podaci su \`code\` i \`name\`. Svi ostali imaju default vrednosti.

4. **Ograničenje pristupa** - Za izvoz je potreban pristup firmi (bilo koji korisnik sa pristupom). Za uvoz je potrebna admin uloga (super_admin ili local_admin za tu firmu).

5. **Batch obrada** - API koristi batch procesiranje (1000 zapisa po seriji) za stabilnost pri radu sa velikim setovima podataka.
`;

    const blob = new Blob([docsContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "partners-api-documentation.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Dokumentacija preuzeta");
  };

  const resetState = () => {
    setExportResult(null);
    setImportJson("");
    setImportResult(null);
    setJsonError(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5" />
              API Izvoz / Uvoz partnera
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={handleDownloadDocs}>
              <FileText className="w-4 h-4 mr-2" />
              Dokumentacija
            </Button>
          </div>
          <DialogDescription>
            Izvezite ili uvezite partnere sa tekućim računima i kontaktima u JSON formatu za integraciju sa drugim sistemima.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "export" | "import")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Izvoz
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Uvoz
            </TabsTrigger>
          </TabsList>

          {/* EXPORT TAB */}
          <TabsContent value="export" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Izvezite sve partnere iz firme <strong>{selectedCompany?.name}</strong> u JSON format.
              </p>
              <Button onClick={handleExport} disabled={exporting}>
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Izvoz...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Izvezi partnere
                  </>
                )}
              </Button>
            </div>

            {exportResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Rezultat: {exportResult.count} partnera
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
                      {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                      {copied ? "Kopirano" : "Kopiraj"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadJson}>
                      <Download className="w-4 h-4 mr-2" />
                      Preuzmi .json
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[400px] rounded-md border">
                  <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                    {JSON.stringify(exportResult.data, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Uvezite partnere iz JSON formata u firmu <strong>{selectedCompany?.name}</strong>.
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="update-existing"
                      checked={updateExisting}
                      onCheckedChange={setUpdateExisting}
                    />
                    <Label htmlFor="update-existing" className="text-sm">
                      Ažuriraj postojeće
                    </Label>
                  </div>
                  <label>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleLoadFromFile}
                    />
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        Učitaj fajl
                      </span>
                    </Button>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>JSON podaci (niz partnera)</Label>
                <Textarea
                  placeholder={`[
  {
    "code": "001",
    "name": "Primer Partner DOO",
    "is_customer": true,
    "bank_accounts": [
      { "account_number": "160-123456-78" }
    ],
    "contacts": [
      { "contact_name": "Petar Petrović" }
    ]
  }
]`}
                  className="font-mono text-xs min-h-[300px]"
                  value={importJson}
                  onChange={(e) => handleJsonChange(e.target.value)}
                />
                {jsonError && (
                  <p className="text-sm text-destructive">{jsonError}</p>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleImport}
                  disabled={importing || !importJson.trim() || !!jsonError}
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uvoz...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Uvezi partnere
                    </>
                  )}
                </Button>
              </div>

              {importResult && (
                <div className="rounded-md border p-4 space-y-2">
                  <h4 className="font-medium">Rezultat uvoza</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex flex-col items-center p-3 rounded-md bg-primary/10 text-primary">
                      <span className="text-2xl font-bold">{importResult.imported}</span>
                      <span>Uvezeno</span>
                    </div>
                    <div className="flex flex-col items-center p-3 rounded-md bg-accent text-accent-foreground">
                      <span className="text-2xl font-bold">{importResult.updated}</span>
                      <span>Ažurirano</span>
                    </div>
                    <div className="flex flex-col items-center p-3 rounded-md bg-muted text-muted-foreground">
                      <span className="text-2xl font-bold">{importResult.skipped}</span>
                      <span>Preskočeno</span>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-destructive mb-2">
                        Greške ({importResult.errors.length}):
                      </p>
                      <ScrollArea className="h-[100px] rounded-md border border-destructive/20">
                        <div className="p-2 space-y-1">
                          {importResult.errors.map((err, i) => (
                            <p key={i} className="text-xs text-destructive">
                              <strong>{err.code}:</strong> {err.error}
                            </p>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
