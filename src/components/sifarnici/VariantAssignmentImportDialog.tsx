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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  article_code: string;
  variant_code: string;
}

interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: { row: number; info: string; error: string }[];
}

const MAPPABLE_FIELDS: { key: keyof ParsedRow; label: string; required?: boolean }[] = [
  { key: "article_code", label: "Šifra artikla", required: true },
  { key: "variant_code", label: "Šifra varijante", required: true },
];

const removeDiacritics = (str: string): string =>
  str.replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "d");

const normalizeHeader = (input: string): string =>
  removeDiacritics(input.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ").trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim());

const COLUMN_SYNONYMS: Record<string, keyof ParsedRow> = {
  "sifra artikla": "article_code", "šifra artikla": "article_code", "article code": "article_code",
  "artikal": "article_code", "article": "article_code", "sifra": "article_code", "šifra": "article_code",
  "code": "article_code", "art code": "article_code", "art sifra": "article_code",
  "sifra varijante": "variant_code", "šifra varijante": "variant_code", "variant code": "variant_code",
  "varijanta": "variant_code", "variant": "variant_code", "var code": "variant_code",
  "var sifra": "variant_code", "var šifra": "variant_code",
};

const NORMALIZED_SYNONYMS: Record<string, keyof ParsedRow> = Object.fromEntries(
  Object.entries(COLUMN_SYNONYMS).map(([k, v]) => [normalizeHeader(k), v])
) as Record<string, keyof ParsedRow>;

export function VariantAssignmentImportDialog({ open, onOpenChange }: Props) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing" | "complete">("upload");
  const [skipExisting, setSkipExisting] = useState(true);

  const resetState = useCallback(() => {
    setFile(null); setParsedData([]); setColumnMapping({}); setRawRows([]);
    setExcelHeaders([]); setImporting(false); setProgress(0); setResult(null);
    setStep("upload"); setSkipExisting(true);
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

      // Auto-detect columns
      const detected: Record<string, string> = {};
      allHeaders.forEach(h => {
        const norm = normalizeHeader(h);
        const mapped = NORMALIZED_SYNONYMS[norm] ?? NORMALIZED_SYNONYMS[norm.replace(/\s/g, "")];
        if (mapped && !Object.values(detected).includes(mapped)) detected[h] = mapped;
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
    if (!vals.includes("article_code") || !vals.includes("variant_code")) {
      toast.error("Morate mapirati oba obavezna polja: Šifra artikla i Šifra varijante"); return;
    }
    const parsed: ParsedRow[] = rawRows.map(row => {
      const r: Partial<ParsedRow> = {};
      Object.entries(columnMapping).forEach(([col, field]) => {
        const raw = row[col];
        if (raw !== undefined && raw !== null && raw !== "") {
          (r as any)[field] = String(raw).trim();
        }
      });
      return r as ParsedRow;
    }).filter(r => r.article_code && r.variant_code);
    setParsedData(parsed);
    setStep("preview");
  };

  const handleImport = async () => {
    if (!selectedCompany) { toast.error("Nije izabrana firma"); return; }
    setImporting(true); setStep("importing"); setProgress(0);
    const res: ImportResult = { success: 0, failed: 0, skipped: 0, errors: [] };

    // Pre-fetch all articles and variants (paginated to handle >1000 rows)
    const fetchAll = async (table: string, fields: string) => {
      const all: any[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from(table).select(fields).eq("company_id", selectedCompany.id)
          .range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    };

    const [articles, variants] = await Promise.all([
      fetchAll("articles", "id, code"),
      fetchAll("article_variants", "id, code"),
    ]);

    const articleByCode = new Map(articles.map(a => [a.code, a.id]));
    const variantByCode = new Map(variants.map(v => [v.code, v.id]));

    const total = parsedData.length;
    const batchSize = 50;

    for (let i = 0; i < total; i += batchSize) {
      const batch = parsedData.slice(i, i + batchSize);
      const toInsert: { article_id: string; variant_id: string; company_id: string }[] = [];

      for (const row of batch) {
        const articleId = articleByCode.get(row.article_code);
        const variantId = variantByCode.get(row.variant_code);

        if (!articleId) {
          res.failed++;
          res.errors.push({ row: i + batch.indexOf(row) + 2, info: `${row.article_code} → ${row.variant_code}`, error: `Artikal "${row.article_code}" ne postoji` });
          continue;
        }
        if (!variantId) {
          res.failed++;
          res.errors.push({ row: i + batch.indexOf(row) + 2, info: `${row.article_code} → ${row.variant_code}`, error: `Varijanta "${row.variant_code}" ne postoji` });
          continue;
        }
        toInsert.push({ article_id: articleId, variant_id: variantId, company_id: selectedCompany.id });
      }

      if (toInsert.length > 0) {
        const { error, data: inserted } = await supabase
          .from("article_variant_assignments")
          .upsert(toInsert, { onConflict: "article_id,variant_id", ignoreDuplicates: skipExisting })
          .select("id");

        if (error) {
          // Fallback: insert one by one
          for (const row of toInsert) {
            try {
              const { error: e2 } = await supabase.from("article_variant_assignments").insert(row);
              if (e2) {
                if (e2.code === "23505") { res.skipped++; }
                else { res.failed++; res.errors.push({ row: 0, info: "", error: e2.message }); }
              } else {
                res.success++;
              }
            } catch (err: any) {
              res.failed++;
              res.errors.push({ row: 0, info: "", error: err.message });
            }
          }
        } else {
          const insertedCount = inserted?.length ?? toInsert.length;
          res.success += insertedCount;
          if (skipExisting) res.skipped += (toInsert.length - insertedCount);
        }
      }

      setProgress(Math.round(Math.min(i + batchSize, total) / total * 100));
    }

    setResult(res);
    setStep("complete");
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["all-variant-assignments"] });
    if (res.success > 0) toast.success(`Uspešno uvezeno ${res.success} veza`);
    if (res.failed > 0) toast.error(`Neuspešno: ${res.failed}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Uvoz povezivanja artikala i varijanti
          </DialogTitle>
          <DialogDescription>
            Učitajte Excel sa šiframa artikala i varijanti, mapirajte kolone i uvezite veze
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
                <p className="text-sm text-muted-foreground mt-1">Kolone: Šifra artikla, Šifra varijante</p>
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
                Mapirajte kolone iz fajla.
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
                <Checkbox id="skip-existing-assign" checked={skipExisting} onCheckedChange={(c) => setSkipExisting(!!c)} />
                <Label htmlFor="skip-existing-assign" className="text-sm">Preskoči već postojeće veze</Label>
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
                <Badge variant="secondary">{parsedData.length} veza</Badge>
                spremno za uvoz
              </div>
              <ScrollArea className="h-64 border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Šifra artikla</th>
                      <th className="text-left p-2">Šifra varijante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2 font-mono">{r.article_code}</td>
                        <td className="p-2 font-mono">{r.variant_code}</td>
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
                  <><CheckCircle2 className="w-6 h-6 text-primary" /> Uvoz završen</>
                ) : (
                  <><AlertCircle className="w-6 h-6 text-destructive" /> Uvoz završen sa greškama</>
                )}
              </div>
              <div className="flex justify-center gap-4">
                <Badge variant="default">{result.success} uspešno</Badge>
                {result.skipped > 0 && <Badge variant="secondary">{result.skipped} preskočeno</Badge>}
                {result.failed > 0 && <Badge variant="destructive">{result.failed} neuspešno</Badge>}
              </div>
              {result.errors.length > 0 && (
                <ScrollArea className="h-40 border rounded-md p-2">
                  {result.errors.slice(0, 50).map((e, i) => (
                    <div key={i} className="text-sm text-destructive">Red {e.row} ({e.info}): {e.error}</div>
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
