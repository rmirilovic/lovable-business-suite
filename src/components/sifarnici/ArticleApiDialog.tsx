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
  const { selectedCompany, selectedYear } = useAuth();
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
    if (!selectedCompany || !selectedYear) {
      toast.error("Izaberite firmu i poslovnu godinu");
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
        `https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api?company_id=${selectedCompany.id}&business_year_id=${selectedYear.id}`,
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
    a.download = `artikli_klasifikacije_${selectedCompany?.name.replace(/\s+/g, "_")}_${selectedYear?.year}_${new Date().toISOString().split("T")[0]}.json`;
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
https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api

## Autentifikacija
Authorization: Bearer <your_jwt_token>

## Endpoints

### Izvoz (GET)
GET /articles-api?company_id=<uuid>&business_year_id=<uuid>

Vraća: { classifications: [...], articles: [...] }

### Uvoz (POST)
POST /articles-api?company_id=<uuid>&business_year_id=<uuid>
Body: { classifications: [...], articles: [...], update_existing: false }

## Struktura klasifikacije
- code (obavezan): Šifra klasifikacije
- name (obavezan): Naziv klasifikacije
- parent_code: Šifra nadređene klasifikacije (null = koren)

## Struktura artikla
- code (obavezan): Šifra artikla
- name (obavezan): Naziv artikla
- article_group: Šifra klasifikacije
- unit: Jedinica mere (default: "kom")
- purchase_price: Nabavna cena
- selling_price: Prodajna cena
- stock: Količina na lageru
- min_stock: Minimalna količina
- is_active: Da li je aktivan
- svk: SVK tip ("0", "1", "2", "6", "8", "9")
- kg_po_jm: Kilograma po jedinici mere
- kol_mas: Količina mase
- attributes: Niz atributa { attribute_code, value }

Za kompletnu dokumentaciju pogledajte docs/articles-api.md u projektu.`;

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
    if (!selectedCompany || !selectedYear) {
      toast.error("Izaberite firmu i poslovnu godinu");
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
        `https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api?company_id=${selectedCompany.id}&business_year_id=${selectedYear.id}`,
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
                <strong>{selectedCompany?.name}</strong>, godina{" "}
                <strong>{selectedYear?.year}</strong>
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
              Uvoz klasifikacija i artikala za firmu <strong>{selectedCompany?.name}</strong>,
              godina <strong>{selectedYear?.year}</strong>
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
