import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, Save, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

// Normalization helpers for Excel headers
const removeDiacritics = (str: string): string => {
  return str
    .replace(/[čć]/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/đ/g, "d");
};

const normalizeHeaderKey = (input: string): string => {
  const cleanedWhitespace = input
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .trim()
    .toLowerCase();
  const stripped = cleanedWhitespace.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return removeDiacritics(stripped).replace(/\s+/g, " ").trim();
};

interface ArticleImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedArticle {
  code: string;
  name: string;
  unit: string;
  article_group?: string;
  svk?: string;
  purchase_price?: number;
  selling_price?: number;
  stock?: number;
  min_stock?: number;
  kg_po_jm?: number;
  kol_mas?: number;
  is_active: boolean;
}

interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: { row: number; code: string; error: string }[];
}

interface MappingTemplate {
  name: string;
  mapping: Record<string, string>;
}

// SVK mapping
const SVK_LABELS: Record<string, string> = {
  "0": "Usluge",
  "1": "Roba",
  "2": "Repromaterijal",
  "6": "Rezervni delovi",
  "8": "Potrošni materijal",
  "9": "Gotovi proizvodi",
};

const SVK_REVERSE: Record<string, string> = {};
Object.entries(SVK_LABELS).forEach(([key, value]) => {
  SVK_REVERSE[value.toLowerCase()] = key;
  SVK_REVERSE[`${key} - ${value}`.toLowerCase()] = key;
  SVK_REVERSE[`${key}-${value}`.toLowerCase()] = key;
});

// All mappable fields with labels
const MAPPABLE_FIELDS: { key: keyof ParsedArticle; label: string; required?: boolean }[] = [
  { key: "code", label: "Šifra", required: true },
  { key: "name", label: "Naziv", required: true },
  { key: "unit", label: "Jedinica mere", required: true },
  { key: "article_group", label: "Klasifikacija" },
  { key: "svk", label: "SVK" },
  { key: "purchase_price", label: "Nabavna cena" },
  { key: "selling_price", label: "Prodajna cena" },
  { key: "stock", label: "Zaliha" },
  { key: "min_stock", label: "Min. zaliha" },
  { key: "kg_po_jm", label: "Kg po JM" },
  { key: "kol_mas", label: "Količina u masi" },
  { key: "is_active", label: "Aktivan" },
];

const COLUMN_MAPPINGS: Record<string, keyof ParsedArticle> = {
  // Šifra
  "šifra": "code",
  "sifra": "code",
  "code": "code",
  "šifra artikla": "code",
  "sifra artikla": "code",
  // Naziv
  "naziv": "name",
  "name": "name",
  "naziv artikla": "name",
  "opis": "name",
  // Jedinica mere
  "jedinica mere": "unit",
  "jedinica": "unit",
  "jm": "unit",
  "unit": "unit",
  "mera": "unit",
  // Klasifikacija / Grupa
  "klasifikacija": "article_group",
  "grupa": "article_group",
  "grupa artikla": "article_group",
  "article_group": "article_group",
  "group": "article_group",
  "kategorija": "article_group",
  // SVK
  "svk": "svk",
  "vrsta": "svk",
  "tip": "svk",
  "vrsta artikla": "svk",
  // Nabavna cena
  "nabavna cena": "purchase_price",
  "nabavna": "purchase_price",
  "nc": "purchase_price",
  "purchase_price": "purchase_price",
  "cena nabavke": "purchase_price",
  // Prodajna cena
  "prodajna cena": "selling_price",
  "prodajna": "selling_price",
  "pc": "selling_price",
  "selling_price": "selling_price",
  "cena": "selling_price",
  "maloprodajna cena": "selling_price",
  "vpc": "selling_price",
  "mpc": "selling_price",
  // Zaliha
  "zaliha": "stock",
  "stanje": "stock",
  "stock": "stock",
  "količina": "stock",
  "kolicina": "stock",
  // Min. zaliha
  "min zaliha": "min_stock",
  "min. zaliha": "min_stock",
  "minimalna zaliha": "min_stock",
  "min_stock": "min_stock",
  // Kg po JM
  "kg po jm": "kg_po_jm",
  "kg": "kg_po_jm",
  "masa": "kg_po_jm",
  "težina": "kg_po_jm",
  "tezina": "kg_po_jm",
  "kg_po_jm": "kg_po_jm",
  // Količina u masi
  "količina u masi": "kol_mas",
  "kolicina u masi": "kol_mas",
  "kol_mas": "kol_mas",
  // Aktivan
  "aktivan": "is_active",
  "is_active": "is_active",
  "status": "is_active",
};

// Build normalized lookup
const NORMALIZED_COLUMN_MAPPINGS: Record<string, keyof ParsedArticle> = Object.fromEntries(
  Object.entries(COLUMN_MAPPINGS).map(([k, v]) => [normalizeHeaderKey(k), v])
) as Record<string, keyof ParsedArticle>;

const TEMPLATES_STORAGE_KEY = "article-import-templates";

const loadTemplates = (): MappingTemplate[] => {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveTemplates = (templates: MappingTemplate[]) => {
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
};

export function ArticleImportDialog({ open, onOpenChange }: ArticleImportDialogProps) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedArticle[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing" | "complete">("upload");
  const [updateExisting, setUpdateExisting] = useState(false);
  
  // Template management
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const resetState = useCallback(() => {
    setFile(null);
    setParsedData([]);
    setColumnMapping({});
    setRawRows([]);
    setExcelHeaders([]);
    setImporting(false);
    setProgress(0);
    setResult(null);
    setStep("upload");
    setUpdateExisting(false);
    setNewTemplateName("");
    setShowSaveTemplate(false);
  }, []);

  // Inverted mapping: field -> excelCol
  const fieldToExcelCol = useMemo(() => {
    const inverted: Record<string, string> = {};
    Object.entries(columnMapping).forEach(([excelCol, field]) => {
      inverted[field] = excelCol;
    });
    return inverted;
  }, [columnMapping]);

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const parseNumber = (value: any): number | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    const strValue = String(value).trim().replace(",", ".");
    const num = parseFloat(strValue);
    return isNaN(num) ? undefined : num;
  };

  const parseExcelValue = (value: any, field: keyof ParsedArticle): any => {
    if (value === undefined || value === null || value === "") return undefined;
    
    const strValue = String(value).trim();
    
    switch (field) {
      case "svk":
        // Try to parse as number first
        const numSvk = strValue.charAt(0);
        if (["0", "1", "2", "6", "8", "9"].includes(numSvk)) return numSvk;
        // Try to match label
        const matchedSvk = SVK_REVERSE[strValue.toLowerCase()];
        return matchedSvk || "1";
        
      case "is_active":
        const lowerVal = strValue.toLowerCase();
        return lowerVal === "da" || lowerVal === "yes" || lowerVal === "true" || lowerVal === "1";
      
      case "purchase_price":
      case "selling_price":
      case "stock":
      case "min_stock":
      case "kg_po_jm":
      case "kol_mas":
        return parseNumber(value);
        
      default:
        return strValue || undefined;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (!selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".xls")) {
      toast.error("Molimo izaberite Excel fajl (.xlsx ili .xls)");
      return;
    }
    
    setFile(selectedFile);
    
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // Get all column headers from the sheet range
      const range = XLSX.utils.decode_range(firstSheet["!ref"] || "A1");
      const allHeaders: string[] = [];
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        const cell = firstSheet[cellAddress];
        const headerValue = cell ? String(cell.v).trim() : "";
        if (headerValue) {
          allHeaders.push(headerValue);
        }
      }
      
      // Parse JSON data with defval to include empty cells
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: "" });
      
      if (jsonData.length === 0) {
        toast.error("Excel fajl je prazan");
        return;
      }
      
      // Combine headers
      const rowHeaders = jsonData.reduce<string[]>((acc, row) => {
        Object.keys(row).forEach((k) => {
          if (!acc.includes(k)) acc.push(k);
        });
        return acc;
      }, []);
      
      const headers = [...allHeaders];
      rowHeaders.forEach(h => {
        if (!headers.includes(h)) headers.push(h);
      });

      console.log("Detected Excel headers:", headers);
      setExcelHeaders(headers);
      
      const detectedMapping: Record<string, string> = {};
      
      headers.forEach((header) => {
        const normalized = normalizeHeaderKey(header);
        const noSpace = normalized.replace(/\s/g, "");

        const direct = NORMALIZED_COLUMN_MAPPINGS[normalized];
        const directNoSpace = NORMALIZED_COLUMN_MAPPINGS[noSpace];

        const mapped = direct ?? directNoSpace;
        if (mapped) detectedMapping[header] = mapped;
      });

      setColumnMapping(detectedMapping);
      setRawRows(jsonData);
      setStep("mapping");
      
    } catch (error) {
      console.error("Error parsing Excel:", error);
      toast.error("Greška pri čitanju Excel fajla");
    }
  };

  const updateFieldMapping = (field: string, excelCol: string | null) => {
    setColumnMapping((prev) => {
      const newMapping = { ...prev };
      
      // Remove old mapping for this field
      Object.keys(newMapping).forEach((key) => {
        if (newMapping[key] === field) {
          delete newMapping[key];
        }
      });
      
      // Add new mapping if excelCol is provided
      if (excelCol) {
        newMapping[excelCol] = field;
      }
      
      return newMapping;
    });
  };

  const applyMappingAndContinue = () => {
    // Validate required fields
    const hasCode = Object.values(columnMapping).includes("code");
    const hasName = Object.values(columnMapping).includes("name");
    const hasUnit = Object.values(columnMapping).includes("unit");
    
    if (!hasCode || !hasName) {
      toast.error("Morate mapirati obavezna polja: Šifra i Naziv");
      return;
    }

    // Parse data with current mapping
    const parsed: ParsedArticle[] = rawRows.map((row) => {
      const article: Partial<ParsedArticle> = {
        is_active: true,
        unit: "kom", // Default unit
      };
      
      Object.entries(columnMapping).forEach(([excelCol, articleField]) => {
        const value = parseExcelValue(row[excelCol], articleField as keyof ParsedArticle);
        if (value !== undefined) {
          (article as any)[articleField] = value;
        }
      });
      
      return article as ParsedArticle;
    }).filter((a) => a.code && a.name);
    
    setParsedData(parsed);
    setStep("preview");
  };

  // Template functions
  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) {
      toast.error("Unesite naziv šablona");
      return;
    }
    
    const newTemplate: MappingTemplate = {
      name: newTemplateName.trim(),
      mapping: { ...columnMapping },
    };
    
    const updatedTemplates = [...templates.filter(t => t.name !== newTemplate.name), newTemplate];
    setTemplates(updatedTemplates);
    saveTemplates(updatedTemplates);
    setNewTemplateName("");
    setShowSaveTemplate(false);
    toast.success("Šablon sačuvan");
  };

  const handleLoadTemplate = (template: MappingTemplate) => {
    // Only apply mappings for headers that exist in current file
    const applicableMapping: Record<string, string> = {};
    Object.entries(template.mapping).forEach(([excelCol, field]) => {
      if (excelHeaders.includes(excelCol)) {
        applicableMapping[excelCol] = field;
      }
    });
    setColumnMapping(applicableMapping);
    toast.success(`Šablon "${template.name}" učitan`);
  };

  const handleDeleteTemplate = (templateName: string) => {
    const updatedTemplates = templates.filter(t => t.name !== templateName);
    setTemplates(updatedTemplates);
    saveTemplates(updatedTemplates);
    toast.success("Šablon obrisan");
  };

  const handleImport = async () => {
    if (!selectedCompany) {
      toast.error("Nije izabrana firma");
      return;
    }

    setImporting(true);
    setStep("importing");
    setProgress(0);
    
    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    const batchSize = 50;
    const total = parsedData.length;

    for (let i = 0; i < total; i += batchSize) {
      const batch = parsedData.slice(i, i + batchSize);
      
      for (let j = 0; j < batch.length; j++) {
        const article = batch[j];
        const rowNum = i + j + 2; // +2 for 1-based index and header row
        
        try {
          // Check if article exists
          const { data: existing } = await supabase
            .from("articles")
            .select("id")
            .eq("company_id", selectedCompany.id)
            .eq("code", article.code)
            .maybeSingle();

          if (existing) {
            if (updateExisting) {
              const { error } = await supabase
                .from("articles")
                .update({
                  name: article.name,
                  unit: article.unit || "kom",
                  article_group: article.article_group || null,
                  svk: article.svk as any || null,
                  purchase_price: article.purchase_price || null,
                  selling_price: article.selling_price || null,
                  stock: article.stock || null,
                  min_stock: article.min_stock || null,
                  kg_po_jm: article.kg_po_jm || null,
                  kol_mas: article.kol_mas || null,
                  is_active: article.is_active,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existing.id);

              if (error) throw error;
              result.success++;
            } else {
              result.skipped++;
            }
          } else {
            const { error } = await supabase
              .from("articles")
              .insert({
                company_id: selectedCompany.id,
                code: article.code,
                name: article.name,
                unit: article.unit || "kom",
                article_group: article.article_group || null,
                svk: article.svk as any || null,
                purchase_price: article.purchase_price || null,
                selling_price: article.selling_price || null,
                stock: article.stock || null,
                min_stock: article.min_stock || null,
                kg_po_jm: article.kg_po_jm || null,
                kol_mas: article.kol_mas || null,
                is_active: article.is_active,
              });

            if (error) throw error;
            result.success++;
          }
        } catch (error: any) {
          result.failed++;
          result.errors.push({
            row: rowNum,
            code: article.code,
            error: error.message || "Nepoznata greška",
          });
        }
      }
      
      setProgress(Math.round(((i + batch.length) / total) * 100));
    }

    setResult(result);
    setImporting(false);
    setStep("complete");
    
    // Refresh articles list
    queryClient.invalidateQueries({ queryKey: ["articles", selectedCompany.id] });
    
    if (result.success > 0) {
      toast.success(`Uspešno uvezeno ${result.success} artikala`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Uvoz artikala iz Excel-a
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Izaberite Excel fajl sa podacima o artiklima"}
            {step === "mapping" && "Mapirajte kolone iz Excel fajla na polja artikla"}
            {step === "preview" && "Pregledajte podatke pre uvoza"}
            {step === "importing" && "Uvoz u toku..."}
            {step === "complete" && "Uvoz završen"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="w-full max-w-md">
                <label 
                  htmlFor="excel-upload" 
                  className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <Upload className="w-10 h-10 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Kliknite za izbor Excel fajla
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    (.xlsx ili .xls)
                  </span>
                </label>
                <input
                  id="excel-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === "mapping" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Pronađeno {excelHeaders.length} kolona u Excel fajlu
                </div>
                <div className="flex items-center gap-2">
                  {templates.length > 0 && (
                    <Select onValueChange={(name) => {
                      const template = templates.find(t => t.name === name);
                      if (template) handleLoadTemplate(template);
                    }}>
                      <SelectTrigger className="w-[180px]">
                        <FolderOpen className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Učitaj šablon" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.name} value={t.name}>
                            <div className="flex items-center justify-between w-full">
                              <span>{t.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {showSaveTemplate ? (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Naziv šablona"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="w-40"
                        autoComplete="off"
                      />
                      <Button size="sm" onClick={handleSaveTemplate}>
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowSaveTemplate(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setShowSaveTemplate(true)}>
                      <Save className="w-4 h-4 mr-2" />
                      Sačuvaj šablon
                    </Button>
                  )}
                </div>
              </div>

              {/* Template list for deletion */}
              {templates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <Badge key={t.name} variant="secondary" className="flex items-center gap-1">
                      {t.name}
                      <button
                        onClick={() => handleDeleteTemplate(t.name)}
                        className="ml-1 hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div className="space-y-4">
                  {/* Show all Excel headers */}
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm font-medium mb-2">Kolone iz Excel fajla:</div>
                    <div className="flex flex-wrap gap-2">
                      {excelHeaders.map((h) => (
                        <Badge key={h} variant={columnMapping[h] ? "default" : "outline"}>
                          {h}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {MAPPABLE_FIELDS.map((field) => (
                    <div key={field.key} className="flex items-center gap-4">
                      <div className="w-40 flex items-center gap-2">
                        <span className={field.required ? "font-medium" : ""}>
                          {field.label}
                        </span>
                        {field.required && (
                          <Badge variant="destructive" className="text-xs">*</Badge>
                        )}
                      </div>
                      <Select
                        value={fieldToExcelCol[field.key] || "__none__"}
                        onValueChange={(val) => updateFieldMapping(field.key, val === "__none__" ? null : val)}
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Nije mapirano" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nije mapirano</SelectItem>
                          {excelHeaders.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Odustani
                </Button>
                <Button onClick={applyMappingAndContinue}>
                  Nastavi na pregled
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Spremno za uvoz: {parsedData.length} artikala
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="update-existing"
                    checked={updateExisting}
                    onCheckedChange={(checked) => setUpdateExisting(!!checked)}
                  />
                  <Label htmlFor="update-existing" className="text-sm">
                    Ažuriraj postojeće artikle
                  </Label>
                </div>
              </div>

              <ScrollArea className="h-[350px] border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Šifra</th>
                      <th className="text-left p-2">Naziv</th>
                      <th className="text-left p-2">JM</th>
                      <th className="text-left p-2">Klasifikacija</th>
                      <th className="text-left p-2">SVK</th>
                      <th className="text-right p-2">Nab. cena</th>
                      <th className="text-right p-2">Prod. cena</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 100).map((article, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{article.code}</td>
                        <td className="p-2 max-w-[200px] truncate">{article.name}</td>
                        <td className="p-2">{article.unit}</td>
                        <td className="p-2">{article.article_group || "-"}</td>
                        <td className="p-2">
                          {article.svk ? SVK_LABELS[article.svk] || article.svk : "-"}
                        </td>
                        <td className="p-2 text-right">
                          {article.purchase_price?.toLocaleString("sr-RS") || "-"}
                        </td>
                        <td className="p-2 text-right">
                          {article.selling_price?.toLocaleString("sr-RS") || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 100 && (
                  <div className="text-center text-sm text-muted-foreground py-2">
                    ... i još {parsedData.length - 100} artikala
                  </div>
                )}
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  Nazad na mapiranje
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Odustani
                  </Button>
                  <Button onClick={handleImport}>
                    Započni uvoz
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="w-full max-w-md space-y-4">
                <Progress value={progress} />
                <p className="text-center text-muted-foreground">
                  Uvoz u toku... {progress}%
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === "complete" && result && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4 py-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Uspešno: {result.success}</span>
                </div>
                {result.skipped > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-warning" />
                    <span>Preskočeno: {result.skipped}</span>
                  </div>
                )}
                {result.failed > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    <span>Greške: {result.failed}</span>
                  </div>
                )}
              </div>

              {result.errors.length > 0 && (
                <ScrollArea className="h-[200px] border rounded-lg p-4">
                  <div className="space-y-2">
                    {result.errors.map((err, idx) => (
                      <div key={idx} className="text-sm flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                        <span>
                          Red {err.row} (šifra: {err.code}): {err.error}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <div className="flex justify-end">
                <Button onClick={handleClose}>Zatvori</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
