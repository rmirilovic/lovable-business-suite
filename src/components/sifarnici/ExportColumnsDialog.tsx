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
import { Label } from "@/components/ui/label";
import { Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { formatPrice, formatDecimal } from "@/lib/formatting";

interface Article {
  id: string;
  code: string;
  name: string;
  article_group: string | null;
  unit: string;
  purchase_price: number;
  selling_price: number;
  stock: number;
  min_stock: number;
  is_active: boolean;
  svk: string | null;
  kg_po_jm: number | null;
  kol_mas: number | null;
}

interface ExportColumn {
  key: keyof Article;
  label: string;
  checked: boolean;
  format?: (value: any) => string | number;
}

interface ExportColumnsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articles: Article[];
  companyName?: string;
}

const defaultColumns: ExportColumn[] = [
  { key: "code", label: "Šifra", checked: true },
  { key: "name", label: "Naziv", checked: true },
  { key: "article_group", label: "Klasa", checked: true },
  { key: "svk", label: "SVK", checked: true },
  { key: "unit", label: "JM", checked: true },
  { key: "purchase_price", label: "Nabavna cena", checked: true, format: (v) => v ?? 0 },
  { key: "selling_price", label: "Prodajna cena", checked: true, format: (v) => v ?? 0 },
  { key: "stock", label: "Stanje", checked: false, format: (v) => v ?? 0 },
  { key: "min_stock", label: "Min. stanje", checked: false, format: (v) => v ?? 0 },
  { key: "kg_po_jm", label: "kg po JM", checked: false, format: (v) => v ?? 0 },
  { key: "kol_mas", label: "Kol. u masi", checked: false, format: (v) => v ?? 1 },
  { key: "is_active", label: "Status", checked: true, format: (v) => v ? "Aktivan" : "Neaktivan" },
];

export function ExportColumnsDialog({
  open,
  onOpenChange,
  articles,
  companyName,
}: ExportColumnsDialogProps) {
  const [columns, setColumns] = useState<ExportColumn[]>(defaultColumns);
  const [exporting, setExporting] = useState(false);

  const selectedCount = columns.filter((c) => c.checked).length;

  const toggleColumn = (key: keyof Article) => {
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
      // Prepare data
      const data = articles.map((article) => {
        const row: Record<string, any> = {};
        selectedColumns.forEach((col) => {
          const value = article[col.key];
          row[col.label] = col.format ? col.format(value) : (value ?? "");
        });
        return row;
      });

      // Create workbook
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Artikli");

      // Auto-size columns
      const colWidths = selectedColumns.map((col) => {
        const maxLength = Math.max(
          col.label.length,
          ...articles.map((a) => {
            const val = col.format ? col.format(a[col.key]) : a[col.key];
            return String(val ?? "").length;
          })
        );
        return { wch: Math.min(maxLength + 2, 50) };
      });
      worksheet["!cols"] = colWidths;

      // Generate filename
      const date = new Date().toISOString().split("T")[0];
      const filename = `artikli_${companyName ? companyName.replace(/[^a-zA-Z0-9]/g, "_") + "_" : ""}${date}.xlsx`;

      // Download
      XLSX.writeFile(workbook, filename);
      
      toast.success(`Izvezeno ${articles.length} artikala`);
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
          <DialogTitle>Izvoz artikala u Excel</DialogTitle>
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
              <div
                key={col.key}
                className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                onClick={() => toggleColumn(col.key)}
              >
                <Checkbox
                  id={`col-${col.key}`}
                  checked={col.checked}
                  onCheckedChange={() => {}}
                  onClick={(e) => e.stopPropagation()}
                />
                <Label
                  className="text-sm cursor-pointer flex-1"
                >
                  {col.label}
                </Label>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Biće izvezeno <span className="font-medium text-foreground">{articles.length}</span> artikala
              {articles.length > 0 && " (filtrirani podaci)"}
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
