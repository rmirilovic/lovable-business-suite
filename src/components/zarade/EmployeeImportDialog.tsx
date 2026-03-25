import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useEmployees } from "@/hooks/useEmployees";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface EmployeeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REQUIRED_FIELDS = ["employee_number", "last_name", "first_name"];
const OPTIONAL_FIELDS = [
  "middle_name", "jmbg", "date_of_birth", "gender", "address", "city", "postal_code",
  "phone", "email", "education_level", "job_title",
  "employment_date", "employment_type", "contract_end_date",
  "work_experience_years", "work_experience_months",
  "bank_account", "note",
];

const FIELD_LABELS: Record<string, string> = {
  employee_number: "Šifra",
  last_name: "Prezime",
  first_name: "Ime",
  middle_name: "Srednje slovo",
  jmbg: "JMBG",
  date_of_birth: "Datum rođenja",
  gender: "Pol",
  address: "Adresa",
  city: "Grad",
  postal_code: "Poštanski broj",
  phone: "Telefon",
  email: "Email",
  education_level: "Stručna sprema",
  job_title: "Radno mesto",
  employment_date: "Datum zaposlenja",
  employment_type: "Vrsta ugovora",
  contract_end_date: "Datum isteka ugovora",
  work_experience_years: "Staž (godine)",
  work_experience_months: "Staž (meseci)",
  bank_account: "Tekući račun",
  note: "Napomena",
};

const SYNONYMS: Record<string, string[]> = {
  employee_number: ["šifra", "sifra", "broj", "code", "rb", "r.b."],
  last_name: ["prezime", "last name", "surname"],
  first_name: ["ime", "first name", "name"],
  middle_name: ["srednje", "middle", "sr. slovo", "ss"],
  jmbg: ["jmbg", "matični broj", "maticni"],
  date_of_birth: ["datum rođenja", "datum rodjenja", "rođen", "rodjen", "birth"],
  gender: ["pol", "gender", "sex"],
  address: ["adresa", "address", "ulica"],
  city: ["grad", "mesto", "city", "place"],
  postal_code: ["poštanski", "postanski", "zip", "postal"],
  phone: ["telefon", "phone", "tel", "mob"],
  email: ["email", "e-mail", "mail"],
  education_level: ["sprema", "obrazovanje", "kvalifikacija", "education"],
  job_title: ["radno mesto", "pozicija", "position", "job", "zanimanje"],
  employment_date: ["datum zaposlenja", "zaposlen", "employment date", "početak"],
  employment_type: ["vrsta ugovora", "tip", "ugovor", "contract type"],
  contract_end_date: ["istek", "kraj ugovora", "contract end"],
  work_experience_years: ["staž god", "staz god", "experience year"],
  work_experience_months: ["staž mes", "staz mes", "experience month"],
  bank_account: ["tekući", "tekuci", "račun", "racun", "bank", "account"],
  note: ["napomena", "note", "komentar", "opis"],
};

function parseExcelDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const str = String(val).trim();
  // dd.MM.yyyy
  const match = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  // yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return null;
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  "neodređeno": "neodredjeno",
  "neodredjeno": "neodredjeno",
  "određeno": "odredjeno",
  "odredjeno": "odredjeno",
  "probni": "probni",
  "probni rad": "probni",
  "privremeni": "privremeni",
};

export function EmployeeImportDialog({ open, onOpenChange }: EmployeeImportDialogProps) {
  const { selectedCompany, user } = useAuth();
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

        const autoMapping: Record<string, string> = {};
        [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].forEach((field) => {
          const synonymList = SYNONYMS[field] || [field];
          const matchedHeader = fileHeaders.find((h) =>
            synonymList.some((syn) => h.toLowerCase().includes(syn.toLowerCase()))
          );
          if (matchedHeader) autoMapping[field] = matchedHeader;
        });
        setMapping(autoMapping);
      } catch {
        toast.error("Greška pri čitanju fajla");
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleImport = async () => {
    if (!mapping.employee_number || !mapping.last_name || !mapping.first_name) {
      toast.error("Morate mapirati obavezna polja: Šifra, Prezime i Ime");
      return;
    }
    if (!selectedCompany?.id || !user?.id) return;

    try {
      setImporting(true);

      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        const existingMap = new Map(existingEmployees.map(emp => [emp.employee_number, emp]));

        let createdCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        for (const row of jsonData) {
          const employee_number = String(row[mapping.employee_number] || "").trim();
          const last_name = String(row[mapping.last_name] || "").trim();
          const first_name = String(row[mapping.first_name] || "").trim();

          if (!employee_number || !last_name || !first_name) continue;

          const empTypeRaw = mapping.employment_type ? String(row[mapping.employment_type] || "").trim().toLowerCase() : "";
          const employment_type = EMPLOYMENT_TYPE_MAP[empTypeRaw] || "neodredjeno";

          const empData: Record<string, unknown> = {
            employee_number,
            last_name,
            first_name,
            company_id: selectedCompany.id,
            created_by: user.id,
            employment_type,
            work_experience_years: mapping.work_experience_years ? Number(row[mapping.work_experience_years]) || 0 : 0,
            work_experience_months: mapping.work_experience_months ? Number(row[mapping.work_experience_months]) || 0 : 0,
            is_active: true,
            status: "active",
          };

          // Optional string fields
          for (const f of ["middle_name", "jmbg", "gender", "address", "city", "postal_code", "phone", "email", "education_level", "job_title", "bank_account", "note"]) {
            if (mapping[f]) {
              const val = String(row[mapping[f]] || "").trim();
              empData[f] = val || null;
            }
          }

          // Date fields
          for (const f of ["date_of_birth", "employment_date", "contract_end_date"]) {
            if (mapping[f]) {
              empData[f] = parseExcelDate(row[mapping[f]]);
            }
          }

          const existing = existingMap.get(employee_number);

          try {
            if (existing && updateExisting) {
              const { company_id, created_by, ...updates } = empData;
              const { error } = await supabase.from("employees").update(updates).eq("id", (existing as any).id);
              if (error) throw error;
              updatedCount++;
            } else if (!existing) {
              const { error } = await supabase.from("employees").insert(empData);
              if (error) throw error;
              createdCount++;
            }
          } catch (error) {
            errorCount++;
            console.warn(`Greška za zaposlenog ${employee_number}:`, error);
          }
        }

        const messages: string[] = [];
        if (createdCount > 0) messages.push(`kreirano ${createdCount}`);
        if (updatedCount > 0) messages.push(`ažurirano ${updatedCount}`);
        if (errorCount > 0) messages.push(`${errorCount} grešaka`);

        toast.success(`Uvoz završen: ${messages.join(", ")}`);
        queryClient.invalidateQueries({ queryKey: ["employees"] });
        onOpenChange(false);
        resetState();
        setImporting(false);
      };

      reader.readAsArrayBuffer(file!);
    } catch {
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
          <DialogTitle>Uvoz zaposlenih iz Excel-a</DialogTitle>
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
                    <Label className="w-36 text-sm shrink-0">
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

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="updateExistingEmp"
                  checked={updateExisting}
                  onCheckedChange={(checked) => setUpdateExisting(checked === true)}
                />
                <Label htmlFor="updateExistingEmp" className="text-sm cursor-pointer">
                  Ažuriraj postojeće zaposlene prema šifri
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
            disabled={importing || !file || !mapping.employee_number || !mapping.last_name || !mapping.first_name}
          >
            <Upload className="w-4 h-4 mr-2" />
            {importing ? "Uvoz..." : "Uvezi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
