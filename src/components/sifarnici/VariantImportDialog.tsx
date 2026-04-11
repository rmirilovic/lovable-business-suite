import { useState, useCallback, useMemo } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

interface VariantImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedVariant {
  code: string;
  description: string;
  length_value: number;
}

interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: { row: number; code: string; error: string }[];
}

const MAPPABLE_FIELDS: { key: keyof ParsedVariant; label: string; required?: boolean }[] = [
  { key: "code", label: "Šifra", required: true },
  { key: "description", label: "Opis", required: true },
  { key: "length_value", label: "Dužina (m)" },
];

const removeDiacritics = (str: string): string =>
  str.replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "d");

const normalizeHeader = (input: string): string =>
  removeDiacritics(input.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ").trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim());

const COLUMN_SYNONYMS: Record<string, keyof ParsedVariant> = {
  "sifra": "code", "code": "code", "šifra": "code", "sifra varijante": "code", "šifra varijante": "code",
  "opis": "description", "description": "description", "naziv": "description", "name": "description", "naziv varijante": "description",
  "duzina": "length_value", "dužina": "length_value", "length": "length_value", "length value": "length_value",
  "duzina m": "length_value", "dužina m": "length_value", "meters": "length_value", "metara": "length_value",
};

const NORMALIZED_SYNONYMS: Record<string, keyof ParsedVariant> = Object.fromEntries(
  Object.entries(COLUMN_SYNONYMS).map(([k, v]) => [normalizeHeader(k), v])
) as Record<string, keyof ParsedVariant>;

export function VariantImportDialog({ open, onOpenChange }: VariantImportDialogProps) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedVariant[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing" | "complete">("upload");
  const [updateExisting, setUpdateExisting] = useState(false);

  const resetState = useCallback(() => {
    setFile(null); setParsedData([]); setColumnMapping({}); setRawRows([]);
    setExcelHeaders([]); setImporting(false); setProgress(0); setResult(null);
    setStep("upload"); setUpdateExisting(false);
  }, []);

  const fieldToExcelCol = useMemo(() => {
    const inv: Record<string, string> = {};
    Object.entries(columnMapping).forEach(([col, field]) => { inv[field] = col; });
    return inv;
  }, [columnMapping]);

  const handleClose = () => { resetState(); onOpenChange(false); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      toast.error("Molimo izaberite Excel fajl (.xlsx ili .xls)"); return;
    }
    setFile(f);
    try {
      const data = await f.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
      const headers: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
        if (cell) headers.push(String(cell.v).trim());
      }
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      if (jsonData.length === 0) { toast.error("Excel fajl je prazan"); return; }

      const allHeaders = [...headers];
      jsonData.forEach(row => Object.keys(row).forEach(k => { if (!allHeaders.includes(k)) allHeaders.push(k); }));
      setExcelHeaders(allHeaders);

      const detected: Record<string, string> = {};
      allHeaders.forEach(h => {
        const norm = normalizeHeader(h);
        const mapped = NORMALIZED_SYNONYMS[norm] ?? NORMALIZED_SYNONYMS[norm.replace(/\s/g, "")];
        if (mapped) detected[h] = mapped;
      });
      setColumnMapping(detected);
      setRawRows(jsonData);
      setStep("mapping");
    } catch {
      toast.error("Greška pri čitanju Excel fajla");
    }
  };

  const updateFieldMapping = (field: string, excelCol: string | null) => {
    setColumnMapping(prev => {
      const m = { ...prev };
      Object.keys(m).forEach(k => { if (m[k] === field) delete m[k]; });
      if (excelCol) m[excelCol] = field;
      return m;
    });
  };

  const applyMappingAndContinue = () => {
    const vals = Object.values(columnMapping);
    if (!vals.includes("code") || !vals.includes("description")) {
      toast.error("Morate mapirati obavezna polja: Šifra i Opis"); return;
    }
    const parsed: ParsedVariant[] = rawRows.map(row => {
      const v: Partial<ParsedVariant> = { length_value: 0 };
      Object.entries(columnMapping).forEach(([col, field]) => {
        const raw = row[col];
        if (raw === undefined || raw === null || raw === "") return;
        if (field === "length_value") {
          const n = parseFloat(String(raw).replace(",", "."));
          if (!isNaN(n)) v.length_value = n;
        } else {
          (v as any)[field] = String(raw).trim();
        }
      });
      return v as ParsedVariant;
    }).filter(v => v.code && v.description);
    setParsedData(parsed);
    setStep("preview");
  };

  const handleImport = async () => {
    if (!selectedCompany) { toast.error("Nije izabrana firma"); return; }
    setImporting(true); setStep("importing"); setProgress(0);
    const res: ImportResult = { success: 0, failed: 0, skipped: 0, errors: [] };
    const total = parsedData.length;

    for (let i = 0; i < total; i++) {
      const v = parsedData[i];
      try {
        const { data: existing } = await supabase
          .from("article_variants").select("id")
          .eq("company_id", selectedCompany.id).eq("code", v.code).maybeSingle();

        if (existing) {
          if (updateExisting) {
            const { error } = await supabase.from("article_variants")
              .update({ description: v.description, length_value: v.length_value })
              .eq("id", existing.id);
            if (error) throw error;
            res.success++;
          } else {
            res.skipped++;
          }
        } else {
          const { error } = await supabase.from("article_variants")
            .insert({ code: v.code, description: v.description, length_value: v.length_value, company_id: selectedCompany.id });
          if (error) throw error;
          res.success++;
        }
      } catch (err: any) {
        res.failed++;
        res.errors.push({ row: i + 2, code: v.code, error: err.message });
      }
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setResult(res);
    setStep("complete");
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["article-variants"] });
    if (res.success > 0) toast.success(`Uspešno uvezeno ${res.success} varijanti`);
    if (res.failed > 0) toast.error(`Neuspešno: ${res.failed} varijanti`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Uvoz varijanti artikala iz Excel-a
          </DialogTitle>
          <DialogDescription>
            Učitajte Excel fajl sa šiframa varijanti, mapairajte kolone i uvezite
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium">Izaberite Excel fajl</p>
                <p className="text-sm text-muted-foreground mt-1">Podržani formati: .xlsx, .xls</p>
              </div>
              <label className="cursor-pointer">
                <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
                <div className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium">
                  Izaberite fajl
                </div>
              </label>
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Pronađeno <strong>{excelHeaders.length}</strong> kolona i <strong>{rawRows.length}</strong> redova.
                Mapirajte kolone iz fajla na polja varijanti.
              </div>

              <div className="space-y-3">
                {MAPPABLE_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-3">
                    <div className="w-40 text-sm font-medium flex items-center gap-1">
                      {field.label}
                      {field.required && <span className="text-destructive">*</span>}
                    </div>
                    <Select
                      value={fieldToExcelCol[field.key] || "__none__"}
                      onValueChange={(v) => updateFieldMapping(field.key, v === "__none__" ? null : v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="— Nije mapirano —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Nije mapirano —</SelectItem>
                        {excelHeaders.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Checkbox id="update-existing" checked={updateExisting} onCheckedChange={(c) => setUpdateExisting(!!c)} />
                <Label htmlFor="update-existing" className="text-sm">Ažuriraj postojeće varijante (po šifri)</Label>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("upload")}>Nazad</Button>
                <Button onClick={applyMappingAndContinue}>Nastavi na pregled</Button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{parsedData.length} varijanti</Badge>
                spremno za uvoz
              </div>
              <ScrollArea className="h-64 border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Šifra</th>
                      <th className="text-left p-2">Opis</th>
                      <th className="text-right p-2">Dužina</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 100).map((v, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2 font-medium">{v.code}</td>
                        <td className="p-2">{v.description}</td>
                        <td className="p-2 text-right">{v.length_value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
              {parsedData.length > 100 && (
                <p className="text-xs text-muted-foreground">Prikazano prvih 100 od {parsedData.length}</p>
              )}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("mapping")}>Nazad</Button>
                <Button onClick={handleImport}>Pokreni uvoz</Button>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="py-12 space-y-4">
              <div className="text-center text-lg font-medium">Uvoz u toku...</div>
              <Progress value={progress} className="w-full" />
              <div className="text-center text-sm text-muted-foreground">{progress}%</div>
            </div>
          )}

          {step === "complete" && result && (
            <div className="py-8 space-y-4">
              <div className="flex items-center justify-center gap-2 text-lg font-medium">
                {result.failed === 0 ? (
                  <><CheckCircle2 className="w-6 h-6 text-green-500" /> Uvoz završen</>
                ) : (
                  <><AlertCircle className="w-6 h-6 text-yellow-500" /> Uvoz završen sa greškama</>
                )}
              </div>
              <div className="flex justify-center gap-4">
                <Badge variant="default">{result.success} uspešno</Badge>
                {result.skipped > 0 && <Badge variant="secondary">{result.skipped} preskočeno</Badge>}
                {result.failed > 0 && <Badge variant="destructive">{result.failed} neuspešno</Badge>}
              </div>
              {result.errors.length > 0 && (
                <ScrollArea className="h-40 border rounded-md p-2">
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-sm text-destructive">Red {e.row} ({e.code}): {e.error}</div>
                  ))}
                </ScrollArea>
              )}
              <div className="flex justify-center pt-4">
                <Button onClick={handleClose}>Zatvori</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
