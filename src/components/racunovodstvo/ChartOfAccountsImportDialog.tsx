import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useChartOfAccounts, AccountType } from "@/hooks/useChartOfAccounts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
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
  account_type: ["tip", "type", "vrsta", "tipkonta"],
  parent_code: ["nadšifra", "nadsifra", "parent", "nadređeni", "nadkonto"],
  level: ["nivo", "level"],
  is_active: ["aktivan", "active", "status"],
  is_posting_allowed: ["knjiženje", "posting", "analitički", "dozvoljenoknjizenje"],
  description: ["opis", "description", "napomena"],
};

// Map Serbian account type labels to English enum values
const ACCOUNT_TYPE_MAP: Record<string, AccountType> = {
  "aktiva": "asset",
  "pasiva": "liability",
  "kapital": "equity",
  "prihodi": "revenue",
  "rashodi": "expense",
  "asset": "asset",
  "liability": "liability",
  "equity": "equity",
  "revenue": "revenue",
  "expense": "expense",
};

export function ChartOfAccountsImportDialog({ open, onOpenChange }: ChartOfAccountsImportDialogProps) {
  const { data: existingAccounts = [] } = useChartOfAccounts();
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);

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

  const parseAccountType = (value: unknown): AccountType => {
    if (!value) return "asset";
    const normalized = String(value).toLowerCase().trim();
    return ACCOUNT_TYPE_MAP[normalized] || "asset";
  };

  const parseBoolean = (value: unknown, defaultValue: boolean): boolean => {
    if (value === undefined || value === null || value === "") return defaultValue;
    const str = String(value).toLowerCase().trim();
    if (str === "da" || str === "aktivan" || str === "true" || str === "1" || str === "yes") return true;
    if (str === "ne" || str === "neaktivan" || str === "false" || str === "0" || str === "no") return false;
    return defaultValue;
  };

  const handleImport = async () => {
    if (!mapping.code || !mapping.name) {
      toast.error("Morate mapirati obavezna polja: Šifra i Naziv");
      return;
    }

    if (!selectedCompany?.id) {
      toast.error("Nije izabrana firma");
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

        // Build lookup map for existing accounts
        const existingMap = new Map(existingAccounts.map(acc => [acc.code, acc]));

        const toCreate: any[] = [];
        const toUpdate: { id: string; data: any }[] = [];
        let skippedCount = 0;

        for (const row of sorted) {
          const code = String(row[mapping.code] || "").trim();
          const name = String(row[mapping.name] || "").trim();

          if (!code || !name) {
            skippedCount++;
            continue;
          }

          const accountData = {
            code,
            name,
            company_id: selectedCompany.id,
            account_type: parseAccountType(mapping.account_type ? row[mapping.account_type] : null),
            parent_code: mapping.parent_code ? String(row[mapping.parent_code] || "") || null : null,
            level: mapping.level ? Number(row[mapping.level]) || code.length : code.length,
            is_active: parseBoolean(mapping.is_active ? row[mapping.is_active] : null, true),
            is_posting_allowed: parseBoolean(mapping.is_posting_allowed ? row[mapping.is_posting_allowed] : null, code.length >= 3),
            description: mapping.description ? String(row[mapping.description] || "") || null : null,
          };

          const existing = existingMap.get(code);

          if (existing && updateExisting) {
            toUpdate.push({ id: existing.id, data: accountData });
          } else if (!existing) {
            toCreate.push(accountData);
          }
        }

        let createdCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        // Batch insert new records
        if (toCreate.length > 0) {
          const batchSize = 50;
          for (let i = 0; i < toCreate.length; i += batchSize) {
            const batch = toCreate.slice(i, i + batchSize);
            const { error } = await supabase.from("chart_of_accounts").insert(batch);
            if (error) {
              console.error("Insert error:", error);
              errorCount += batch.length;
            } else {
              createdCount += batch.length;
            }
          }
        }

        // Batch update existing records
        if (toUpdate.length > 0) {
          for (const { id, data } of toUpdate) {
            const { error } = await supabase
              .from("chart_of_accounts")
              .update(data)
              .eq("id", id);
            if (error) {
              console.error("Update error:", error);
              errorCount++;
            } else {
              updatedCount++;
            }
          }
        }

        // Invalidate query cache once at the end
        queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });

        const messages: string[] = [];
        if (createdCount > 0) messages.push(`kreirano ${createdCount}`);
        if (updatedCount > 0) messages.push(`ažurirano ${updatedCount}`);
        if (skippedCount > 0) messages.push(`preskočeno ${skippedCount}`);
        if (errorCount > 0) messages.push(`${errorCount} grešaka`);
        
        toast.success(`Uvoz završen: ${messages.join(", ")}`);
        onOpenChange(false);
        resetState();
        setImporting(false);
      };

      reader.readAsArrayBuffer(file!);
    } catch (error) {
      toast.error("Greška pri uvozu");
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
              
              {/* Update existing option */}
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="updateExisting"
                  checked={updateExisting}
                  onCheckedChange={(checked) => setUpdateExisting(checked === true)}
                />
                <Label htmlFor="updateExisting" className="text-sm cursor-pointer">
                  Ažuriraj postojeće konte prema šifri
                </Label>
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
