import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download,
  Upload,
  Copy,
  FileJson,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  FolderTree,
} from "lucide-react";

interface ArticleApiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExportResult {
  success: boolean;
  classifications_count: number;
  articles_count: number;
  data: {
    classifications: any[];
    articles: any[];
  };
}

interface ImportResult {
  success: boolean;
  classifications: {
    imported: number;
    updated: number;
    skipped: number;
    errors: { code: string; error: string }[];
  };
  articles: {
    imported: number;
    updated: number;
    skipped: number;
    errors: { code: string; error: string }[];
  };
}

export function ArticleApiDialog({ open, onOpenChange }: ArticleApiDialogProps) {
  const { selectedCompany } = useAuth();
  const [activeTab, setActiveTab] = useState("export");
  
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [jsonValid, setJsonValid] = useState<boolean | null>(null);

  const handleExport = async () => {
    if (!selectedCompany) {
      toast.error("Izaberite firmu");
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setExportResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Niste prijavljeni");
      }

      const response = await fetch(
        `https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api?company_id=${selectedCompany.id}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Greška pri izvozu");
      }

      setExportResult(result);
      toast.success(`Izvezeno ${result.classifications_count} klasifikacija i ${result.articles_count} artikala`);
    } catch (error: any) {
      console.error("Export error:", error);
      setExportError(error.message);
      toast.error(error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!exportResult?.data) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportResult.data, null, 2));
      toast.success("Kopirano u clipboard");
    } catch (error) {
      toast.error("Greška pri kopiranju");
    }
  };

  const handleDownloadJson = () => {
    if (!exportResult?.data) return;

    const blob = new Blob([JSON.stringify(exportResult.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `artikli_klasifikacije_${selectedCompany?.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Fajl preuzet");
  };

  const handleDownloadDocs = () => {
    const docsContent = `# Articles API Dokumentacija

API za izvoz i uvoz artikala sa klasifikacijama i atributima.

## Base URL

\`\`\`
https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api
\`\`\`

## Autentifikacija

Svi zahtevi moraju sadržati JWT token u \`Authorization\` headeru:

\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

Token se dobija nakon uspešne prijave korisnika kroz Supabase Auth.

---

## Endpoints

### 1. Izvoz artikala i klasifikacija (GET)

Vraća sve artikle i klasifikacije za određenu firmu, zajedno sa atributima artikala.

#### Request

\`\`\`http
GET /articles-api?company_id=<uuid>
Authorization: Bearer <token>
\`\`\`

#### Query parametri

| Parametar     | Tip    | Obavezan | Opis                |
|---------------|--------|----------|---------------------|
| \`company_id\`  | UUID   | Da       | ID firme za izvoz   |

#### Response (200 OK)

\`\`\`json
{
  "success": true,
  "classifications_count": 15,
  "articles_count": 1200,
  "data": {
    "classifications": [
      {
        "code": "01",
        "name": "Prehrambeni proizvodi",
        "parent_code": null
      },
      {
        "code": "0101",
        "name": "Mliječni proizvodi",
        "parent_code": "01"
      }
    ],
    "articles": [
      {
        "code": "001",
        "name": "Primer Artikal",
        "article_group": "0101",
        "unit": "kom",
        "purchase_price": 100.00,
        "selling_price": 150.00,
        "stock": 50,
        "min_stock": 10,
        "is_active": true,
        "svk": "0",
        "kg_po_jm": 0.5,
        "kol_mas": null,
        "attributes": [
          {
            "attribute_code": "BOJA",
            "value": "Crvena"
          },
          {
            "attribute_code": "VELICINA",
            "value": "XL"
          }
        ]
      }
    ]
  }
}
\`\`\`

---

### 2. Uvoz artikala i klasifikacija (POST)

Uvozi klasifikacije i artikle sa atributima. Može kreirati nove ili ažurirati postojeće.

#### Request

\`\`\`http
POST /articles-api?company_id=<uuid>
Authorization: Bearer <token>
Content-Type: application/json
\`\`\`

#### Query parametri

| Parametar     | Tip    | Obavezan | Opis                |
|---------------|--------|----------|---------------------|
| \`company_id\`  | UUID   | Da       | ID firme za uvoz    |

#### Body parametri

| Polje             | Tip      | Obavezan | Opis                                              |
|-------------------|----------|----------|---------------------------------------------------|
| \`classifications\` | Array    | Ne       | Niz klasifikacija za uvoz                         |
| \`articles\`        | Array    | Da       | Niz artikala za uvoz                              |
| \`update_existing\` | Boolean  | Ne       | Ako je \`true\`, ažurira postojeće po šifri (default: \`false\`) |

**Napomena:** API podržava i legacy format \`{ data: [...] }\` za samo artikle.

#### Primer request body

\`\`\`json
{
  "update_existing": true,
  "classifications": [
    {
      "code": "01",
      "name": "Prehrambeni proizvodi",
      "parent_code": null
    },
    {
      "code": "0101",
      "name": "Mliječni proizvodi",
      "parent_code": "01"
    }
  ],
  "articles": [
    {
      "code": "001",
      "name": "Primer Artikal",
      "article_group": "0101",
      "unit": "kom",
      "purchase_price": 100.00,
      "selling_price": 150.00,
      "stock": 50,
      "min_stock": 10,
      "is_active": true,
      "svk": "0",
      "kg_po_jm": 0.5,
      "kol_mas": null,
      "attributes": [
        {
          "attribute_code": "BOJA",
          "value": "Crvena"
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
  "classifications": {
    "imported": 10,
    "updated": 5,
    "skipped": 2,
    "errors": []
  },
  "articles": {
    "imported": 100,
    "updated": 50,
    "skipped": 10,
    "errors": [
      {
        "code": "ERR001",
        "error": "duplicate key value violates unique constraint"
      }
    ]
  }
}
\`\`\`

---

## Struktura podataka

### Klasifikacija objekat

| Polje         | Tip    | Obavezan | Opis                                         |
|---------------|--------|----------|----------------------------------------------|
| \`code\`        | String | Da       | Jedinstvena šifra klasifikacije              |
| \`name\`        | String | Da       | Naziv klasifikacije                          |
| \`parent_code\` | String | Ne       | Šifra nadređene klasifikacije (null = koren) |

### Artikal objekat

| Polje            | Tip      | Obavezan | Opis                                                    |
|------------------|----------|----------|---------------------------------------------------------|
| \`code\`           | String   | Da       | Jedinstvena šifra artikla                               |
| \`name\`           | String   | Da       | Naziv artikla                                           |
| \`article_group\`  | String   | Ne       | Šifra klasifikacije/grupe artikla                       |
| \`unit\`           | String   | Ne       | Jedinica mere (default: "kom")                          |
| \`purchase_price\` | Number   | Ne       | Nabavna cena (default: 0)                               |
| \`selling_price\`  | Number   | Ne       | Prodajna cena (default: 0)                              |
| \`stock\`          | Number   | Ne       | Trenutna količina na lageru (default: 0)                |
| \`min_stock\`      | Number   | Ne       | Minimalna količina za alarm (default: 0)                |
| \`is_active\`      | Boolean  | Ne       | Da li je aktivan (default: true)                        |
| \`svk\`            | String   | Ne       | SVK tip: "0", "1", "2", "6", "8", "9" (null = nije definisano) |
| \`kg_po_jm\`       | Number   | Ne       | Kilograma po jedinici mere                              |
| \`kol_mas\`        | Number   | Ne       | Količina mase                                           |
| \`attributes\`     | Array    | Ne       | Niz atributa artikla                                    |

### SVK tipovi

| Vrednost | Opis                    |
|----------|-------------------------|
| \`0\`      | Roba                    |
| \`1\`      | Proizvod                |
| \`2\`      | Usluga                  |
| \`6\`      | Prevozna usluga         |
| \`8\`      | Vraćena roba (refakcija)|
| \`9\`      | Ostalo                  |

### Atribut objekat

| Polje            | Tip    | Obavezan | Opis                                    |
|------------------|--------|----------|-----------------------------------------|
| \`attribute_code\` | String | Da       | Šifra atributa (mora postojati u bazi)  |
| \`value\`          | String | Da       | Vrednost atributa                       |

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
  "https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api?company_id=<uuid>" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
\`\`\`

### cURL - Uvoz

\`\`\`bash
curl -X POST \\
  "https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api?company_id=<uuid>" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "update_existing": false,
    "classifications": [
      {
        "code": "01",
        "name": "Grupa 1",
        "parent_code": null
      }
    ],
    "articles": [
      {
        "code": "TEST001",
        "name": "Test Artikal",
        "article_group": "01",
        "unit": "kom"
      }
    ]
  }'
\`\`\`

### JavaScript/TypeScript

\`\`\`typescript
import { supabase } from "@/integrations/supabase/client";

// Izvoz artikala i klasifikacija
async function exportArticles(companyId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const res = await fetch(
    \`https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api?company_id=\${companyId}\`,
    {
      headers: {
        Authorization: \`Bearer \${session?.access_token}\`,
      },
    }
  );
  
  return res.json();
}

// Uvoz artikala i klasifikacija
async function importArticles(
  companyId: string, 
  classifications: any[], 
  articles: any[], 
  updateExisting = false
) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const res = await fetch(
    \`https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api?company_id=\${companyId}\`,
    {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${session?.access_token}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        classifications,
        articles,
        update_existing: updateExisting,
      }),
    }
  );
  
  return res.json();
}
\`\`\`

---

## Napomene

1. **Redosled uvoza** - Klasifikacije se uvoze pre artikala, tako da artikli mogu referisati novouvedene klasifikacije.

2. **Hijerarhija klasifikacija** - Klasifikacije bez \`parent_code\` su korenski nivoi. Klasifikacije sa \`parent_code\` moraju referisati postojeću ili prethodno uvezenu šifru.

3. **Atributi artikala** - \`attribute_code\` mora odgovarati postojećoj šifri atributa u bazi za datu firmu. Ako atribut ne postoji, taj par atribut-vrednost se preskače.

4. **Atributi pri ažuriranju** - Kada se ažurira postojeći artikal (\`update_existing: true\`), svi postojeći atributi se brišu i zamenjuju novim iz zahteva.

5. **Minimalni podaci za uvoz** - Za klasifikacije su obavezni \`code\` i \`name\`. Za artikle su obavezni \`code\` i \`name\`. Svi ostali imaju default vrednosti.

6. **Ograničenje pristupa** - Za izvoz je potreban pristup firmi (bilo koji korisnik sa pristupom). Za uvoz je potrebna admin uloga (super_admin ili local_admin za tu firmu).

7. **Artikli su jedinstveni za firmu** - Šifarnik artikala je zajednički za sve poslovne godine jedne firme.

8. **Batch procesiranje** - API koristi batch upite za velike setove podataka (1000 zapisa po batch-u za osnovne podatke, 100 ID-ova po batch-u za .in() upite) kako bi se izbegla ograničenja URL dužine.

9. **Legacy format** - API podržava i stari format \`{ data: [...] }\` za uvoz samo artikala (bez klasifikacija) radi kompatibilnosti.`;

    const blob = new Blob([docsContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "articles-api-dokumentacija.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Dokumentacija preuzeta");
  };

  const validateJson = (text: string): boolean => {
    if (!text.trim()) {
      setJsonValid(null);
      return false;
    }

    try {
      const parsed = JSON.parse(text);
      
      // Support both new format { classifications, articles } and legacy array format
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        // New format
        const hasClassifications = !parsed.classifications || (Array.isArray(parsed.classifications) && 
          parsed.classifications.every((c: any) => c.code && c.name));
        const hasArticles = Array.isArray(parsed.articles) && 
          parsed.articles.every((a: any) => a.code && a.name);
        
        setJsonValid(hasClassifications && hasArticles);
        return hasClassifications && hasArticles;
      } else if (Array.isArray(parsed)) {
        // Legacy format - array of articles
        const valid = parsed.every((item) => item.code && item.name);
        setJsonValid(valid);
        return valid;
      }
      
      setJsonValid(false);
      return false;
    } catch {
      setJsonValid(false);
      return false;
    }
  };

  const handleImport = async () => {
    if (!selectedCompany) {
      toast.error("Izaberite firmu");
      return;
    }

    if (!validateJson(importJson)) {
      toast.error("Neispravan JSON format ili nedostaju obavezna polja");
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Niste prijavljeni");
      }

      const parsedData = JSON.parse(importJson);
      
      // Build request body - support both formats
      let requestBody: any;
      if (Array.isArray(parsedData)) {
        // Legacy format
        requestBody = {
          articles: parsedData,
          update_existing: updateExisting,
        };
      } else {
        // New format
        requestBody = {
          classifications: parsedData.classifications || [],
          articles: parsedData.articles || [],
          update_existing: updateExisting,
        };
      }

      const response = await fetch(
        `https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api?company_id=${selectedCompany.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Greška pri uvozu");
      }

      setImportResult(result);
      
      const classStats = result.classifications;
      const artStats = result.articles;
      toast.success(
        `Klasifikacije: ${classStats.imported}/${classStats.updated}/${classStats.skipped}, ` +
        `Artikli: ${artStats.imported}/${artStats.updated}/${artStats.skipped}`
      );
    } catch (error: any) {
      console.error("Import error:", error);
      setImportError(error.message);
      toast.error(error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleLoadFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJson(content);
      validateJson(content);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const resetState = () => {
    setExportResult(null);
    setExportError(null);
    setImportJson("");
    setImportResult(null);
    setImportError(null);
    setJsonValid(null);
    setUpdateExisting(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetState();
        onOpenChange(value);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Artikli API - Izvoz/Uvoz (sa klasifikacijama)
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Izvoz
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Uvoz
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Izvoz klasifikacija i artikala za firmu{" "}
                <strong>{selectedCompany?.name}</strong>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadDocs}>
                  <FileText className="h-4 w-4 mr-2" />
                  Dokumentacija
                </Button>
                <Button onClick={handleExport} disabled={isExporting}>
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Izvoz...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Izvezi sve
                    </>
                  )}
                </Button>
              </div>
            </div>

            {exportError && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {exportError}
              </div>
            )}

            {exportResult && (
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 text-primary rounded-md flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    Uspešno izvezeno{" "}
                    <strong>{exportResult.classifications_count}</strong> klasifikacija i{" "}
                    <strong>{exportResult.articles_count}</strong> artikala
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCopyToClipboard}>
                    <Copy className="h-4 w-4 mr-2" />
                    Kopiraj u clipboard
                  </Button>
                  <Button variant="outline" onClick={handleDownloadJson}>
                    <FileJson className="h-4 w-4 mr-2" />
                    Preuzmi JSON
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-2">
                      <FolderTree className="h-4 w-4" />
                      Klasifikacije (prvih 5)
                    </Label>
                    <ScrollArea className="h-48 mt-2 rounded-md border">
                      <pre className="p-4 text-xs">
                        {JSON.stringify(exportResult.data.classifications.slice(0, 5), null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                  <div>
                    <Label>Artikli (prvih 5)</Label>
                    <ScrollArea className="h-48 mt-2 rounded-md border">
                      <pre className="p-4 text-xs">
                        {JSON.stringify(exportResult.data.articles.slice(0, 5), null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Uvoz klasifikacija i artikala za firmu <strong>{selectedCompany?.name}</strong>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="import-json">JSON podaci za uvoz</Label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleLoadFromFile}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <FileJson className="h-4 w-4 mr-2" />
                      Učitaj iz fajla
                    </span>
                  </Button>
                </label>
              </div>
              <Textarea
                id="import-json"
                placeholder='{"classifications": [{"code": "01", "name": "Grupa 1"}], "articles": [{"code": "001", "name": "Artikal 1"}]}'
                value={importJson}
                onChange={(e) => {
                  setImportJson(e.target.value);
                  validateJson(e.target.value);
                }}
                className="font-mono text-xs h-48"
              />
              {jsonValid !== null && (
                <div
                  className={`text-xs flex items-center gap-1 ${
                    jsonValid ? "text-primary" : "text-destructive"
                  }`}
                >
                  {jsonValid ? (
                    <>
                      <CheckCircle className="h-3 w-3" /> Validan JSON format
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3" /> Neispravan JSON ili
                      nedostaju obavezna polja (code, name)
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="update-existing"
                checked={updateExisting}
                onCheckedChange={(checked) =>
                  setUpdateExisting(checked as boolean)
                }
              />
              <Label htmlFor="update-existing" className="text-sm">
                Ažuriraj postojeće (po šifri)
              </Label>
            </div>

            <Button
              onClick={handleImport}
              disabled={isImporting || !jsonValid}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uvoz u toku...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Uvezi klasifikacije i artikle
                </>
              )}
            </Button>

            {importError && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {importError}
              </div>
            )}

            {importResult && (
              <div className="space-y-3">
                <div className="p-4 bg-primary/10 text-primary rounded-md">
                  <div className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Uvoz završen
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-1">
                        <FolderTree className="h-3 w-3" />
                        Klasifikacije
                      </div>
                      <div>Uvezeno: {importResult.classifications.imported}</div>
                      <div>Ažurirano: {importResult.classifications.updated}</div>
                      <div>Preskočeno: {importResult.classifications.skipped}</div>
                      {importResult.classifications.errors.length > 0 && (
                        <div className="text-destructive">
                          Greške: {importResult.classifications.errors.length}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium">Artikli</div>
                      <div>Uvezeno: {importResult.articles.imported}</div>
                      <div>Ažurirano: {importResult.articles.updated}</div>
                      <div>Preskočeno: {importResult.articles.skipped}</div>
                      {importResult.articles.errors.length > 0 && (
                        <div className="text-destructive">
                          Greške: {importResult.articles.errors.length}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {(importResult.classifications.errors.length > 0 || importResult.articles.errors.length > 0) && (
                  <div className="p-4 bg-destructive/10 rounded-md">
                    <div className="font-medium text-destructive mb-2">
                      Greške pri uvozu:
                    </div>
                    <ScrollArea className="h-32">
                      <ul className="text-sm space-y-1">
                        {importResult.classifications.errors.map((err, idx) => (
                          <li key={`class-${idx}`} className="text-destructive">
                            <strong>[Klasifikacija] {err.code}:</strong> {err.error}
                          </li>
                        ))}
                        {importResult.articles.errors.map((err, idx) => (
                          <li key={`art-${idx}`} className="text-destructive">
                            <strong>[Artikal] {err.code}:</strong> {err.error}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
