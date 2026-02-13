import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useInputCosts, useInputCostsMutations } from "@/hooks/useInputCosts";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface InputCostsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REQUIRED_FIELDS = ["code", "account_code", "name"];
const OPTIONAL_FIELDS = ["vat_rate", "is_vat_deductible", "is_active", "description"];

const FIELD_LABELS: Record<string, string> = {
  code: "Šifra troška",
  account_code: "Konto",
  name: "Naziv",
  vat_rate: "Stopa PDV-a",
  is_vat_deductible: "PDV odbitni",
  is_active: "Aktivan",
  description: "Opis",
};

const SYNONYMS: Record<string, string[]> = {
  code: ["šifra", "sifra", "code"],
  account_code: ["konto", "account", "račun"],
  name: ["naziv", "name", "opis"],
  vat_rate: ["pdv", "vat", "stopa", "poreska stopa"],
  is_vat_deductible: ["odbitni", "deductible", "pretporez"],
  is_active: ["aktivan", "active"],
  description: ["opis", "description", "napomena"],
};

export function InputCostsImportDialog({ open, onOpenChange }: InputCostsImportDialogProps) {
  const { bulkCreateInputCosts, updateInputCost } = useInputCostsMutations();
  const { data: existingCosts = [] } = useInputCosts();
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

        // Auto-map
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
    if (!mapping.code || !mapping.account_code || !mapping.name) {
      toast.error("Morate mapirati obavezna polja: Šifra, Konto i Naziv");
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

        // Build lookup map for existing costs
        const existingMap = new Map(existingCosts.map(cost => [cost.code, cost]));

        let createdCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        for (const row of jsonData) {
          const code = String(row[mapping.code] || "").trim();
          const account_code = String(row[mapping.account_code] || "").trim();
          const name = String(row[mapping.name] || "").trim();

          if (!code || !account_code || !name) continue;

          const costData = {
            code,
            account_code,
            name,
            vat_rate: mapping.vat_rate ? Number(row[mapping.vat_rate]) || 20 : 20,
            is_vat_deductible: mapping.is_vat_deductible
              ? String(row[mapping.is_vat_deductible]).toLowerCase() !== "ne"
              : true,
            is_active: mapping.is_active
              ? String(row[mapping.is_active]).toLowerCase() !== "ne"
              : true,
            description: mapping.description ? String(row[mapping.description] || "") || null : null,
            is_procurement_cost: false,
          };

          const existing = existingMap.get(code);

          try {
            if (existing && updateExisting) {
              await updateInputCost.mutateAsync({ id: existing.id, ...costData });
              updatedCount++;
            } else if (!existing) {
              await bulkCreateInputCosts.mutateAsync([costData]);
              createdCount++;
            }
          } catch (error) {
            errorCount++;
            console.warn(`Greška za trošak ${code}:`, error);
          }
        }

        const messages: string[] = [];
        if (createdCount > 0) messages.push(`kreirano ${createdCount}`);
        if (updatedCount > 0) messages.push(`ažurirano ${updatedCount}`);
        if (errorCount > 0) messages.push(`${errorCount} grešaka`);
        
        toast.success(`Uvoz završen: ${messages.join(", ")}`);
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
          <DialogTitle>Uvoz ulaznih troškova iz Excel-a</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

          {headers.length > 0 && (
            <div className="space-y-4">
              <Label>Mapiranje kolona</Label>
              <div className="grid grid-cols-2 gap-4">
                {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <Label className="w-32 text-sm">
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

              <div className="space-y-2">
                <Label>Pregled</Label>
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
                  Ažuriraj postojeće troškove prema šifri
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
            disabled={importing || !file || !mapping.code || !mapping.account_code || !mapping.name}
          >
            <Upload className="w-4 h-4 mr-2" />
            {importing ? "Uvoz..." : "Uvezi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
