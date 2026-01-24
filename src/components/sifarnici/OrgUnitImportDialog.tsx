import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, FileJson, Loader2, Save, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface MappingTemplate {
  name: string;
  mapping: Record<string, string>;
}

// Remove diacritics for matching
const removeDiacritics = (str: string): string => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const normalizeHeaderKey = (input: string): string => {
  return removeDiacritics(input.toLowerCase().trim().replace(/[\s_-]+/g, ""));
};

// Mappable fields for organizational units
const MAPPABLE_FIELDS: { key: keyof ImportRow; label: string; required: boolean }[] = [
  { key: "code", label: "Šifra", required: true },
  { key: "name", label: "Naziv", required: true },
  { key: "parent_code", label: "Nadšifra", required: false },
  { key: "is_active", label: "Aktivno", required: false },
];

// Column name synonyms for auto-detection
const COLUMN_MAPPINGS: Record<string, keyof ImportRow> = {
  "code": "code",
  "šifra": "code",
  "sifra": "code",
  "Code": "code",
  "CODE": "code",
  "Šifra": "code",
  "Sifra": "code",
  "ŠIFRA": "code",
  "SIFRA": "code",
  
  "name": "name",
  "naziv": "name",
  "ime": "name",
  "Name": "name",
  "NAME": "name",
  "Naziv": "name",
  "NAZIV": "name",
  "Ime": "name",
  "IME": "name",
  
  "parent_code": "parent_code",
  "nadšifra": "parent_code",
  "nadsifra": "parent_code",
  "parent": "parent_code",
  "Parent_code": "parent_code",
  "PARENT_CODE": "parent_code",
  "Nadšifra": "parent_code",
  "NADŠIFRA": "parent_code",
  "Nadsifra": "parent_code",
  "NADSIFRA": "parent_code",
  "Parent": "parent_code",
  "PARENT": "parent_code",
  "nadredjeni": "parent_code",
  "Nadredjeni": "parent_code",
  "nadređeni": "parent_code",
  "Nadređeni": "parent_code",
  
  "is_active": "is_active",
  "aktivno": "is_active",
  "aktivan": "is_active",
  "active": "is_active",
  "Is_active": "is_active",
  "IS_ACTIVE": "is_active",
  "Aktivno": "is_active",
  "AKTIVNO": "is_active",
  "Aktivan": "is_active",
  "AKTIVAN": "is_active",
  "Active": "is_active",
  "ACTIVE": "is_active",
};

// Normalized mappings for fallback matching
const NORMALIZED_COLUMN_MAPPINGS: Record<string, keyof ImportRow> = {};
Object.entries(COLUMN_MAPPINGS).forEach(([key, value]) => {
  NORMALIZED_COLUMN_MAPPINGS[normalizeHeaderKey(key)] = value;
});

// Template storage
const TEMPLATE_STORAGE_KEY = "org_unit_import_templates";

const loadTemplates = (): MappingTemplate[] => {
  try {
    const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveTemplates = (templates: MappingTemplate[]) => {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
};

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";

export function OrgUnitImportDialog({ open, onOpenChange }: OrgUnitImportDialogProps) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<ImportStep>("upload");
  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [fieldToExcelCol, setFieldToExcelCol] = useState<Record<string, string | null>>({});
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [templates, setTemplates] = useState<MappingTemplate[]>(loadTemplates);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [importResult, setImportResult] = useState<{
    inserted: number;
    updated: number;
    skipped: number;
    errors: { row: number; code: string; error: string }[];
  } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith(".json")) {
        // JSON files don't need column mapping
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
        
        setParsedData(rows);
        setStep("preview");
        
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        if (jsonData.length === 0) {
          toast.error("Excel fajl je prazan ili nema podataka");
          return;
        }

        // Extract headers
        const headers = Object.keys(jsonData[0] as object);
        setExcelHeaders(headers);
        setRawRows(jsonData);

        // Auto-detect column mapping
        const detectedMapping: Record<string, string | null> = {};
        
        MAPPABLE_FIELDS.forEach((field) => {
          detectedMapping[field.key] = null;
          
          for (const header of headers) {
            // Exact match
            if (COLUMN_MAPPINGS[header] === field.key) {
              detectedMapping[field.key] = header;
              break;
            }
            // Normalized match
            const normalizedHeader = normalizeHeaderKey(header);
            if (NORMALIZED_COLUMN_MAPPINGS[normalizedHeader] === field.key) {
              detectedMapping[field.key] = header;
              break;
            }
          }
        });

        setFieldToExcelCol(detectedMapping);
        setStep("mapping");
        
      } else {
        toast.error("Nepodržan format fajla. Koristite .xlsx, .xls ili .json");
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Greška pri čitanju fajla: " + error.message);
    }
  };

  const updateFieldMapping = (field: string, excelCol: string | null) => {
    setFieldToExcelCol((prev) => ({
      ...prev,
      [field]: excelCol,
    }));
  };

  const applyMappingAndContinue = () => {
    // Validate required fields
    const missingRequired = MAPPABLE_FIELDS.filter(
      (f) => f.required && !fieldToExcelCol[f.key]
    );

    if (missingRequired.length > 0) {
      toast.error(
        `Obavezna polja nisu mapirana: ${missingRequired.map((f) => f.label).join(", ")}`
      );
      return;
    }

    // Parse rows using mapping
    const parsed: ImportRow[] = rawRows.map((row) => {
      const codeCol = fieldToExcelCol["code"];
      const nameCol = fieldToExcelCol["name"];
      const parentCol = fieldToExcelCol["parent_code"];
      const activeCol = fieldToExcelCol["is_active"];

      const code = codeCol ? String(row[codeCol] || "").trim() : "";
      const name = nameCol ? String(row[nameCol] || "").trim() : "";
      const parent_code = parentCol ? (row[parentCol] ? String(row[parentCol]).trim() : null) : null;
      
      let is_active = true;
      if (activeCol && row[activeCol] !== undefined) {
        const val = row[activeCol];
        if (typeof val === "boolean") {
          is_active = val;
        } else if (typeof val === "number") {
          is_active = val === 1;
        } else if (typeof val === "string") {
          is_active = val.toUpperCase() === "DA" || val === "1" || val.toUpperCase() === "TRUE";
        }
      }

      return { code, name, parent_code, is_active };
    }).filter((r) => r.code && r.name);

    if (parsed.length === 0) {
      toast.error("Nema validnih redova za uvoz. Proverite mapiranje kolona.");
      return;
    }

    setParsedData(parsed);
    setStep("preview");
  };

  const saveTemplate = () => {
    if (!newTemplateName.trim()) {
      toast.error("Unesite naziv šablona");
      return;
    }

    const template: MappingTemplate = {
      name: newTemplateName.trim(),
      mapping: { ...fieldToExcelCol } as Record<string, string>,
    };

    const updatedTemplates = templates.filter((t) => t.name !== template.name);
    updatedTemplates.push(template);
    setTemplates(updatedTemplates);
    saveTemplates(updatedTemplates);
    setNewTemplateName("");
    toast.success("Šablon sačuvan");
  };

  const loadTemplate = (template: MappingTemplate) => {
    // Only apply mappings for headers that exist in current file
    const applicableMapping: Record<string, string | null> = {};
    
    MAPPABLE_FIELDS.forEach((field) => {
      const savedCol = template.mapping[field.key];
      if (savedCol && excelHeaders.includes(savedCol)) {
        applicableMapping[field.key] = savedCol;
      } else {
        applicableMapping[field.key] = null;
      }
    });

    setFieldToExcelCol(applicableMapping);
    toast.success(`Šablon "${template.name}" učitan`);
  };

  const deleteTemplate = (templateName: string) => {
    const updatedTemplates = templates.filter((t) => t.name !== templateName);
    setTemplates(updatedTemplates);
    saveTemplates(updatedTemplates);
    toast.success("Šablon obrisan");
  };

  const handleImport = async () => {
    if (!selectedCompany || parsedData.length === 0) return;

    setStep("importing");
    setLoading(true);
    
    try {
      // Sort by parent_code to insert parents first
      const sortedRows = [...parsedData].sort((a, b) => {
        if (!a.parent_code && b.parent_code) return -1;
        if (a.parent_code && !b.parent_code) return 1;
        return (a.parent_code || "").length - (b.parent_code || "").length;
      });

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      const errors: { row: number; code: string; error: string }[] = [];

      // Fetch existing units
      const { data: existingUnits } = await supabase
        .from("organizational_units")
        .select("id, code")
        .eq("company_id", selectedCompany.id);

      const existingMap = (existingUnits || []).reduce((acc, u) => {
        acc[u.code] = u.id;
        return acc;
      }, {} as Record<string, string>);

      for (let i = 0; i < sortedRows.length; i++) {
        const row = sortedRows[i];
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
          errors.push({ row: i + 1, code: row.code, error: error.message });
          skipped++;
        }
      }

      setImportResult({ inserted, updated, skipped, errors });
      queryClient.invalidateQueries({ queryKey: ["organizational_units", selectedCompany.id] });
      setStep("complete");
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Greška pri uvozu: " + error.message);
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setRawRows([]);
    setExcelHeaders([]);
    setFieldToExcelCol({});
    setParsedData([]);
    setUpdateExisting(false);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  };

  const getHeaderWithIndex = (header: string): string => {
    const index = excelHeaders.indexOf(header);
    return index >= 0 ? `${index + 1}. ${header}` : header;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Uvoz organizacionih jedinica iz Excel-a
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Podržani formati: Excel (.xlsx, .xls) i JSON"}
            {step === "mapping" && "Mapirajte kolone iz Excel fajla na polja u sistemu"}
            {step === "preview" && "Pregledajte podatke pre uvoza"}
            {step === "importing" && "Uvoz u toku..."}
            {step === "complete" && "Uvoz završen"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Step */}
          {step === "upload" && (
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
          )}

          {/* Mapping Step */}
          {step === "mapping" && (
            <>
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Detektovana zaglavlja iz Excel fajla:</h4>
                <div className="flex flex-wrap gap-1">
                  {excelHeaders.map((header, idx) => (
                    <span
                      key={header}
                      className="text-xs bg-muted px-2 py-1 rounded"
                    >
                      {idx + 1}. {header}
                    </span>
                  ))}
                </div>
              </div>

              {templates.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Sačuvani šabloni mapiranja:</h4>
                  <div className="flex flex-wrap gap-2">
                    {templates.map((template) => (
                      <div key={template.name} className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadTemplate(template)}
                        >
                          {template.name}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTemplate(template.name)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 w-1/3">Polje u sistemu</th>
                      <th className="text-left p-2">Kolona iz Excel-a</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MAPPABLE_FIELDS.map((field) => (
                      <tr key={field.key} className="border-t">
                        <td className="p-2">
                          <span className={field.required ? "font-medium" : ""}>
                            {field.label}
                            {field.required && <span className="text-destructive ml-1">*</span>}
                          </span>
                        </td>
                        <td className="p-2">
                          <Select
                            value={fieldToExcelCol[field.key] || "__none__"}
                            onValueChange={(val) =>
                              updateFieldMapping(field.key, val === "__none__" ? null : val)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Izaberi kolonu" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">-- Ne mapiraj --</SelectItem>
                              {excelHeaders.map((header) => (
                                <SelectItem key={header} value={header}>
                                  {getHeaderWithIndex(header)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  placeholder="Naziv novog šablona"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={saveTemplate}>
                  <Save className="w-4 h-4 mr-1" />
                  Sačuvaj šablon
                </Button>
              </div>
            </>
          )}

          {/* Preview Step */}
          {step === "preview" && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  Pronađeno {parsedData.length} jedinica
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (rawRows.length > 0) {
                      setStep("mapping");
                    } else {
                      setStep("upload");
                      setParsedData([]);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }
                  }}
                >
                  Nazad
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
                    {parsedData.slice(0, 10).map((row, i) => (
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
                    {parsedData.length > 10 && (
                      <tr className="border-t">
                        <td colSpan={4} className="p-2 text-center text-muted-foreground">
                          ... i još {parsedData.length - 10} jedinica
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

          {/* Importing Step */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Uvoz u toku...</p>
            </div>
          )}

          {/* Complete Step */}
          {step === "complete" && importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{importResult.inserted}</div>
                  <div className="text-sm text-muted-foreground">Dodato</div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{importResult.updated}</div>
                  <div className="text-sm text-muted-foreground">Ažurirano</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">{importResult.skipped}</div>
                  <div className="text-sm text-muted-foreground">Preskočeno</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-destructive">
                    Greške ({importResult.errors.length}):
                  </h4>
                  <div className="max-h-32 overflow-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2">Red</th>
                          <th className="text-left p-2">Šifra</th>
                          <th className="text-left p-2">Greška</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.errors.map((err, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{err.row}</td>
                            <td className="p-2 font-mono">{err.code}</td>
                            <td className="p-2 text-destructive">{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {step === "complete" ? "Zatvori" : "Otkaži"}
          </Button>
          {step === "mapping" && (
            <Button onClick={applyMappingAndContinue}>
              Nastavi
            </Button>
          )}
          {step === "preview" && (
            <Button onClick={handleImport} disabled={loading}>
              Uvezi {parsedData.length} jedinica
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
