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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

interface NormImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedNormRow {
  product_code: string;
  variant_name: string;
  material_code: string;
  qty_per_kg: number;
  qty_per_m: number;
  qty_per_pc: number;
}

interface ImportResult {
  norms_created: number;
  norms_updated: number;
  variants_created: number;
  items_created: number;
  failed: number;
  errors: { row: number; error: string }[];
}

// Normalization helpers
const removeDiacritics = (str: string): string =>
  str.replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "d");

const normalizeHeaderKey = (input: string): string => {
  const cleaned = input
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .trim()
    .toLowerCase();
  const stripped = cleaned.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return removeDiacritics(stripped).replace(/\s+/g, " ").trim();
};

type NormField = keyof ParsedNormRow;

const MAPPABLE_FIELDS: { key: NormField; label: string; required?: boolean }[] = [
  { key: "product_code", label: "Šifra proizvoda", required: true },
  { key: "variant_name", label: "Varijanta", required: true },
  { key: "material_code", label: "Šifra repromaterijala", required: true },
  { key: "qty_per_kg", label: "Količina po kg" },
  { key: "qty_per_m", label: "Količina po m" },
  { key: "qty_per_pc", label: "Količina po kom" },
];

const COLUMN_MAPPINGS: Record<string, NormField> = {
  "sifra proizvoda": "product_code",
  "sifra gp": "product_code",
  "gotov proizvod": "product_code",
  "product code": "product_code",
  "sifra gotovog proizvoda": "product_code",
  "varijanta": "variant_name",
  "variant": "variant_name",
  "naziv varijante": "variant_name",
  "varijanta normativa": "variant_name",
  "sifra repromaterijala": "material_code",
  "sifra materijala": "material_code",
  "material code": "material_code",
  "repromaterijal": "material_code",
  "sifra rm": "material_code",
  "kolicina po kg": "qty_per_kg",
  "qty per kg": "qty_per_kg",
  "po kg": "qty_per_kg",
  "kg": "qty_per_kg",
  "kolicina po m": "qty_per_m",
  "qty per m": "qty_per_m",
  "po m": "qty_per_m",
  "m": "qty_per_m",
  "kolicina po kom": "qty_per_pc",
  "qty per pc": "qty_per_pc",
  "po kom": "qty_per_pc",
  "kom": "qty_per_pc",
};

const NORMALIZED_COLUMN_MAPPINGS: Record<string, NormField> = Object.fromEntries(
  Object.entries(COLUMN_MAPPINGS).map(([k, v]) => [normalizeHeaderKey(k), v])
) as Record<string, NormField>;

export function NormImportDialog({ open, onOpenChange }: NormImportDialogProps) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedNormRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing" | "complete">("upload");

  const resetState = useCallback(() => {
    setFile(null);
    setColumnMapping({});
    setRawRows([]);
    setExcelHeaders([]);
    setParsedData([]);
    setImporting(false);
    setProgress(0);
    setResult(null);
    setStep("upload");
  }, []);

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

  const parseNumber = (value: any): number => {
    if (value === undefined || value === null || value === "") return 0;
    const strValue = String(value).trim().replace(",", ".");
    const num = parseFloat(strValue);
    return isNaN(num) ? 0 : num;
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
        if (headerValue) allHeaders.push(headerValue);
      }

      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: "" });

      if (jsonData.length === 0) {
        toast.error("Excel fajl je prazan");
        return;
      }

      const rowHeaders = jsonData.reduce<string[]>((acc, row) => {
        Object.keys(row).forEach((k) => { if (!acc.includes(k)) acc.push(k); });
        return acc;
      }, []);

      const headers = [...allHeaders];
      rowHeaders.forEach((h) => { if (!headers.includes(h)) headers.push(h); });

      setExcelHeaders(headers);

      const detectedMapping: Record<string, string> = {};
      headers.forEach((header) => {
        const normalized = normalizeHeaderKey(header);
        const noSpace = normalized.replace(/\s/g, "");
        const mapped = NORMALIZED_COLUMN_MAPPINGS[normalized] ?? NORMALIZED_COLUMN_MAPPINGS[noSpace];
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
      Object.keys(newMapping).forEach((key) => {
        if (newMapping[key] === field) delete newMapping[key];
      });
      if (excelCol) newMapping[excelCol] = field;
      return newMapping;
    });
  };

  const applyMappingAndContinue = () => {
    const hasProduct = Object.values(columnMapping).includes("product_code");
    const hasVariant = Object.values(columnMapping).includes("variant_name");
    const hasMaterial = Object.values(columnMapping).includes("material_code");

    if (!hasProduct || !hasVariant || !hasMaterial) {
      toast.error("Morate mapirati obavezna polja: Šifra proizvoda, Varijanta i Šifra repromaterijala");
      return;
    }

    const parsed: ParsedNormRow[] = rawRows
      .map((row) => {
        const item: Partial<ParsedNormRow> = {};
        Object.entries(columnMapping).forEach(([excelCol, field]) => {
          const value = row[excelCol];
          if (field === "qty_per_kg" || field === "qty_per_m" || field === "qty_per_pc") {
            (item as any)[field] = parseNumber(value);
          } else {
            (item as any)[field] = value !== undefined && value !== null ? String(value).trim() : "";
          }
        });
        return item as ParsedNormRow;
      })
      .filter((r) => r.product_code && r.material_code);

    setParsedData(parsed);
    setStep("preview");
  };

  // Group data for preview
  const groupedPreview = useMemo(() => {
    const groups: Record<string, Record<string, ParsedNormRow[]>> = {};
    parsedData.forEach((row) => {
      if (!groups[row.product_code]) groups[row.product_code] = {};
      const varName = row.variant_name || "Varijanta 1";
      if (!groups[row.product_code][varName]) groups[row.product_code][varName] = [];
      groups[row.product_code][varName].push(row);
    });
    return groups;
  }, [parsedData]);

  const productCount = Object.keys(groupedPreview).length;
  const variantCount = Object.values(groupedPreview).reduce(
    (sum, vars) => sum + Object.keys(vars).length, 0
  );

  const handleImport = async () => {
    if (!selectedCompany) {
      toast.error("Nije izabrana firma");
      return;
    }

    setImporting(true);
    setStep("importing");
    setProgress(0);

    const importResult: ImportResult = {
      norms_created: 0,
      norms_updated: 0,
      variants_created: 0,
      items_created: 0,
      failed: 0,
      errors: [],
    };

    const companyId = selectedCompany.id;

    // Fetch all articles for the company to resolve codes
    let allArticles: { id: string; code: string; name: string; unit: string }[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("articles")
        .select("id, code, name, unit")
        .eq("company_id", companyId)
        .range(from, from + batchSize - 1);
      if (error) break;
      if (!data || data.length === 0) break;
      allArticles = [...allArticles, ...data];
      if (data.length < batchSize) break;
      from += batchSize;
    }

    const articleByCode: Record<string, { id: string; code: string; name: string; unit: string }> = {};
    allArticles.forEach((a) => { articleByCode[a.code] = a; });

    const productCodes = Object.keys(groupedPreview);
    const total = productCodes.length;

    for (let i = 0; i < total; i++) {
      const productCode = productCodes[i];
      const variants = groupedPreview[productCode];

      setProgress(Math.round(((i + 1) / total) * 100));

      const productArticle = articleByCode[productCode];
      if (!productArticle) {
        importResult.failed++;
        importResult.errors.push({ row: 0, error: `Artikal sa šifrom "${productCode}" nije pronađen` });
        continue;
      }

      // Check if product is SVK=9
      try {
        // Find or create norm
        const { data: existingNorm } = await supabase
          .from("material_norms")
          .select("id")
          .eq("company_id", companyId)
          .eq("article_id", productArticle.id)
          .maybeSingle();

        let normId: string;

        if (existingNorm) {
          normId = existingNorm.id;
          importResult.norms_updated++;
        } else {
          const { data: newNorm, error: normError } = await supabase
            .from("material_norms")
            .insert({ company_id: companyId, article_id: productArticle.id })
            .select("id")
            .single();
          if (normError) throw normError;
          normId = newNorm.id;
          importResult.norms_created++;
        }

        // Process each variant
        for (const [variantName, items] of Object.entries(variants)) {
          // Check existing variant
          const { data: existingVariant } = await supabase
            .from("material_norm_variants")
            .select("id, status")
            .eq("norm_id", normId)
            .eq("variant_name", variantName)
            .maybeSingle();

          let variantId: string;

          if (existingVariant) {
            if (existingVariant.status === "approved") {
              importResult.errors.push({
                row: 0,
                error: `Varijanta "${variantName}" za "${productCode}" je odobrena i ne može se ažurirati`,
              });
              continue;
            }
            variantId = existingVariant.id;

            // Delete existing items for replacement
            await supabase
              .from("material_norm_items")
              .delete()
              .eq("variant_id", variantId);
          } else {
            // Get next variant number
            const { data: allVariants } = await supabase
              .from("material_norm_variants")
              .select("variant_number")
              .eq("norm_id", normId)
              .order("variant_number", { ascending: false })
              .limit(1);

            const nextNumber = (allVariants?.[0]?.variant_number ?? 0) + 1;

            const { data: newVariant, error: varError } = await supabase
              .from("material_norm_variants")
              .insert({
                norm_id: normId,
                company_id: companyId,
                variant_number: nextNumber,
                variant_name: variantName,
                is_default: nextNumber === 1,
              })
              .select("id")
              .single();

            if (varError) throw varError;
            variantId = newVariant.id;
            importResult.variants_created++;
          }

          // Insert items
          const itemsToInsert = items
            .map((item, idx) => {
              const materialArticle = articleByCode[item.material_code];
              if (!materialArticle) {
                importResult.errors.push({
                  row: 0,
                  error: `Repromaterijal "${item.material_code}" nije pronađen (proizvod: ${productCode})`,
                });
                return null;
              }
              return {
                variant_id: variantId,
                company_id: companyId,
                article_id: materialArticle.id,
                article_code: materialArticle.code,
                article_name: materialArticle.name,
                unit: materialArticle.unit,
                qty_per_kg: item.qty_per_kg || 0,
                qty_per_m: item.qty_per_m || 0,
                qty_per_pc: item.qty_per_pc || 0,
                item_order: idx + 1,
              };
            })
            .filter(Boolean);

          if (itemsToInsert.length > 0) {
            const { error: itemsError } = await supabase
              .from("material_norm_items")
              .insert(itemsToInsert as any[]);

            if (itemsError) {
              importResult.errors.push({
                row: 0,
                error: `Greška pri unosu stavki za "${productCode}" / "${variantName}": ${itemsError.message}`,
              });
            } else {
              importResult.items_created += itemsToInsert.length;
            }
          }
        }
      } catch (err: any) {
        importResult.failed++;
        importResult.errors.push({ row: 0, error: `Greška za "${productCode}": ${err.message}` });
      }
    }

    setResult(importResult);
    setStep("complete");
    setImporting(false);

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ["material_norms"] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !importing && (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Uvoz normativa iz Excel-a
          </DialogTitle>
          <DialogDescription>
            Format: Šifra proizvoda, Varijanta, Šifra repromaterijala, Količine (po kg/m/kom)
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Izaberite Excel fajl sa normativima
              </p>
              <label>
                <Button variant="outline" asChild>
                  <span>Izaberite fajl</span>
                </Button>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Očekivane kolone:</strong></p>
              <p>• Šifra proizvoda (SVK=9) — obavezno</p>
              <p>• Varijanta normativa — obavezno</p>
              <p>• Šifra repromaterijala (SVK=2) — obavezno</p>
              <p>• Količina po kg, Količina po m, Količina po kom — opciono</p>
              <p className="mt-2"><strong>Napomena:</strong> Ako normativ za proizvod već postoji, varijante u statusu "Nacrt" će biti ažurirane (stavke zamenjene). Odobrene varijante se preskaču.</p>
            </div>
          </div>
        )}

        {/* Step: Mapping */}
        {step === "mapping" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Fajl: <strong>{file?.name}</strong> ({rawRows.length} redova)
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Mapiranje kolona:</p>
              {MAPPABLE_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <div className="w-48 text-sm">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </div>
                  <Select
                    value={fieldToExcelCol[field.key] || "__none__"}
                    onValueChange={(val) =>
                      updateFieldMapping(field.key, val === "__none__" ? null : val)
                    }
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Izaberite kolonu..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Nije mapirano —</SelectItem>
                      {excelHeaders.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldToExcelCol[field.key] && (
                    <Badge variant="secondary" className="text-xs">
                      ✓
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("upload")}>Nazad</Button>
              <Button onClick={applyMappingAndContinue}>Nastavi</Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline">{productCount} proizvoda</Badge>
              <Badge variant="outline">{variantCount} varijanti</Badge>
              <Badge variant="outline">{parsedData.length} stavki</Badge>
            </div>

            <ScrollArea className="h-[300px] border rounded-md p-3">
              {Object.entries(groupedPreview).map(([productCode, variants]) => (
                <div key={productCode} className="mb-4">
                  <p className="font-medium text-sm">
                    Proizvod: <strong>{productCode}</strong>
                  </p>
                  {Object.entries(variants).map(([varName, items]) => (
                    <div key={varName} className="ml-4 mt-1">
                      <p className="text-xs text-muted-foreground">
                        Varijanta: {varName} ({items.length} stavki)
                      </p>
                      <div className="ml-4 text-xs space-y-0.5">
                        {items.slice(0, 5).map((item, idx) => (
                          <p key={idx}>
                            {item.material_code}
                            {item.qty_per_kg ? ` | kg: ${item.qty_per_kg}` : ""}
                            {item.qty_per_m ? ` | m: ${item.qty_per_m}` : ""}
                            {item.qty_per_pc ? ` | kom: ${item.qty_per_pc}` : ""}
                          </p>
                        ))}
                        {items.length > 5 && (
                          <p className="text-muted-foreground">...i još {items.length - 5} stavki</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              Postojeće varijante u statusu "Nacrt" će biti ažurirane (stavke zamenjene). Odobrene varijante se preskaču.
            </p>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("mapping")}>Nazad</Button>
              <Button onClick={handleImport}>Pokreni uvoz</Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="space-y-4 py-8">
            <p className="text-center text-sm">Uvoz u toku...</p>
            <Progress value={progress} className="h-2" />
            <p className="text-center text-xs text-muted-foreground">{progress}%</p>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium">
              {result.failed === 0 && result.errors.length === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <AlertCircle className="w-5 h-5 text-destructive" />
              )}
              Uvoz završen
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>Kreirano normativa: <strong>{result.norms_created}</strong></div>
              <div>Ažurirano normativa: <strong>{result.norms_updated}</strong></div>
              <div>Kreirano varijanti: <strong>{result.variants_created}</strong></div>
              <div>Kreirano stavki: <strong>{result.items_created}</strong></div>
              {result.failed > 0 && (
                <div className="text-destructive">Neuspešno: <strong>{result.failed}</strong></div>
              )}
            </div>

            {result.errors.length > 0 && (
              <ScrollArea className="h-[150px] border rounded-md p-3">
                {result.errors.map((err, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs mb-1">
                    <AlertCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                    <span>{err.error}</span>
                  </div>
                ))}
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
