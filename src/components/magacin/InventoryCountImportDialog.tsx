import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, Save, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { InventoryCountItem } from "@/hooks/useInventoryCounts";
import { Article } from "@/hooks/useArticles";
import { formatDecimal } from "@/lib/formatting";

/* ── Helpers ── */

const removeDiacritics = (s: string) =>
  s.replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "d");

const normalizeHeader = (s: string) => {
  const cleaned = s.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ").trim().toLowerCase();
  const stripped = cleaned.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return removeDiacritics(stripped).replace(/\s+/g, " ").trim();
};

/* ── Column definitions ── */

type MappableField = "code" | "counted_quantity" | "book_quantity" | "surplus_qty" | "deficit_qty" | "price" | "surplus_value" | "deficit_value";

const MAPPABLE_FIELDS: { key: MappableField; label: string; required: boolean }[] = [
  { key: "code", label: "Šifra artikla", required: true },
  { key: "counted_quantity", label: "Popisana količina", required: false },
  { key: "book_quantity", label: "Knjižna količina", required: false },
  { key: "surplus_qty", label: "Višak", required: false },
  { key: "deficit_qty", label: "Manjak", required: false },
  { key: "price", label: "Cena", required: false },
  { key: "surplus_value", label: "Vrednost viška", required: false },
  { key: "deficit_value", label: "Vrednost manjka", required: false },
];

const COLUMN_SYNONYMS: Record<string, MappableField> = {
  // Code
  "sifra": "code", "šifra": "code", "code": "code", "sifra artikla": "code", "šifra artikla": "code",
  // Counted quantity
  "popisana": "counted_quantity", "popisana kolicina": "counted_quantity", "popisana količina": "counted_quantity",
  "kolicina": "counted_quantity", "količina": "counted_quantity", "qty": "counted_quantity", "counted": "counted_quantity",
  "counted quantity": "counted_quantity", "counted_quantity": "counted_quantity", "popisana kol": "counted_quantity",
  // Book quantity
  "knjizna kol": "book_quantity", "knjižna kol": "book_quantity", "knjizna kolicina": "book_quantity",
  "knjižna količina": "book_quantity", "book quantity": "book_quantity", "book_quantity": "book_quantity",
  "po knjigama": "book_quantity", "kol po knjigama": "book_quantity",
  // Surplus
  "visak": "surplus_qty", "višak": "surplus_qty", "surplus": "surplus_qty", "surplus_qty": "surplus_qty",
  // Deficit
  "manjak": "deficit_qty", "deficit": "deficit_qty", "deficit_qty": "deficit_qty",
  // Price
  "cena": "price", "price": "price", "jedinicna cena": "price", "jedinična cena": "price",
  // Surplus value
  "vr viska": "surplus_value", "vr viška": "surplus_value", "vrednost viska": "surplus_value",
  "vrednost viška": "surplus_value", "surplus_value": "surplus_value",
  // Deficit value
  "vr manjka": "deficit_value", "vrednost manjka": "deficit_value", "deficit_value": "deficit_value",
};

const NORMALIZED_SYNONYMS: Record<string, MappableField> = Object.fromEntries(
  Object.entries(COLUMN_SYNONYMS).map(([k, v]) => [normalizeHeader(k), v])
) as Record<string, MappableField>;

/* ── Templates ── */

interface MappingTemplate { name: string; mapping: Record<string, string> }

const TEMPLATES_KEY = "inventory-count-import-templates";
const loadTemplates = (): MappingTemplate[] => { try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]"); } catch { return []; } };
const saveTemplates = (t: MappingTemplate[]) => localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t));

/* ── Props ── */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countId: string;
  companyId: string;
  warehouseId: string;
  countDate: string;
  yearId: string;
  yearStart: string;
  warehouseType: string;
  items: InventoryCountItem[];
  articles: Article[];
}

function getAllowedSvkForWarehouseType(warehouseType: string): string[] {
  switch (warehouseType) {
    case "1": return ["1"];
    case "2": return ["2"];
    case "6": return ["6"];
    case "9": return ["9"];
    case "12": return ["1", "2"];
    default: return ["0", "1", "2", "6", "8", "9"];
  }
}

interface StockRow {
  article_id: string;
  balance_qty: number;
  balance_value: number;
}

export function InventoryCountImportDialog({ open, onOpenChange, countId, companyId, warehouseId, countDate, yearId, yearStart, warehouseType, items, articles }: Props) {
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing" | "complete">("upload");
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; skipped: number; svkSkipped: number } | null>(null);
  const [importStarted, setImportStarted] = useState(false);
  const [stockByArticleId, setStockByArticleId] = useState<Map<string, StockRow>>(new Map());

  // Templates
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  useEffect(() => { setTemplates(loadTemplates()); }, []);

  // Fetch warehouse stock when dialog opens
  useEffect(() => {
    if (!open || !companyId || !warehouseId || !countDate || !yearStart) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_warehouse_stock", {
          p_company_id: companyId,
          p_warehouse_id: warehouseId,
          p_date_from: yearStart,
          p_date_to: countDate,
        });
        if (error) throw error;
        const map = new Map<string, StockRow>();
        for (const row of (data || [])) {
          map.set(row.article_id, { article_id: row.article_id, balance_qty: row.balance_qty, balance_value: row.balance_value });
        }
        setStockByArticleId(map);
      } catch {
        // silently fail - stock lookup is optional
      }
    })();
  }, [open, companyId, warehouseId, countDate, yearStart]);

  const resetState = useCallback(() => {
    setStep("upload");
    setExcelHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setProgress(0);
    setImportResult(null);
    setNewTemplateName("");
    setShowSaveTemplate(false);
    setImportStarted(false);
  }, []);

  const handleClose = () => { resetState(); onOpenChange(false); };

  // Inverted mapping: field -> excelCol
  const fieldToExcelCol = useMemo(() => {
    const inv: Record<string, string> = {};
    Object.entries(columnMapping).forEach(([ec, f]) => { inv[f] = ec; });
    return inv;
  }, [columnMapping]);

  /* ── Step 1: Upload ── */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

      const headers: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
        if (cell) headers.push(String(cell.v).trim());
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      if (rows.length === 0) { toast.error("Excel fajl je prazan"); return; }

      const rowKeys = rows.reduce<string[]>((acc, r) => { Object.keys(r).forEach(k => { if (!acc.includes(k)) acc.push(k); }); return acc; }, []);
      rowKeys.forEach(k => { if (!headers.includes(k)) headers.push(k); });

      setExcelHeaders(headers);
      setRawRows(rows);

      // Auto-detect mapping
      const detected: Record<string, string> = {};
      headers.forEach(h => {
        const norm = normalizeHeader(h);
        const noSpace = norm.replace(/\s/g, "");
        const mapped = NORMALIZED_SYNONYMS[norm] ?? NORMALIZED_SYNONYMS[noSpace];
        if (mapped) detected[h] = mapped;
      });
      setColumnMapping(detected);
      setStep("mapping");
    } catch {
      toast.error("Greška pri čitanju Excel fajla");
    }
  };

  /* ── Step 2: Mapping ── */
  const updateFieldMapping = (field: string, excelCol: string | null) => {
    setColumnMapping(prev => {
      const nm = { ...prev };
      Object.keys(nm).forEach(k => { if (nm[k] === field) delete nm[k]; });
      if (excelCol) nm[excelCol] = field;
      return nm;
    });
  };

  // Preview data based on mapping
  const allowedSvk = useMemo(() => getAllowedSvkForWarehouseType(warehouseType), [warehouseType]);

  const previewRows = useMemo(() => {
    const codeCol = fieldToExcelCol["code"];
    if (!codeCol) return [];
    const articleByCode = new Map(articles.map(a => [a.code, a]));
    return rawRows.slice(0, 10).map(row => {
      const code = String(row[codeCol] || "").trim();
      const qtyCol = fieldToExcelCol["counted_quantity"];
      const priceCol = fieldToExcelCol["price"];
      const bookQtyCol = fieldToExcelCol["book_quantity"];
      const article = articleByCode.get(code);

      const svkMismatch = article ? !allowedSvk.includes(article.svk || "1") : false;

      const countedQty = qtyCol ? Number(row[qtyCol]) || 0 : 0;
      const excelPrice = priceCol ? Number(row[priceCol]) || undefined : undefined;

      let bookQty = bookQtyCol ? Number(row[bookQtyCol]) || 0 : 0;
      if (!bookQtyCol && article) {
        const stock = stockByArticleId.get(article.id);
        if (stock) bookQty = stock.balance_qty;
      }

      const diff = countedQty - bookQty;
      return {
        code,
        name: article?.name || "—",
        counted_quantity: countedQty,
        book_quantity: bookQty,
        surplus_qty: diff > 0 ? diff : 0,
        deficit_qty: diff < 0 ? -diff : 0,
        price: excelPrice,
        found: !!article,
        svkMismatch,
      };
    });
  }, [rawRows, fieldToExcelCol, articles, stockByArticleId, allowedSvk]);

  const handleContinueToPreview = () => {
    if (!Object.values(columnMapping).includes("code")) {
      toast.error("Morate mapirati obavezno polje: Šifra artikla");
      return;
    }
    setStep("preview");
  };

  /* ── Step 3: Import ── */

  const handleImport = async () => {
    if (importStarted) return; // Prevent double-import
    setImportStarted(true);
    setStep("importing");
    setProgress(0);

    try {
      const codeCol = fieldToExcelCol["code"];
      const qtyCol = fieldToExcelCol["counted_quantity"];
      const priceCol = fieldToExcelCol["price"];
      const bookQtyCol = fieldToExcelCol["book_quantity"];
      const surplusQtyCol = fieldToExcelCol["surplus_qty"];
      const deficitQtyCol = fieldToExcelCol["deficit_qty"];
      const surplusValueCol = fieldToExcelCol["surplus_value"];
      const deficitValueCol = fieldToExcelCol["deficit_value"];
      if (!codeCol) throw new Error("Šifra nije mapirana");

      const articleByCode = new Map(articles.map(a => [a.code, a]));
      const existingByArticleId = new Map(items.map(i => [i.article_id, i]));

      const newInserts: Omit<InventoryCountItem, "id" | "created_at">[] = [];
      const updates: { id: string; book_quantity?: number; counted_quantity: number; surplus_qty: number; deficit_qty: number; price?: number; surplus_value: number; deficit_value: number }[] = [];
      let skipped = 0;
      let svkSkipped = 0;
      let nextOrder = items.length > 0 ? Math.max(...items.map(i => i.item_order)) + 1 : 1;

      for (const row of rawRows) {
        const code = String(row[codeCol] || "").trim();
        if (!code) continue;

        const article = articleByCode.get(code);
        if (!article) { skipped++; continue; }

        // SVK check - skip articles that don't belong to this warehouse type
        if (!allowedSvk.includes(article.svk || "1")) { svkSkipped++; continue; }

        const countedQty = qtyCol ? Number(row[qtyCol]) || 0 : 0;
        const price = priceCol ? Number(row[priceCol]) || undefined : undefined;

        // Book quantity: from Excel column, or from warehouse stock, or 0
        let bookQty: number | undefined;
        if (bookQtyCol) {
          bookQty = Number(row[bookQtyCol]) || 0;
        } else {
          const stock = stockByArticleId.get(article.id);
          if (stock) bookQty = stock.balance_qty;
        }

        const existingItem = existingByArticleId.get(article.id);

        // Skip duplicates from within the Excel file (already queued for insert)
        if (existingItem && existingItem.id === "__pending__") {
          skipped++;
          continue;
        }

        if (existingItem) {
          const effectiveBookQty = bookQty ?? existingItem.book_quantity;
          const effectivePrice = price ?? existingItem.price;
          const diff = countedQty - effectiveBookQty;
          const surplusQty = surplusQtyCol ? (Number(row[surplusQtyCol]) || 0) : (diff > 0 ? diff : 0);
          const deficitQty = deficitQtyCol ? (Number(row[deficitQtyCol]) || 0) : (diff < 0 ? -diff : 0);
          const surplusValue = surplusValueCol ? (Number(row[surplusValueCol]) || 0) : Math.round(surplusQty * effectivePrice * 100) / 100;
          const deficitValue = deficitValueCol ? (Number(row[deficitValueCol]) || 0) : Math.round(deficitQty * effectivePrice * 100) / 100;

          updates.push({
            id: existingItem.id,
            ...(bookQty !== undefined ? { book_quantity: effectiveBookQty } : {}),
            counted_quantity: countedQty,
            ...(price !== undefined ? { price } : {}),
            surplus_qty: surplusQty,
            deficit_qty: deficitQty,
            surplus_value: surplusValue,
            deficit_value: deficitValue,
          });
        } else {
          const effectiveBookQty = bookQty ?? 0;
          const itemPrice = price ?? article.selling_price ?? article.purchase_price ?? 0;
          const diff = countedQty - effectiveBookQty;
          const surplusQty = surplusQtyCol ? (Number(row[surplusQtyCol]) || 0) : (diff > 0 ? diff : 0);
          const deficitQty = deficitQtyCol ? (Number(row[deficitQtyCol]) || 0) : (diff < 0 ? -diff : 0);
          const surplusValue = surplusValueCol ? (Number(row[surplusValueCol]) || 0) : Math.round(surplusQty * itemPrice * 100) / 100;
          const deficitValue = deficitValueCol ? (Number(row[deficitValueCol]) || 0) : Math.round(deficitQty * itemPrice * 100) / 100;

          newInserts.push({
            inventory_count_id: countId,
            company_id: companyId,
            article_id: article.id,
            item_order: nextOrder++,
            item_code: article.code,
            item_name: article.name,
            unit: article.unit,
            book_quantity: effectiveBookQty,
            counted_quantity: countedQty,
            surplus_qty: surplusQty,
            deficit_qty: deficitQty,
            price: itemPrice,
            surplus_value: surplusValue,
            deficit_value: deficitValue,
          });
          existingByArticleId.set(article.id, { id: "__pending__", article_id: article.id } as any);
        }
      }

      const total = newInserts.length + updates.length;
      let done = 0;

      // Batch insert (500)
      for (let i = 0; i < newInserts.length; i += 500) {
        const batch = newInserts.slice(i, i + 500);
        const { error } = await supabase.from("inventory_count_items").insert(batch);
        if (error) throw error;
        done += batch.length;
        setProgress(total > 0 ? Math.round((done / total) * 100) : 100);
      }

      // Batch update (100)
      for (let i = 0; i < updates.length; i += 100) {
        const batch = updates.slice(i, i + 100);
        await Promise.all(batch.map(u => {
          const { id, ...rest } = u;
          return supabase.from("inventory_count_items").update(rest).eq("id", id).then(({ error }) => { if (error) throw error; });
        }));
        done += batch.length;
        setProgress(total > 0 ? Math.round((done / total) * 100) : 100);
      }

      setImportResult({ inserted: newInserts.length, updated: updates.length, skipped, svkSkipped });
      setStep("complete");
    } catch (err: any) {
      toast.error(`Greška pri uvozu: ${err.message}`);
      setStep("preview");
    }
  };

  /* ── Template helpers ── */
  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) { toast.error("Unesite naziv šablona"); return; }
    const t: MappingTemplate = { name: newTemplateName.trim(), mapping: { ...columnMapping } };
    const updated = [...templates.filter(x => x.name !== t.name), t];
    setTemplates(updated); saveTemplates(updated);
    setNewTemplateName(""); setShowSaveTemplate(false);
    toast.success("Šablon sačuvan");
  };

  const handleLoadTemplate = (t: MappingTemplate) => {
    const applicable: Record<string, string> = {};
    Object.entries(t.mapping).forEach(([ec, f]) => { if (excelHeaders.includes(ec)) applicable[ec] = f; });
    setColumnMapping(applicable);
    toast.success(`Šablon "${t.name}" učitan`);
  };

  const handleDeleteTemplate = (name: string) => {
    const updated = templates.filter(t => t.name !== name);
    setTemplates(updated); saveTemplates(updated);
    toast.success("Šablon obrisan");
  };

  /* ── Render ── */

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Uvoz popisne liste iz Excela</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Izaberite Excel fajl sa popisnom listom"}
            {step === "mapping" && "Mapirajte kolone iz fajla na polja popisne liste"}
            {step === "preview" && "Pregled podataka pre uvoza"}
            {step === "importing" && "Uvoz u toku..."}
            {step === "complete" && "Uvoz završen"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <FileSpreadsheet className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Excel fajl treba da sadrži kolonu sa šifrom artikla.<br />
              Opciono: popisana količina, knjižna količina, višak, manjak, cena, vrednosti.<br />
              <span className="text-xs">Knjižna količina se automatski preuzima iz magacina ako nije u fajlu.</span>
            </p>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Izaberite fajl
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
              </label>
            </Button>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === "mapping" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Pronađeno <Badge variant="secondary">{rawRows.length}</Badge> redova i{" "}
              <Badge variant="secondary">{excelHeaders.length}</Badge> kolona
            </div>

            {/* Template management */}
            {templates.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Sačuvani šabloni:</p>
                <div className="flex flex-wrap gap-2">
                  {templates.map(t => (
                    <div key={t.name} className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleLoadTemplate(t)}>
                        <FolderOpen className="h-3 w-3 mr-1" />{t.name}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteTemplate(t.name)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mapping fields */}
            <div className="space-y-3">
              {MAPPABLE_FIELDS.map(({ key, label, required }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-44 text-sm font-medium">
                    {label}{required && <span className="text-destructive ml-1">*</span>}
                  </div>
                  <Select
                    value={fieldToExcelCol[key] || "__none__"}
                    onValueChange={(v) => updateFieldMapping(key, v === "__none__" ? null : v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Izaberite kolonu..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Nije mapirano —</SelectItem>
                      {excelHeaders.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldToExcelCol[key] && (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              💡 Ako ne mapirate „Knjižna količina", automatski se preuzima stanje iz magacina na dan popisa.
              Višak, manjak i vrednosti se preračunavaju ako nisu mapirane.
            </p>

            {/* Save template */}
            <div className="flex items-center gap-2 pt-2">
              {showSaveTemplate ? (
                <>
                  <Input
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Naziv šablona..."
                    className="flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveTemplate(); }}
                  />
                  <Button size="sm" onClick={handleSaveTemplate}>
                    <Save className="h-4 w-4 mr-1" />Sačuvaj
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowSaveTemplate(false)}>Otkaži</Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowSaveTemplate(true)}>
                  <Save className="h-4 w-4 mr-1" />Sačuvaj šablon
                </Button>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Otkaži</Button>
              <Button onClick={handleContinueToPreview}>Nastavi</Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Prikazano prvih {Math.min(10, previewRows.length)} od {rawRows.length} redova
            </p>
            <ScrollArea className="max-h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Šifra</TableHead>
                    <TableHead>Naziv</TableHead>
                    <TableHead className="text-right">Knjižna</TableHead>
                    <TableHead className="text-right">Popisana</TableHead>
                    <TableHead className="text-right">Višak</TableHead>
                    <TableHead className="text-right">Manjak</TableHead>
                    <TableHead className="text-right">Cena</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((r, i) => (
                    <TableRow key={i} className={r.svkMismatch ? "opacity-50" : ""}>
                      <TableCell>{r.code}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{r.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatDecimal(r.book_quantity, 3)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(r.counted_quantity, 3)}</TableCell>
                      <TableCell className="text-right">{r.surplus_qty > 0 ? <span className="text-green-600">{formatDecimal(r.surplus_qty, 3)}</span> : ""}</TableCell>
                      <TableCell className="text-right">{r.deficit_qty > 0 ? <span className="text-destructive">{formatDecimal(r.deficit_qty, 3)}</span> : ""}</TableCell>
                      <TableCell className="text-right">{r.price != null ? formatDecimal(r.price, 2) : "—"}</TableCell>
                      <TableCell>
                        {r.svkMismatch ? (
                          <Badge variant="outline" className="text-orange-600 border-orange-400">SVK</Badge>
                        ) : r.found ? (
                          <Badge variant="secondary" className="text-green-600">OK</Badge>
                        ) : (
                          <Badge variant="destructive">?</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("mapping")}>Nazad</Button>
              <Button onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" />Uvezi {rawRows.length} redova
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === "importing" && (
          <div className="py-8 space-y-4">
            <Progress value={progress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">Uvoz u toku... {progress}%</p>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === "complete" && importResult && (
          <div className="py-8 space-y-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <div className="space-y-1 text-sm">
              <p>Novih stavki: <strong>{importResult.inserted}</strong></p>
              <p>Ažuriranih: <strong>{importResult.updated}</strong></p>
              {importResult.svkSkipped > 0 && <p className="text-orange-600">Preskočeno (SVK): <strong>{importResult.svkSkipped}</strong></p>}
              <p>Preskočenih (nenađenih): <strong>{importResult.skipped}</strong></p>
            </div>
            <Button onClick={() => { handleClose(); window.location.reload(); }}>Zatvori</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
