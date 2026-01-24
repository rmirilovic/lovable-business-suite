import { useState } from "react";
import { FileJson, Download, Upload, Loader2, FileDown, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface OrgUnitApiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrgUnitApiDialog({ open, onOpenChange }: OrgUnitApiDialogProps) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("export");
  const [loading, setLoading] = useState(false);
  const [exportData, setExportData] = useState<string>("");
  const [importData, setImportData] = useState<string>("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleExport = async () => {
    if (!selectedCompany) {
      toast.error("Nije izabrana firma");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Niste prijavljeni");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/org-units-api?company_id=${selectedCompany.id}`,
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

      setExportData(JSON.stringify(result.data, null, 2));
      toast.success(`Izvezeno ${result.count} organizacionih jedinica`);
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Greška pri izvozu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!exportData) return;
    
    const blob = new Blob([exportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `org-units-${selectedCompany?.name || "export"}-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Fajl preuzet");
  };

  const handleCopy = async () => {
    if (!exportData) return;
    await navigator.clipboard.writeText(exportData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Kopirano u clipboard");
  };

  const handleImport = async () => {
    if (!selectedCompany) {
      toast.error("Nije izabrana firma");
      return;
    }

    if (!importData.trim()) {
      toast.error("Unesite JSON podatke za uvoz");
      return;
    }

    setLoading(true);
    setImportResult(null);
    try {
      let parsedData;
      try {
        parsedData = JSON.parse(importData);
      } catch {
        toast.error("Neispravan JSON format");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Niste prijavljeni");
        return;
      }

      // Prepare import payload
      const payload = {
        organizational_units: parsedData.organizational_units || parsedData.data || parsedData,
        update_existing: updateExisting,
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/org-units-api?company_id=${selectedCompany.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Greška pri uvozu");
      }

      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["organizational_units", selectedCompany.id] });
      toast.success(
        `Uvezeno: ${result.imported}, Ažurirano: ${result.updated}, Preskočeno: ${result.skipped}`
      );
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Greška pri uvozu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5" />
            API Organizacione jedinice
          </DialogTitle>
          <DialogDescription>
            Uvoz i izvoz organizacionih jedinica u JSON formatu
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="gap-2">
              <Download className="w-4 h-4" />
              Izvoz
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="w-4 h-4" />
              Uvoz
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Izvezite sve organizacione jedinice za firmu "{selectedCompany?.name}"
              </p>
              <Button onClick={handleExport} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Izvezi
              </Button>
            </div>

            {exportData && (
              <>
                <Textarea
                  value={exportData}
                  readOnly
                  className="font-mono text-xs h-64"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={handleCopy}>
                    {copied ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    {copied ? "Kopirano" : "Kopiraj"}
                  </Button>
                  <Button onClick={handleDownload}>
                    <FileDown className="w-4 h-4 mr-2" />
                    Preuzmi fajl
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>JSON podaci za uvoz</Label>
              <Textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder='{"organizational_units": [{"code": "01", "name": "Prodaja", "parent_code": null, "is_active": true}]}'
                className="font-mono text-xs h-48"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="updateExisting"
                  checked={updateExisting}
                  onCheckedChange={setUpdateExisting}
                />
                <Label htmlFor="updateExisting" className="text-sm">
                  Ažuriraj postojeće jedinice (po šifri)
                </Label>
              </div>
              <Button onClick={handleImport} disabled={loading || !importData.trim()}>
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Uvezi
              </Button>
            </div>

            {importResult && (
              <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
                <h4 className="font-medium">Rezultat uvoza:</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Uvezeno: </span>
                    <span className="font-medium text-green-600">{importResult.imported}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ažurirano: </span>
                    <span className="font-medium text-blue-600">{importResult.updated}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Preskočeno: </span>
                    <span className="font-medium text-yellow-600">{importResult.skipped}</span>
                  </div>
                </div>
                {importResult.errors?.length > 0 && (
                  <div className="mt-2">
                    <span className="text-sm text-destructive">
                      Greške ({importResult.errors.length}):
                    </span>
                    <ul className="text-xs text-destructive mt-1 max-h-20 overflow-auto">
                      {importResult.errors.slice(0, 5).map((err: any, i: number) => (
                        <li key={i}>{err.code}: {err.error}</li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li>... i još {importResult.errors.length - 5} grešaka</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zatvori
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
