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
} from "lucide-react";

interface ArticleApiDialogProps {
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
      toast.success(`Izvezeno ${result.count} artikala`);
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
    a.download = `artikli_${selectedCompany?.name.replace(/\s+/g, "_")}_${selectedYear?.year}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Fajl preuzet");
  };

  const handleDownloadDocs = () => {
    // Create documentation content
    const docsContent = `# Articles API Dokumentacija

API za izvoz i uvoz artikala sa atributima.

## Base URL
https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api

## Autentifikacija
Authorization: Bearer <your_jwt_token>

## Endpoints

### Izvoz (GET)
GET /articles-api?company_id=<uuid>&business_year_id=<uuid>

### Uvoz (POST)
POST /articles-api?company_id=<uuid>&business_year_id=<uuid>
Body: { "data": [...], "update_existing": false }

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
      if (!Array.isArray(parsed)) {
        setJsonValid(false);
        return false;
      }
      
      // Check if all items have required fields
      const valid = parsed.every(
        (item) => item.code && item.name
      );
      setJsonValid(valid);
      return valid;
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
      toast.error("Neispravan JSON format ili nedostaju obavezna polja (code, name)");
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

      const response = await fetch(
        `https://qzehbazhizwwiuomlfer.supabase.co/functions/v1/articles-api?company_id=${selectedCompany.id}&business_year_id=${selectedYear.id}`,
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
      toast.success(
        `Uvezeno: ${result.imported}, Ažurirano: ${result.updated}, Preskočeno: ${result.skipped}`
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
            Artikli API - Izvoz/Uvoz
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
                Izvoz svih artikala za firmu{" "}
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
                      Izvezi artikle
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
                  Uspešno izvezeno {exportResult.count} artikala
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

                <div>
                  <Label>Pregled podataka (prvih 5 artikala)</Label>
                  <ScrollArea className="h-64 mt-2 rounded-md border">
                    <pre className="p-4 text-xs">
                      {JSON.stringify(exportResult.data.slice(0, 5), null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Uvoz artikala za firmu <strong>{selectedCompany?.name}</strong>,
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
                placeholder='[{"code": "001", "name": "Artikal 1", "unit": "kom", ...}]'
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
                    jsonValid ? "text-green-600" : "text-destructive"
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
                Ažuriraj postojeće artikle (po šifri)
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
                  Uvezi artikle
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
              <div className="space-y-2">
                <div className="p-4 bg-primary/10 text-primary rounded-md">
                  <div className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Uvoz završen
                  </div>
                  <div className="text-sm mt-2 space-y-1">
                    <div>Uvezeno novih: {importResult.imported}</div>
                    <div>Ažurirano: {importResult.updated}</div>
                    <div>Preskočeno: {importResult.skipped}</div>
                    {importResult.errors.length > 0 && (
                      <div className="text-destructive">
                        Greške: {importResult.errors.length}
                      </div>
                    )}
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="p-4 bg-destructive/10 rounded-md">
                    <div className="font-medium text-destructive mb-2">
                      Greške pri uvozu:
                    </div>
                    <ScrollArea className="h-32">
                      <ul className="text-sm space-y-1">
                        {importResult.errors.map((err, idx) => (
                          <li key={idx} className="text-destructive">
                            <strong>{err.code}:</strong> {err.error}
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
