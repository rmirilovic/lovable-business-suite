import { useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface OrgUnitExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExportColumn {
  key: string;
  label: string;
  checked: boolean;
}

const defaultColumns: ExportColumn[] = [
  { key: "code", label: "Šifra", checked: true },
  { key: "name", label: "Naziv", checked: true },
  { key: "parent_code", label: "Nadšifra", checked: true },
  { key: "is_active", label: "Aktivno", checked: true },
];

export function OrgUnitExportDialog({ open, onOpenChange }: OrgUnitExportDialogProps) {
  const { selectedCompany } = useAuth();
  const { units } = useOrganizationalUnits(selectedCompany?.id);
  
  const [columns, setColumns] = useState(defaultColumns);
  const [exporting, setExporting] = useState(false);

  const toggleColumn = (key: string) => {
    setColumns(columns.map((col) =>
      col.key === key ? { ...col, checked: !col.checked } : col
    ));
  };

  const selectAll = () => {
    setColumns(columns.map((col) => ({ ...col, checked: true })));
  };

  const deselectAll = () => {
    setColumns(columns.map((col) => ({ ...col, checked: false })));
  };

  const handleExport = async () => {
    const selectedColumns = columns.filter((col) => col.checked);
    if (selectedColumns.length === 0) {
      toast.error("Izaberite barem jednu kolonu za izvoz");
      return;
    }

    setExporting(true);
    try {
      // Prepare data for export
      const exportData = units.map((unit) => {
        const row: Record<string, any> = {};
        selectedColumns.forEach((col) => {
          if (col.key === "is_active") {
            row[col.label] = unit[col.key as keyof typeof unit] ? "Da" : "Ne";
          } else {
            row[col.label] = unit[col.key as keyof typeof unit] ?? "";
          }
        });
        return row;
      });

      // Create workbook
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns
      const colWidths = selectedColumns.map((col) => ({
        wch: Math.max(
          col.label.length,
          ...exportData.map((row) => String(row[col.label] || "").length)
        ) + 2,
      }));
      worksheet["!cols"] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Organizacione jedinice");

      // Generate filename
      const date = new Date().toISOString().split("T")[0];
      const filename = `org-jedinice-${selectedCompany?.name || "export"}-${date}.xlsx`;

      // Download
      XLSX.writeFile(workbook, filename);
      toast.success(`Izvezeno ${units.length} organizacionih jedinica`);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Greška pri izvozu: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Izvoz organizacionih jedinica u Excel
          </DialogTitle>
          <DialogDescription>
            Izaberite kolone za izvoz ({units.length} jedinica)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Izaberi sve
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Poništi sve
            </Button>
          </div>

          <div className="space-y-2">
            {columns.map((col) => (
              <div key={col.key} className="flex items-center gap-2">
                <Checkbox
                  id={col.key}
                  checked={col.checked}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                <Label htmlFor={col.key} className="cursor-pointer">
                  {col.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Odustani
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || columns.every((col) => !col.checked)}
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Izvezi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
