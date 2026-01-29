import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useChartOfAccountsMutations } from "@/hooks/useChartOfAccounts";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ChartOfAccountsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REQUIRED_FIELDS = ["code", "name"];
const OPTIONAL_FIELDS = ["account_type", "parent_code", "level", "is_active", "is_posting_allowed", "description"];

const FIELD_LABELS: Record<string, string> = {
  code: "Šifra konta",
  name: "Naziv konta",
  account_type: "Tip konta",
  parent_code: "Nadređeni konto",
  level: "Nivo",
  is_active: "Aktivan",
  is_posting_allowed: "Dozvoljena knjiženja",
  description: "Opis",
};

const SYNONYMS: Record<string, string[]> = {
  code: ["šifra", "sifra", "konto", "code", "account_code"],
  name: ["naziv", "name", "opis konta", "naziv konta"],
  account_type: ["tip", "type", "vrsta"],
  parent_code: ["nadšifra", "nadsifra", "parent", "nadređeni"],
  level: ["nivo", "level"],
  is_active: ["aktivan", "active"],
  is_posting_allowed: ["knjiženje", "posting", "analitički"],
  description: ["opis", "description", "napomena"],
};

export function ChartOfAccountsImportDialog({ open, onOpenChange }: ChartOfAccountsImportDialogProps) {
  const { createAccount } = useChartOfAccountsMutations();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        if (jsonData.length === 0) {
          toast.error("Fajl je prazan");
          return;
        }

        const fileHeaders = Object.keys(jsonData[0]);
        setHeaders(fileHeaders);
        setPreviewData(jsonData.slice(0, 5));

        // Auto-map columns based on synonyms
        const autoMapping: Record<string, string> = {};
        [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].forEach((field) => {
          const synonymList = SYNONYMS[field] || [field];
          const matchedHeader = fileHeaders.find((h) =>
            synonymList.some((syn) => h.toLowerCase().includes(syn.toLowerCase()))
          );
          if (matchedHeader) {
            autoMapping[field] = matchedHeader;
          }
        });
        setMapping(autoMapping);
      } catch (error) {
        toast.error("Greška pri čitanju fajla");
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleImport = async () => {
    if (!mapping.code || !mapping.name) {
      toast.error("Morate mapirati obavezna polja: Šifra i Naziv");
      return;
    }

    try {
      setImporting(true);

      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        // Sort by code to ensure parents are created first
        const sorted = [...jsonData].sort((a, b) => {
          const codeA = String(a[mapping.code] || "");
          const codeB = String(b[mapping.code] || "");
          if (codeA.length !== codeB.length) return codeA.length - codeB.length;
          return codeA.localeCompare(codeB);
        });

        let successCount = 0;
        let errorCount = 0;

        for (const row of sorted) {
          const code = String(row[mapping.code] || "").trim();
          const name = String(row[mapping.name] || "").trim();

          if (!code || !name) continue;

          try {
            await createAccount.mutateAsync({
              code,
              name,
              account_type: mapping.account_type ? String(row[mapping.account_type] || "asset") as any : "asset",
              parent_code: mapping.parent_code ? String(row[mapping.parent_code] || "") || null : null,
              level: mapping.level ? Number(row[mapping.level]) || code.length : code.length,
              is_active: mapping.is_active ? String(row[mapping.is_active]).toLowerCase() !== "ne" : true,
              is_posting_allowed: mapping.is_posting_allowed ? String(row[mapping.is_posting_allowed]).toLowerCase() !== "ne" : code.length >= 4,
              description: mapping.description ? String(row[mapping.description] || "") || null : null,
            });
            successCount++;
          } catch (error) {
            errorCount++;
            console.warn(`Greška za konto ${code}:`, error);
          }
        }

        toast.success(`Uvezeno ${successCount} konta${errorCount > 0 ? `, ${errorCount} preskočeno` : ""}`);
        onOpenChange(false);
        resetState();
      };

      reader.readAsArrayBuffer(file!);
    } catch (error) {
      toast.error("Greška pri uvozu");
    } finally {
      setImporting(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setHeaders([]);
    setMapping({});
    setPreviewData([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetState(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Uvoz kontnog plana iz Excel-a</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File selection */}
          <div className="space-y-2">
            <Label>Excel fajl</Label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {file ? file.name : "Izaberite fajl"}
              </Button>
            </div>
          </div>

          {/* Column mapping */}
          {headers.length > 0 && (
            <div className="space-y-4">
              <Label>Mapiranje kolona</Label>
              <div className="grid grid-cols-2 gap-4">
                {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <Label className="w-40 text-sm">
                      {FIELD_LABELS[field]}
                      {REQUIRED_FIELDS.includes(field) && <span className="text-destructive">*</span>}
                    </Label>
                    <Select
                      value={mapping[field] || "none"}
                      onValueChange={(v) => setMapping({ ...mapping, [field]: v === "none" ? "" : v })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Izaberite kolonu" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Ne mapirati --</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Pregled prvih redova</Label>
                <div className="border rounded-lg overflow-auto max-h-40 text-xs">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        {headers.slice(0, 6).map((h) => (
                          <th key={h} className="p-2 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i} className="border-t">
                          {headers.slice(0, 6).map((h) => (
                            <td key={h} className="p-2">{String(row[h] || "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || !file || !mapping.code || !mapping.name}
          >
            <Upload className="w-4 h-4 mr-2" />
            {importing ? "Uvoz..." : "Uvezi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
