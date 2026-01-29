import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useInputCosts } from "@/hooks/useInputCosts";
import { useAuth } from "@/contexts/AuthContext";

interface ExportColumn {
  key: string;
  label: string;
  checked: boolean;
  format?: (value: any) => string | number;
}

interface InputCostsExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultColumns: ExportColumn[] = [
  { key: "code", label: "Šifra", checked: true },
  { key: "name", label: "Naziv", checked: true },
  { key: "account_code", label: "Konto", checked: true },
  { key: "vat_rate", label: "Stopa PDV-a (%)", checked: true, format: (v) => v ?? 20 },
  { key: "is_vat_deductible", label: "Odbitni PDV", checked: true, format: (v) => v ? "Da" : "Ne" },
  { key: "is_active", label: "Status", checked: true, format: (v) => v ? "Aktivan" : "Neaktivan" },
  { key: "description", label: "Opis", checked: false },
];

export function InputCostsExportDialog({
  open,
  onOpenChange,
}: InputCostsExportDialogProps) {
  const { selectedCompany } = useAuth();
  const { data: inputCosts = [] } = useInputCosts();
  const [columns, setColumns] = useState<ExportColumn[]>(defaultColumns);
  const [exporting, setExporting] = useState(false);

  const selectedCount = columns.filter((c) => c.checked).length;

  const toggleColumn = (key: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.key === key ? { ...col, checked: !col.checked } : col
      )
    );
  };

  const selectAll = () => {
    setColumns((prev) => prev.map((col) => ({ ...col, checked: true })));
  };

  const deselectAll = () => {
    setColumns((prev) => prev.map((col) => ({ ...col, checked: false })));
  };

  const handleExport = async () => {
    const selectedColumns = columns.filter((c) => c.checked);
    
    if (selectedColumns.length === 0) {
      toast.error("Izaberite bar jednu kolonu za izvoz");
      return;
    }

    setExporting(true);

    try {
      const data = inputCosts.map((cost) => {
        const row: Record<string, any> = {};
        selectedColumns.forEach((col) => {
          const value = (cost as any)[col.key];
          row[col.label] = col.format ? col.format(value) : (value ?? "");
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ulazni troškovi");

      const colWidths = selectedColumns.map((col) => {
        const maxLength = Math.max(
          col.label.length,
          ...inputCosts.map((c) => {
            const val = col.format ? col.format((c as any)[col.key]) : (c as any)[col.key];
            return String(val ?? "").length;
          })
        );
        return { wch: Math.min(maxLength + 2, 50) };
      });
      worksheet["!cols"] = colWidths;

      const date = new Date().toISOString().split("T")[0];
      const filename = `ulazni_troskovi_${selectedCompany?.name?.replace(/[^a-zA-Z0-9]/g, "_") || ""}${date}.xlsx`;

      XLSX.writeFile(workbook, filename);
      
      toast.success(`Izvezeno ${inputCosts.length} troškova`);
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Greška pri izvozu: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Izvoz ulaznih troškova u Excel</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Izaberite kolone za izvoz ({selectedCount} od {columns.length})
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Sve
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                Ništa
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
            {columns.map((col) => (
              <label
                key={col.key}
                htmlFor={`col-${col.key}`}
                className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  id={`col-${col.key}`}
                  checked={col.checked}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                <span className="text-sm flex-1">{col.label}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Biće izvezeno <span className="font-medium text-foreground">{inputCosts.length}</span> troškova
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button onClick={handleExport} disabled={exporting || selectedCount === 0}>
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Izvoz...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Izvezi u Excel
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
