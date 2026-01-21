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

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedContact {
  partner_code: string;
  contact_name: string;
  position?: string;
  phone1?: string;
  phone2?: string;
  email?: string;
  note?: string;
}

interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: { row: number; partner_code: string; error: string }[];
}

interface MappingTemplate {
  name: string;
  mapping: Record<string, string>;
}

// All mappable fields with labels
const MAPPABLE_FIELDS: { key: keyof ParsedContact; label: string; required: boolean }[] = [
  { key: "partner_code", label: "Šifra partnera", required: true },
  { key: "contact_name", label: "Ime kontakta", required: true },
  { key: "position", label: "Pozicija", required: false },
  { key: "phone1", label: "Telefon 1", required: false },
  { key: "phone2", label: "Telefon 2", required: false },
  { key: "email", label: "Email", required: false },
  { key: "note", label: "Napomena", required: false },
];

// Expected column order
const EXPECTED_COLUMNS = ["Šifra partnera", "Ime kontakta", "Pozicija", "Telefon 1", "Telefon 2", "Email", "Napomena"];

const COLUMN_MAPPINGS: Record<string, keyof ParsedContact> = {
  // Šifra partnera
  "šifra partnera": "partner_code",
  "sifra partnera": "partner_code",
  "partner code": "partner_code",
  "partnercode": "partner_code",
  "šifra": "partner_code",
  "sifra": "partner_code",
  "code": "partner_code",
  // Ime kontakta
  "ime kontakta": "contact_name",
  "kontakt": "contact_name",
  "ime": "contact_name",
  "contact name": "contact_name",
  "contact": "contact_name",
  "name": "contact_name",
  "naziv": "contact_name",
  // Pozicija
  "pozicija": "position",
  "position": "position",
  "funkcija": "position",
  "radno mesto": "position",
  // Telefon 1
  "telefon 1": "phone1",
  "telefon1": "phone1",
  "telefon": "phone1",
  "phone1": "phone1",
  "phone 1": "phone1",
  "tel1": "phone1",
  "tel 1": "phone1",
  "tel": "phone1",
  "mobilni": "phone1",
  "mobitel": "phone1",
  // Telefon 2
  "telefon 2": "phone2",
  "telefon2": "phone2",
  "phone2": "phone2",
  "phone 2": "phone2",
  "tel2": "phone2",
  "tel 2": "phone2",
  "fiksni": "phone2",
  // Email
  "email": "email",
  "e-mail": "email",
  "e mail": "email",
  "mail": "email",
  "elektronska posta": "email",
  // Napomena
  "napomena": "note",
  "note": "note",
  "komentar": "note",
  "opis": "note",
};

// Build a normalized lookup
const NORMALIZED_COLUMN_MAPPINGS: Record<string, keyof ParsedContact> = Object.fromEntries(
  Object.entries(COLUMN_MAPPINGS).map(([k, v]) => [normalizeHeaderKey(k), v])
) as Record<string, keyof ParsedContact>;

const TEMPLATES_STORAGE_KEY = "contact-import-templates";

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

export function ContactImportDialog({ open, onOpenChange }: ContactImportDialogProps) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedContact[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing" | "complete">("upload");
  const [skipExisting, setSkipExisting] = useState(true);
  
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
    setSkipExisting(true);
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

  const parseExcelValue = (value: any): string => {
    if (value === undefined || value === null || value === "") return "";
    return String(value).trim();
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
      
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: "" });
      
      if (jsonData.length === 0) {
        toast.error("Excel fajl je prazan");
        return;
      }
      
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

      if (Object.keys(detectedMapping).length === 0 && headers.length >= 2) {
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
      
      Object.keys(newMapping).forEach((key) => {
        if (newMapping[key] === field) {
          delete newMapping[key];
        }
      });
      
      if (excelCol) {
        newMapping[excelCol] = field;
      }
      
      return newMapping;
    });
  };

  const applyMappingAndContinue = () => {
    const hasPartnerCode = Object.values(columnMapping).includes("partner_code");
    const hasContactName = Object.values(columnMapping).includes("contact_name");
    
    if (!hasPartnerCode || !hasContactName) {
      toast.error("Morate mapirati obavezna polja: Šifra partnera i Ime kontakta");
      return;
    }

    const parsed: ParsedContact[] = rawRows.map((row) => {
      const contact: Partial<ParsedContact> = {};
      
      Object.entries(columnMapping).forEach(([excelCol, field]) => {
        const value = parseExcelValue(row[excelCol]);
        if (value) {
          (contact as any)[field] = value;
        }
      });
      
      return contact as ParsedContact;
    }).filter((c) => c.partner_code && c.contact_name);
    
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
    const newMapping: Record<string, string> = {};
    
    Object.entries(template.mapping).forEach(([excelCol, field]) => {
      if (excelHeaders.includes(excelCol)) {
        newMapping[excelCol] = field;
      } else {
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
    
    // Get all partners for this company (batch fetch for >1000 rows)
    const allPartners: { id: string; code: string }[] = [];
    let partnerFrom = 0;
    const FETCH_BATCH = 1000;
    
    while (true) {
      const { data: partnerBatch, error: partnerError } = await supabase
        .from("partners")
        .select("id, code")
        .eq("company_id", selectedCompany.id)
        .range(partnerFrom, partnerFrom + FETCH_BATCH - 1);
      
      if (partnerError) {
        toast.error("Greška pri učitavanju partnera");
        setImporting(false);
        setStep("preview");
        return;
      }
      
      if (!partnerBatch || partnerBatch.length === 0) break;
      allPartners.push(...partnerBatch);
      if (partnerBatch.length < FETCH_BATCH) break;
      partnerFrom += FETCH_BATCH;
    }
    
    const partnerCodeToId = new Map(allPartners.map((p) => [p.code, p.id]));
    
    // Get existing contacts to check for duplicates (batch fetch for >1000 rows)
    const allExistingContacts: { partner_id: string; contact_name: string }[] = [];
    let contactFrom = 0;
    
    while (true) {
      const { data: contactBatch, error: contactError } = await supabase
        .from("partner_contacts")
        .select("partner_id, contact_name")
        .eq("company_id", selectedCompany.id)
        .range(contactFrom, contactFrom + FETCH_BATCH - 1);
      
      if (contactError) {
        toast.error("Greška pri učitavanju postojećih kontakata");
        setImporting(false);
        setStep("preview");
        return;
      }
      
      if (!contactBatch || contactBatch.length === 0) break;
      allExistingContacts.push(...contactBatch);
      if (contactBatch.length < FETCH_BATCH) break;
      contactFrom += FETCH_BATCH;
    }
    
    const existingContactSet = new Set(
      allExistingContacts.map((c) => `${c.partner_id}|${c.contact_name.toLowerCase()}`)
    );
    
    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil(parsedData.length / BATCH_SIZE);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, parsedData.length);
      const batch = parsedData.slice(start, end);
      
      const toInsert: {
        partner_id: string;
        company_id: string;
        contact_name: string;
        position: string | null;
        phone1: string | null;
        phone2: string | null;
        email: string | null;
        note: string | null;
      }[] = [];
      
      batch.forEach((row, idx) => {
        const partnerId = partnerCodeToId.get(row.partner_code);
        
        if (!partnerId) {
          importResult.failed++;
          importResult.errors.push({
            row: start + idx + 2,
            partner_code: row.partner_code,
            error: "Partner sa ovom šifrom ne postoji",
          });
          return;
        }
        
        const contactKey = `${partnerId}|${row.contact_name.toLowerCase()}`;
        if (existingContactSet.has(contactKey)) {
          if (skipExisting) {
            importResult.skipped++;
          } else {
            importResult.failed++;
            importResult.errors.push({
              row: start + idx + 2,
              partner_code: row.partner_code,
              error: `Kontakt "${row.contact_name}" već postoji za ovog partnera`,
            });
          }
          return;
        }
        
        toInsert.push({
          partner_id: partnerId,
          company_id: selectedCompany.id,
          contact_name: row.contact_name,
          position: row.position || null,
          phone1: row.phone1 || null,
          phone2: row.phone2 || null,
          email: row.email || null,
          note: row.note || null,
        });
        
        existingContactSet.add(contactKey);
      });
      
      if (toInsert.length > 0) {
        const { error } = await supabase.from("partner_contacts").insert(toInsert);
        
        if (error) {
          toInsert.forEach((_, i) => {
            importResult.failed++;
            importResult.errors.push({
              row: start + i + 2,
              partner_code: batch[i].partner_code,
              error: error.message,
            });
          });
        } else {
          importResult.success += toInsert.length;
        }
      }
      
      setProgress(Math.round(((batchIndex + 1) / totalBatches) * 100));
    }
    
    setResult(importResult);
    setImporting(false);
    setStep("complete");
    
    queryClient.invalidateQueries({ queryKey: ["partner_contacts"] });
    
    if (importResult.success > 0) {
      toast.success(`Uspešno uvezeno ${importResult.success} kontakata`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Uvoz kontakata iz Excel fajla
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Uvezite kontakte partnera iz .xlsx fajla. Potrebne su kolone: Šifra partnera i Ime kontakta."}
            {step === "mapping" && "Proverite i prilagodite mapiranje kolona pre uvoza."}
            {step === "preview" && "Pregledajte podatke pre uvoza."}
            {step === "importing" && "Uvoz u toku..."}
            {step === "complete" && "Uvoz završen."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-8">
            <label
              htmlFor="contact-file-upload"
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
                id="contact-file-upload"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Očekivane kolone:</h4>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {EXPECTED_COLUMNS.map((col, idx) => {
                  const isRequired = col === "Šifra partnera" || col === "Ime kontakta";
                  return (
                    <Badge key={col} variant={isRequired ? "default" : "outline"} className="text-xs">
                      {idx + 1}. {col}{isRequired ? "*" : ""}
                    </Badge>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                * Obavezne kolone. Šifra partnera služi za pronalaženje partnera u bazi.
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
                        <div key={t.name} className="flex items-center justify-between px-2 py-1 hover:bg-muted">
                          <SelectItem value={t.name} className="flex-1 p-0">
                            {t.name}
                          </SelectItem>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTemplate(t.name);
                            }}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {showSaveTemplate ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Naziv šablona"
                    className="w-[150px] h-8"
                    autoComplete="off"
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
                  Sačuvaj mapiranje
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="font-medium text-muted-foreground">Kolona u Excel fajlu</div>
              <div className="font-medium text-muted-foreground">Polje u sistemu</div>
            </div>

            <ScrollArea className="h-[250px] pr-4">
              <div className="space-y-2">
                {excelHeaders.map((header) => (
                  <div key={header} className="grid grid-cols-2 gap-4 items-center">
                    <div className="text-sm truncate" title={header}>
                      {header}
                    </div>
                    <Select
                      value={columnMapping[header] || "__none__"}
                      onValueChange={(val) => updateFieldMapping(val === "__none__" ? "" : val, val !== "__none__" ? header : null)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Nije mapirano" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="__none__">Nije mapirano</SelectItem>
                        {MAPPABLE_FIELDS.map((f) => (
                          <SelectItem
                            key={f.key}
                            value={f.key}
                            disabled={
                              Object.values(columnMapping).includes(f.key) &&
                              columnMapping[header] !== f.key
                            }
                          >
                            {f.label} {f.required && "*"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Mapirana polja:</h4>
              <div className="flex flex-wrap gap-2">
                {MAPPABLE_FIELDS.map((f) => {
                  const isMapped = Object.values(columnMapping).includes(f.key);
                  return (
                    <Badge
                      key={f.key}
                      variant={isMapped ? "default" : "outline"}
                      className={!isMapped && f.required ? "border-destructive text-destructive" : ""}
                    >
                      {f.label}
                      {f.required && "*"}
                      {isMapped && <CheckCircle2 className="w-3 h-3 ml-1" />}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Odustani
              </Button>
              <Button onClick={applyMappingAndContinue}>
                Nastavi
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="font-medium">{parsedData.length} kontakata spremno za uvoz</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="skip-existing-contacts"
                checked={skipExisting}
                onCheckedChange={(checked) => setSkipExisting(checked as boolean)}
              />
              <Label htmlFor="skip-existing-contacts" className="text-sm">
                Preskoči već postojeće kontakte (isti partner + isto ime)
              </Label>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Šifra partnera</th>
                    <th className="text-left p-2">Ime kontakta</th>
                    <th className="text-left p-2">Pozicija</th>
                    <th className="text-left p-2">Telefon</th>
                    <th className="text-left p-2">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="border-t hover:bg-muted/50">
                      <td className="p-2">{row.partner_code}</td>
                      <td className="p-2">{row.contact_name}</td>
                      <td className="p-2">{row.position || "-"}</td>
                      <td className="p-2">{row.phone1 || "-"}</td>
                      <td className="p-2">{row.email || "-"}</td>
                    </tr>
                  ))}
                  {parsedData.length > 100 && (
                    <tr className="border-t">
                      <td colSpan={5} className="p-2 text-center text-muted-foreground">
                        ... i još {parsedData.length - 100} redova
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Nazad
              </Button>
              <Button onClick={handleImport}>
                Uvezi {parsedData.length} kontakata
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-center text-muted-foreground">
              Uvoz u toku... {progress}%
            </p>
          </div>
        )}

        {step === "complete" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              {result.success > 0 && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{result.success} uspešno</span>
                </div>
              )}
              {result.skipped > 0 && (
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="w-5 h-5" />
                  <span>{result.skipped} preskočeno</span>
                </div>
              )}
              {result.failed > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <X className="w-5 h-5" />
                  <span>{result.failed} neuspešno</span>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <ScrollArea className="h-[200px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {result.errors.slice(0, 50).map((err, idx) => (
                    <div key={idx} className="text-sm text-destructive flex gap-2">
                      <span className="font-mono">Red {err.row}:</span>
                      <span>Partner "{err.partner_code}" - {err.error}</span>
                    </div>
                  ))}
                  {result.errors.length > 50 && (
                    <div className="text-sm text-muted-foreground">
                      ... i još {result.errors.length - 50} grešaka
                    </div>
                  )}
                </div>
              </ScrollArea>
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
