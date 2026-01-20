import { useState, useCallback } from "react";
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
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from "lucide-react";
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
  // Web adresa
  "web adresa": "website",
  "webadresa": "website",
  "web": "website",
  "website": "website",
  "sajt": "website",
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

export function PartnerImportDialog({ open, onOpenChange }: PartnerImportDialogProps) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedPartner[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  const [updateExisting, setUpdateExisting] = useState(false);

  const resetState = useCallback(() => {
    setFile(null);
    setParsedData([]);
    setColumnMapping({});
    setImporting(false);
    setProgress(0);
    setResult(null);
    setStep("upload");
    setUpdateExisting(false);
  }, []);

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
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet);
      
      if (jsonData.length === 0) {
        toast.error("Excel fajl je prazan");
        return;
      }
      
      // Detect column mappings from headers
      const headers = Object.keys(jsonData[0]);
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
      
      // Parse data
      const parsed: ParsedPartner[] = jsonData.map((row) => {
        const partner: Partial<ParsedPartner> = {
          is_customer: true,
          is_supplier: false,
          is_active: true,
          payment_priority: 3,
          legal_status: 1,
          country: "Srbija",
        };
        
        Object.entries(detectedMapping).forEach(([excelCol, partnerField]) => {
          const value = parseExcelValue(row[excelCol], partnerField as keyof ParsedPartner);
          if (value !== undefined) {
            (partner as any)[partnerField] = value;
          }
        });
        
        return partner as ParsedPartner;
      }).filter((p) => p.code && p.name); // Only keep rows with code and name
      
      setParsedData(parsed);
      setStep("preview");
      
    } catch (error) {
      console.error("Error parsing Excel:", error);
      toast.error("Greška pri čitanju Excel fajla");
    }
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
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Uvoz partnera iz Excel fajla
          </DialogTitle>
          <DialogDescription>
            Uvezite partnere iz .xlsx fajla. Sistem će automatski prepoznati kolone.
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
                <Button variant="outline" onClick={resetState}>
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
