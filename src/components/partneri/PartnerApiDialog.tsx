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
import { Download, Upload, Copy, Check, Loader2, FileJson } from "lucide-react";

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
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5" />
            API Izvoz / Uvoz partnera
          </DialogTitle>
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
