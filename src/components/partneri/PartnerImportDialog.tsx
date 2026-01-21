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
import { LEGAL_STATUS_LABELS, PAYMENT_PRIORITY_LABELS } from "@/hooks/usePartners";

// Normalization helpers for Excel headers (handles diacritics + non-breaking spaces)
const removeDiacritics = (str: string): string => {
  return str
    .replace(/[čć]/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/đ/g, "d");
};

const normalizeHeaderKey = (input: string): string => {
  const cleanedWhitespace = input
    // normalize common unicode spaces to regular spaces
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .trim()
    .toLowerCase();

  // keep letters/numbers/spaces only (strip punctuation like '-' etc)
  const stripped = cleanedWhitespace.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return removeDiacritics(stripped).replace(/\s+/g, " ").trim();
};

interface PartnerImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedPartner {
  code: string;
  name: string;
  legal_status: number;
  address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  pib?: string;
  mb?: string;
  activity_code?: string;
  jbkjs?: string;
  phone?: string;
  email?: string;
  website?: string;
  responsible_person?: string;
  is_customer: boolean;
  is_supplier: boolean;
  is_active: boolean;
  payment_priority: number;
  note?: string;
  other_data?: string;
  assigned_to?: string;
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

// All mappable fields with labels
const MAPPABLE_FIELDS: { key: keyof ParsedPartner; label: string; required?: boolean }[] = [
  { key: "code", label: "Šifra", required: true },
  { key: "name", label: "Naziv", required: true },
  { key: "address", label: "Adresa" },
  { key: "postal_code", label: "Poštanski broj" },
  { key: "city", label: "Mesto" },
  { key: "country", label: "Država" },
  { key: "pib", label: "PIB" },
  { key: "mb", label: "Matični broj" },
  { key: "jbkjs", label: "JBKJS" },
  { key: "activity_code", label: "Šifra delatnosti" },
  { key: "legal_status", label: "Pravni status" },
  { key: "payment_priority", label: "Prioritet plaćanja" },
  { key: "is_customer", label: "Kupac" },
  { key: "is_supplier", label: "Dobavljač" },
  { key: "is_active", label: "Aktivan" },
  { key: "phone", label: "Telefon" },
  { key: "email", label: "Email" },
  { key: "website", label: "Web adresa" },
  { key: "responsible_person", label: "Odgovorno lice" },
  { key: "assigned_to", label: "Zadužen" },
  { key: "note", label: "Napomena" },
  { key: "other_data", label: "Ostali podaci" },
];

// Expected column order: Šifra, Naziv, Adresa, PB, Mesto, PIB, JBKJS, Maticni, Sifra delatnosti, 
// Pravni status, Prioritet placanja, Kupac, Dobavljac, Aktivan, Telefon, Email, Web adresa, 
// Odgovorno lice, Zadužen, Napomena, Ostali podaci
const EXPECTED_COLUMNS = [
  "Šifra", "Naziv", "Adresa", "PB", "Mesto", "PIB", "JBKJS", "Maticni", 
  "Sifra delatnosti", "Pravni status", "Prioritet placanja", "Kupac", "Dobavljac", 
  "Aktivan", "Telefon", "Email", "Web adresa", "Odgovorno lice", "Zadužen", 
  "Napomena", "Ostali podaci"
];

const COLUMN_MAPPINGS: Record<string, keyof ParsedPartner> = {
  // Šifra
  "šifra": "code",
  "sifra": "code",
  "code": "code",
  // Naziv
  "naziv": "name",
  "name": "name",
  // Adresa
  "adresa": "address",
  "address": "address",
  // PB (Poštanski broj)
  "pb": "postal_code",
  "poštanski broj": "postal_code",
  "postanski broj": "postal_code",
  "postal_code": "postal_code",
  // Mesto
  "mesto": "city",
  "grad": "city",
  "city": "city",
  // PIB
  "pib": "pib",
  // JBKJS
  "jbkjs": "jbkjs",
  // Maticni (Matični broj) - sve varijante
  "maticni": "mb",
  "matični broj": "mb",
  "maticni broj": "mb",
  "matičnibroj": "mb",
  "maticnibroj": "mb",
  "mb": "mb",
  // Sifra delatnosti - sve varijante
  "sifra delatnosti": "activity_code",
  "šifra delatnosti": "activity_code",
  "sifradelatnosti": "activity_code",
  "šifradelatnosti": "activity_code",
  "activity_code": "activity_code",
  // Pravni status
  "pravni status": "legal_status",
  "pravnistatus": "legal_status",
  "legal_status": "legal_status",
  // Prioritet placanja - sve varijante
  "prioritet placanja": "payment_priority",
  "prioritet plaćanja": "payment_priority",
  "prioritetplacanja": "payment_priority",
  "payment_priority": "payment_priority",
  // Kupac
  "kupac": "is_customer",
  "is_customer": "is_customer",
  // Dobavljac
  "dobavljac": "is_supplier",
  "dobavljač": "is_supplier",
  "is_supplier": "is_supplier",
  // Aktivan
  "aktivan": "is_active",
  "is_active": "is_active",
  // Telefon
  "telefon": "phone",
  "phone": "phone",
  // Email
  "email": "email",
  "e-mail": "email",
  // Web adresa - sve varijante
  "web adresa": "website",
  "webadresa": "website",
  "web": "website",
  "website": "website",
  "sajt": "website",
  "www": "website",
  "url": "website",
  "web site": "website",
  "internet adresa": "website",
  "internetadresa": "website",
  "prezentacija": "website",
  // Odgovorno lice
  "odgovorno lice": "responsible_person",
  "odgovornorlice": "responsible_person",
  "responsible_person": "responsible_person",
  // Zadužen
  "zadužen": "assigned_to",
  "zaduzen": "assigned_to",
  "assigned_to": "assigned_to",
  // Napomena
  "napomena": "note",
  "note": "note",
  // Ostali podaci
  "ostali podaci": "other_data",
  "ostalipodaci": "other_data",
  "ostalo": "other_data",
  "other_data": "other_data",
  // Država (za kompatibilnost sa starijim fajlovima)
  "država": "country",
  "drzava": "country",
  "country": "country",
};

// Build a normalized lookup so we can match headers robustly
const NORMALIZED_COLUMN_MAPPINGS: Record<string, keyof ParsedPartner> = Object.fromEntries(
  Object.entries(COLUMN_MAPPINGS).map(([k, v]) => [normalizeHeaderKey(k), v])
) as Record<string, keyof ParsedPartner>;

const LEGAL_STATUS_REVERSE: Record<string, number> = {};
Object.entries(LEGAL_STATUS_LABELS).forEach(([key, value]) => {
  LEGAL_STATUS_REVERSE[value.toLowerCase()] = Number(key);
});

const PAYMENT_PRIORITY_REVERSE: Record<string, number> = {};
Object.entries(PAYMENT_PRIORITY_LABELS).forEach(([key, value]) => {
  PAYMENT_PRIORITY_REVERSE[value.toLowerCase()] = Number(key);
});

const TEMPLATES_STORAGE_KEY = "partner-import-templates";

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

export function PartnerImportDialog({ open, onOpenChange }: PartnerImportDialogProps) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedPartner[]>([]);
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

  const parseExcelValue = (value: any, field: keyof ParsedPartner): any => {
    if (value === undefined || value === null || value === "") return undefined;
    
    const strValue = String(value).trim();
    
    switch (field) {
      case "legal_status":
        // Try to parse as number first
        const numStatus = parseInt(strValue, 10);
        if (!isNaN(numStatus) && numStatus >= 1 && numStatus <= 4) return numStatus;
        // Try to match label
        const matchedStatus = LEGAL_STATUS_REVERSE[strValue.toLowerCase()];
        return matchedStatus || 1;
        
      case "payment_priority":
        const numPriority = parseInt(strValue, 10);
        if (!isNaN(numPriority) && numPriority >= 1 && numPriority <= 3) return numPriority;
        const matchedPriority = PAYMENT_PRIORITY_REVERSE[strValue.toLowerCase()];
        return matchedPriority || 3;
        
      case "is_customer":
      case "is_supplier":
      case "is_active":
        const lowerVal = strValue.toLowerCase();
        return lowerVal === "da" || lowerVal === "yes" || lowerVal === "true" || lowerVal === "1";
        
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
      
      // First, get all column headers from the sheet range (includes empty columns)
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
      
      // Use headers from the first row parsing (more reliable)
      // Combine with union of all row keys as fallback
      const rowHeaders = jsonData.reduce<string[]>((acc, row) => {
        Object.keys(row).forEach((k) => {
          if (!acc.includes(k)) acc.push(k);
        });
        return acc;
      }, []);
      
      // Merge: prefer allHeaders order, add any missing from rowHeaders
      const headers = [...allHeaders];
      rowHeaders.forEach(h => {
        if (!headers.includes(h)) headers.push(h);
      });

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

      // Fallback: if header-based detection missed most columns, use the expected column order.
      // This helps with Excel files that contain hidden/unusual characters in header names.
      if (Object.keys(detectedMapping).length <= 4 && headers.length >= 2) {
        headers.forEach((header, idx) => {
          if (detectedMapping[header]) return;
          const expectedHeader = EXPECTED_COLUMNS[idx];
          if (!expectedHeader) return;

          const expectedNormalized = normalizeHeaderKey(expectedHeader);
          const expectedNoSpace = expectedNormalized.replace(/\s/g, "");

          const mapped =
            NORMALIZED_COLUMN_MAPPINGS[expectedNormalized] ??
            NORMALIZED_COLUMN_MAPPINGS[expectedNoSpace];

          if (mapped) detectedMapping[header] = mapped;
        });
      }

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
    
    if (!hasCode || !hasName) {
      toast.error("Morate mapirati obavezna polja: Šifra i Naziv");
      return;
    }

    // Parse data with current mapping
    const parsed: ParsedPartner[] = rawRows.map((row) => {
      const partner: Partial<ParsedPartner> = {
        is_customer: true,
        is_supplier: false,
        is_active: true,
        payment_priority: 3,
        legal_status: 1,
        country: "Srbija",
      };
      
      Object.entries(columnMapping).forEach(([excelCol, partnerField]) => {
        const value = parseExcelValue(row[excelCol], partnerField as keyof ParsedPartner);
        if (value !== undefined) {
          (partner as any)[partnerField] = value;
        }
      });
      
      return partner as ParsedPartner;
    }).filter((p) => p.code && p.name);
    
    setParsedData(parsed);
    setStep("preview");
  };

  const saveTemplate = () => {
    if (!newTemplateName.trim()) {
      toast.error("Unesite naziv šablona");
      return;
    }
    
    const existingIndex = templates.findIndex((t) => t.name === newTemplateName.trim());
    let updatedTemplates: MappingTemplate[];
    
    if (existingIndex >= 0) {
      updatedTemplates = [...templates];
      updatedTemplates[existingIndex] = { name: newTemplateName.trim(), mapping: { ...columnMapping } };
      toast.success("Šablon ažuriran");
    } else {
      updatedTemplates = [...templates, { name: newTemplateName.trim(), mapping: { ...columnMapping } }];
      toast.success("Šablon sačuvan");
    }
    
    setTemplates(updatedTemplates);
    saveTemplates(updatedTemplates);
    setNewTemplateName("");
    setShowSaveTemplate(false);
  };

  const loadTemplate = (template: MappingTemplate) => {
    // Apply template mapping to current headers
    const newMapping: Record<string, string> = {};
    
    // Match template mapping to current excel headers
    Object.entries(template.mapping).forEach(([excelCol, field]) => {
      // Check if exact header exists
      if (excelHeaders.includes(excelCol)) {
        newMapping[excelCol] = field;
      } else {
        // Try to find by normalized comparison
        const normalizedTemplateCol = normalizeHeaderKey(excelCol);
        const matchingHeader = excelHeaders.find(
          (h) => normalizeHeaderKey(h) === normalizedTemplateCol
        );
        if (matchingHeader) {
          newMapping[matchingHeader] = field;
        }
      }
    });
    
    setColumnMapping(newMapping);
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
    setImporting(true);
    setProgress(0);
    
    const importResult: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };
    
    // Track updated count separately
    let updatedCount = 0;
    
    // Get existing partner codes to check for duplicates
    const { data: existingPartners } = await supabase
      .from("partners")
      .select("code, id")
      .eq("company_id", selectedCompany.id);
    
    const existingPartnersMap = new Map(
      existingPartners?.map((p) => [p.code, p.id]) || []
    );
    
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(parsedData.length / BATCH_SIZE);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, parsedData.length);
      const batch = parsedData.slice(start, end);
      
      const toInsert: ParsedPartner[] = [];
      const toUpdate: { id: string; data: ParsedPartner }[] = [];
      
      batch.forEach((p) => {
        const existingId = existingPartnersMap.get(p.code);
        if (existingId) {
          if (updateExisting) {
            toUpdate.push({ id: existingId, data: p });
          } else {
            importResult.skipped++;
          }
        } else {
          toInsert.push(p);
        }
      });
      
      // Insert new partners
      if (toInsert.length > 0) {
        const insertData = toInsert.map((p) => ({
          company_id: selectedCompany.id,
          code: p.code,
          name: p.name,
          legal_status: p.legal_status,
          address: p.address || null,
          postal_code: p.postal_code || null,
          city: p.city || null,
          country: p.country || "Srbija",
          pib: p.pib || null,
          mb: p.mb || null,
          activity_code: p.activity_code || null,
          jbkjs: p.jbkjs || null,
          phone: p.phone || null,
          email: p.email || null,
          website: p.website || null,
          responsible_person: p.responsible_person || null,
          is_customer: p.is_customer,
          is_supplier: p.is_supplier,
          is_active: p.is_active,
          payment_priority: p.payment_priority,
          note: p.note || null,
          other_data: p.other_data || null,
          assigned_to: p.assigned_to || null,
        }));
        
        const { error } = await supabase.from("partners").insert(insertData);
        
        if (error) {
          toInsert.forEach((p, i) => {
            importResult.failed++;
            importResult.errors.push({
              row: start + i + 2,
              code: p.code,
              error: error.message,
            });
          });
        } else {
          importResult.success += toInsert.length;
          toInsert.forEach((p) => existingPartnersMap.set(p.code, "inserted"));
        }
      }
      
      // Update existing partners
      for (const { id, data: p } of toUpdate) {
        const { error } = await supabase
          .from("partners")
          .update({
            name: p.name,
            legal_status: p.legal_status,
            address: p.address || null,
            postal_code: p.postal_code || null,
            city: p.city || null,
            country: p.country || "Srbija",
            pib: p.pib || null,
            mb: p.mb || null,
            activity_code: p.activity_code || null,
            jbkjs: p.jbkjs || null,
            phone: p.phone || null,
            email: p.email || null,
            website: p.website || null,
            responsible_person: p.responsible_person || null,
            is_customer: p.is_customer,
            is_supplier: p.is_supplier,
            is_active: p.is_active,
            payment_priority: p.payment_priority,
            note: p.note || null,
            other_data: p.other_data || null,
            assigned_to: p.assigned_to || null,
          })
          .eq("id", id);
        
        if (error) {
          importResult.failed++;
          importResult.errors.push({
            row: 0,
            code: p.code,
            error: error.message,
          });
        } else {
          updatedCount++;
        }
      }
      
      setProgress(Math.round(((batchIndex + 1) / totalBatches) * 100));
    }
    
    // Add updated count to success for display purposes
    importResult.success += updatedCount;
    
    setResult(importResult);
    setImporting(false);
    setStep("complete");
    
    // Invalidate partners query
    queryClient.invalidateQueries({ queryKey: ["partners", selectedCompany.id] });
    
    if (importResult.success > 0) {
      toast.success(`Uspešno uvezeno ${importResult.success} partnera`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Uvoz partnera iz Excel fajla
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Uvezite partnere iz .xlsx fajla. Sistem će automatski prepoznati kolone."}
            {step === "mapping" && "Proverite i prilagodite mapiranje kolona pre uvoza."}
            {step === "preview" && "Pregledajte podatke pre uvoza."}
            {step === "importing" && "Uvoz u toku..."}
            {step === "complete" && "Uvoz završen."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-8">
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Upload className="w-10 h-10 text-muted-foreground mb-3" />
              <span className="text-sm text-muted-foreground">
                Kliknite da izaberete Excel fajl
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Podržani formati: .xlsx, .xls
              </span>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Očekivane kolone (redosled):</h4>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {EXPECTED_COLUMNS.map((col, idx) => (
                  <Badge 
                    key={col} 
                    variant={col === "Šifra" || col === "Naziv" ? "default" : "outline"}
                    className="text-xs"
                  >
                    {idx + 1}. {col}{(col === "Šifra" || col === "Naziv") ? "*" : ""}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                * Obavezne kolone. Ostale kolone su opcione.
              </p>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-sm font-medium">{file?.name}</span>
              </div>
              <Badge>{rawRows.length} redova</Badge>
            </div>

            {/* Template management */}
            <div className="flex items-center gap-2 flex-wrap">
              {templates.length > 0 && (
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                  <Select onValueChange={(name) => {
                    const t = templates.find((tpl) => tpl.name === name);
                    if (t) loadTemplate(t);
                  }}>
                    <SelectTrigger className="w-[180px] h-8">
                      <SelectValue placeholder="Učitaj šablon..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {templates.map((t) => (
                        <SelectItem key={t.name} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {templates.length > 0 && (
                    <Select onValueChange={(name) => deleteTemplate(name)}>
                      <SelectTrigger className="w-8 h-8 p-0 justify-center">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {templates.map((t) => (
                          <SelectItem key={t.name} value={t.name}>
                            Obriši: {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              
              {showSaveTemplate ? (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Naziv šablona..."
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="h-8 w-40"
                    onKeyDown={(e) => e.key === "Enter" && saveTemplate()}
                  />
                  <Button size="sm" variant="outline" onClick={saveTemplate}>
                    <Save className="w-3 h-3 mr-1" />
                    Sačuvaj
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowSaveTemplate(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowSaveTemplate(true)}>
                  <Save className="w-3 h-3 mr-1" />
                  Sačuvaj kao šablon
                </Button>
              )}
            </div>

            {/* Debug: Show all detected Excel headers */}
            <div className="p-3 bg-muted/60 border border-border rounded-lg">
              <h4 className="text-xs font-medium text-foreground mb-2">
                Pronađena zaglavlja iz Excel fajla ({excelHeaders.length}):
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {excelHeaders.map((header, idx) => {
                  const isMapped = Object.keys(columnMapping).includes(header);
                  return (
                    <Badge 
                      key={idx} 
                      variant={isMapped ? "default" : "outline"}
                      className={`text-xs font-mono ${!isMapped ? "border-destructive/50 text-destructive" : ""}`}
                    >
                      {header}
                    </Badge>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Plave oznake su automatski mapirane. Crvene nisu prepoznate - možete ih ručno dodeliti ispod.
              </p>
            </div>

            <ScrollArea className="h-[280px] border rounded-lg">
              <div className="p-3 space-y-2">
                {MAPPABLE_FIELDS.map((field) => {
                  const currentExcelCol = fieldToExcelCol[field.key];
                  return (
                    <div key={field.key} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                      <div className="w-40 flex items-center gap-1.5">
                        <span className={`text-sm ${field.required ? "font-medium" : ""}`}>
                          {field.label}
                        </span>
                        {field.required && (
                          <span className="text-destructive text-xs">*</span>
                        )}
                      </div>
                      <Select
                        value={currentExcelCol || "__none__"}
                        onValueChange={(val) => updateFieldMapping(field.key, val === "__none__" ? null : val)}
                      >
                        <SelectTrigger className="flex-1 h-8">
                          <SelectValue placeholder="Izaberite kolonu..." />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50 max-h-60">
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground italic">— Nije mapirano —</span>
                          </SelectItem>
                          {excelHeaders.map((header, idx) => (
                            <SelectItem key={header} value={header}>
                              <span className="text-muted-foreground mr-1.5">{idx + 1}.</span>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {currentExcelCol && rawRows[0] && (
                        <span className="text-xs text-muted-foreground truncate max-w-32">
                          npr: {rawRows[0][currentExcelCol] ?? "(prazno)"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex justify-between">
              <Button variant="outline" onClick={resetState}>
                Nazad
              </Button>
              <Button onClick={applyMappingAndContinue}>
                Nastavi na pregled
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-sm font-medium">{file?.name}</span>
              </div>
              <Badge>{parsedData.length} partnera</Badge>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Prepoznate kolone:</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(columnMapping).map(([excelCol, field]) => (
                  <Badge key={excelCol} variant="secondary" className="text-xs">
                    {excelCol} → {field}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Pregled podataka (prvih 5):</h4>
              <ScrollArea className="h-64 border rounded-lg">
                <div className="p-2 space-y-2">
                  {parsedData.slice(0, 5).map((partner, idx) => (
                    <div key={idx} className="p-3 bg-muted/30 rounded text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">
                          {partner.code}
                        </span>
                        <span className="font-medium">{partner.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                        <div>
                          <span className="font-medium text-foreground/70">Adresa:</span>{" "}
                          {partner.address || <span className="italic text-destructive/60">—</span>}
                        </div>
                        <div>
                          <span className="font-medium text-foreground/70">PB/Mesto:</span>{" "}
                          {partner.postal_code || partner.city ? (
                            <>
                              {partner.postal_code || "—"} {partner.city || ""}
                            </>
                          ) : (
                            <span className="italic text-destructive/60">—</span>
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-foreground/70">PIB:</span>{" "}
                          {partner.pib || <span className="italic text-destructive/60">—</span>}
                        </div>
                        <div>
                          <span className="font-medium text-foreground/70">MB:</span>{" "}
                          {partner.mb || <span className="italic text-destructive/60">—</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {parsedData.length > 5 && (
                    <div className="text-center text-sm text-muted-foreground py-2">
                      ... i još {parsedData.length - 5} partnera
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="updateExisting"
                  checked={updateExisting}
                  onCheckedChange={(checked) => setUpdateExisting(checked === true)}
                />
                <Label htmlFor="updateExisting" className="text-sm cursor-pointer">
                  Ažuriraj postojeće partnere (po šifri)
                </Label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  Nazad
                </Button>
                <Button onClick={handleImport}>
                  <Upload className="w-4 h-4 mr-2" />
                  Uvezi {parsedData.length} partnera
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Uvoz u toku... Molimo sačekajte.
              </p>
              <Progress value={progress} className="h-2" />
              <p className="text-sm font-medium mt-2">{progress}%</p>
            </div>
          </div>
        )}

        {step === "complete" && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-success/10 rounded-lg text-center">
                <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-2" />
                <p className="text-2xl font-bold text-success">{result.success}</p>
                <p className="text-xs text-muted-foreground">Uvezeno</p>
              </div>
              <div className="p-4 bg-warning/10 rounded-lg text-center">
                <AlertCircle className="w-6 h-6 text-warning mx-auto mb-2" />
                <p className="text-2xl font-bold text-warning">{result.skipped}</p>
                <p className="text-xs text-muted-foreground">Preskočeno</p>
              </div>
              <div className="p-4 bg-destructive/10 rounded-lg text-center">
                <X className="w-6 h-6 text-destructive mx-auto mb-2" />
                <p className="text-2xl font-bold text-destructive">{result.failed}</p>
                <p className="text-xs text-muted-foreground">Greške</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-destructive">Greške:</h4>
                <ScrollArea className="h-32 border border-destructive/20 rounded-lg">
                  <div className="p-2 space-y-1">
                    {result.errors.slice(0, 10).map((err, idx) => (
                      <div key={idx} className="text-xs text-destructive">
                        Red {err.row} ({err.code}): {err.error}
                      </div>
                    ))}
                    {result.errors.length > 10 && (
                      <div className="text-xs text-muted-foreground">
                        ... i još {result.errors.length - 10} grešaka
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>Zatvori</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
