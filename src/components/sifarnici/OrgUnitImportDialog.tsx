import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, FileJson, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";

interface OrgUnitImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportRow {
  code: string;
  name: string;
  parent_code?: string | null;
  is_active?: boolean;
}

export function OrgUnitImportDialog({ open, onOpenChange }: OrgUnitImportDialogProps) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const [updateExisting, setUpdateExisting] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith(".json")) {
        const text = await file.text();
        const data = JSON.parse(text);
        
        const rawData = Array.isArray(data) ? data : (data.organizational_units || data.data || []);
        
        if (!Array.isArray(rawData)) {
          toast.error("JSON fajl mora sadržati niz objekata");
          return;
        }
        
        const rows: ImportRow[] = rawData.map((item: any) => ({
          code: String(item.code || item.šifra || item.sifra || "").trim(),
          name: String(item.name || item.naziv || item.ime || "").trim(),
          parent_code: item.parent_code || item.nadšifra || item.nadsifra || item.parent || null,
          is_active: item.is_active !== undefined ? Boolean(item.is_active) : 
                     item.aktivno !== undefined ? (item.aktivno === 1 || item.aktivno === true || String(item.aktivno).toUpperCase() === "DA") : true,
        })).filter((r: ImportRow) => r.code && r.name);
        
        setImportPreview(rows);
        
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        
        const rows: ImportRow[] = (jsonData as any[]).map((item) => {
          const code = item.code || item.Code || item.CODE || 
                       item.šifra || item.Šifra || item.ŠIFRA ||
                       item.sifra || item.Sifra || item.SIFRA || "";
          
          const name = item.name || item.Name || item.NAME ||
                       item.naziv || item.Naziv || item.NAZIV ||
                       item.ime || item.Ime || item.IME || "";
          
          const parent_code = item.parent_code || item.Parent_code || item.PARENT_CODE ||
                              item.nadšifra || item.Nadšifra || item.NADŠIFRA ||
                              item.nadsifra || item.Nadsifra || item.NADSIFRA ||
                              item.parent || item.Parent || item.PARENT || null;
          
          const isActiveRaw = item.is_active ?? item.Is_active ?? item.IS_ACTIVE ??
                              item.aktivno ?? item.Aktivno ?? item.AKTIVNO ?? true;
          
          let is_active = true;
          if (typeof isActiveRaw === "boolean") {
            is_active = isActiveRaw;
          } else if (typeof isActiveRaw === "number") {
            is_active = isActiveRaw === 1;
          } else if (typeof isActiveRaw === "string") {
            is_active = isActiveRaw.toUpperCase() === "DA" || isActiveRaw === "1";
          }
          
          return {
            code: String(code).trim(),
            name: String(name).trim(),
            parent_code: parent_code ? String(parent_code).trim() : null,
            is_active,
          };
        }).filter((r) => r.code && r.name);
        
        setImportPreview(rows);
        
      } else {
        toast.error("Nepodržan format fajla. Koristite .xlsx, .xls ili .json");
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Greška pri čitanju fajla: " + error.message);
    }
  };

  const handleImport = async () => {
    if (!selectedCompany || importPreview.length === 0) return;

    setLoading(true);
    try {
      // Sort by parent_code to insert parents first
      const sortedRows = [...importPreview].sort((a, b) => {
        if (!a.parent_code && b.parent_code) return -1;
        if (a.parent_code && !b.parent_code) return 1;
        return (a.parent_code || "").length - (b.parent_code || "").length;
      });

      const batchSize = 100;
      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      // Fetch existing units
      const { data: existingUnits } = await supabase
        .from("organizational_units")
        .select("id, code")
        .eq("company_id", selectedCompany.id);

      const existingMap = (existingUnits || []).reduce((acc, u) => {
        acc[u.code] = u.id;
        return acc;
      }, {} as Record<string, string>);

      for (let i = 0; i < sortedRows.length; i += batchSize) {
        const batch = sortedRows.slice(i, i + batchSize);

        for (const row of batch) {
          try {
            const existingId = existingMap[row.code];
            
            const unitData = {
              company_id: selectedCompany.id,
              code: row.code,
              name: row.name,
              parent_code: row.parent_code || null,
              is_active: row.is_active ?? true,
            };

            if (existingId) {
              if (updateExisting) {
                const { error } = await supabase
                  .from("organizational_units")
                  .update({
                    name: row.name,
                    parent_code: row.parent_code || null,
                    is_active: row.is_active ?? true,
                  })
                  .eq("id", existingId);
                
                if (error) throw error;
                updated++;
              } else {
                skipped++;
              }
            } else {
              const { error } = await supabase
                .from("organizational_units")
                .insert(unitData);
              
              if (error) throw error;
              inserted++;
              existingMap[row.code] = row.code;
            }
          } catch (error: any) {
            console.warn(`Error processing ${row.code}:`, error.message);
            skipped++;
          }
        }
      }

      toast.success(
        `Uvezeno: ${inserted}, Ažurirano: ${updated}, Preskočeno: ${skipped}`
      );
      queryClient.invalidateQueries({ queryKey: ["organizational_units", selectedCompany.id] });
      handleClose();
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Greška pri uvozu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setImportPreview([]);
    setUpdateExisting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Uvoz organizacionih jedinica iz Excel-a
          </DialogTitle>
          <DialogDescription>
            Podržani formati: Excel (.xlsx, .xls) i JSON
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {importPreview.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <div className="flex justify-center gap-4 mb-4">
                <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
                <FileJson className="w-10 h-10 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Fajl mora sadržati kolone: Šifra, Naziv, Nadšifra (opciono), Aktivno (opciono)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                Izaberi fajl
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  Pronađeno {importPreview.length} jedinica
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportPreview([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Poništi
                </Button>
              </div>
              <div className="border rounded-lg max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Šifra</th>
                      <th className="text-left p-2">Naziv</th>
                      <th className="text-left p-2">Nadšifra</th>
                      <th className="text-left p-2">Aktivno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono">{row.code}</td>
                        <td className="p-2">{row.name}</td>
                        <td className="p-2 text-muted-foreground">
                          {row.parent_code || "-"}
                        </td>
                        <td className="p-2">
                          {row.is_active ? "Da" : "Ne"}
                        </td>
                      </tr>
                    ))}
                    {importPreview.length > 10 && (
                      <tr className="border-t">
                        <td colSpan={4} className="p-2 text-center text-muted-foreground">
                          ... i još {importPreview.length - 10} jedinica
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Zatvori
          </Button>
          {importPreview.length > 0 && (
            <Button onClick={handleImport} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Uvezi {importPreview.length} jedinica
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
