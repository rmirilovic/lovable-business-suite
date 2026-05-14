import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useProductionLines, ProductionLine } from "@/hooks/useProductionLines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, History, FileSpreadsheet, FileText, Printer, Factory } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { ProductionLineHistoryDialog } from "@/components/sifarnici/ProductionLineHistoryDialog";
import {
  exportProductionLinesToExcel,
  exportProductionLinesToPdf,
  printProductionLines,
} from "@/lib/productionLinesExportUtils";
import { toast } from "sonner";

const PRODUCTION_TYPES = ["Sopstvena", "Usluzna", "Lon", "Prerada", "Mesovita"];

interface FormState {
  id?: string;
  code: string;
  name: string;
  production_type: string;
  is_active: boolean;
}

const emptyForm: FormState = { code: "", name: "", production_type: PRODUCTION_TYPES[0], is_active: true };

export default function ProizvodneLinije() {
  const { selectedCompany } = useAuth();
  const { data: lines = [], isLoading, upsert, remove } = useProductionLines();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<ProductionLine | null>(null);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("code", "asc");

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return lines.filter((l) =>
      !s ||
      String(l.code).includes(s) ||
      l.name.toLowerCase().includes(s) ||
      l.production_type.toLowerCase().includes(s)
    );
  }, [lines, search]);

  const sorted = useMemo(() =>
    sortItems(filtered, (item, col) => {
      switch (col) {
        case "code": return item.code;
        case "name": return item.name;
        case "production_type": return item.production_type;
        case "is_active": return item.is_active;
        default: return null;
      }
    })
  , [filtered, sortItems]);

  const openAdd = () => { setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (l: ProductionLine) => {
    setForm({ id: l.id, code: String(l.code), name: l.name, production_type: l.production_type, is_active: l.is_active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const code = parseInt(form.code, 10);
    if (!Number.isInteger(code) || code < 1 || code > 99) {
      toast.error("Šifra mora biti broj između 1 i 99");
      return;
    }
    if (!form.name.trim()) { toast.error("Naziv je obavezan"); return; }
    if (!form.production_type.trim()) { toast.error("Vrsta proizvodnje je obavezna"); return; }

    await upsert.mutateAsync({
      id: form.id,
      code,
      name: form.name.trim(),
      production_type: form.production_type.trim(),
      is_active: form.is_active,
    });
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const openHistory = (l: ProductionLine) => { setHistoryTarget(l); setHistoryOpen(true); };

  const meta = { companyName: selectedCompany?.name ?? "" };

  return (
    <MainLayout title="Proizvodne linije">
      <div className="flex flex-col flex-1 min-h-0 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Factory className="h-8 w-8" />
              Proizvodne linije
            </h1>
            <p className="text-muted-foreground">Šifarnik proizvodnih linija</p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" /> Nova linija
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Pretraga..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => exportProductionLinesToExcel(sorted)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportProductionLinesToPdf(sorted, meta)}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => printProductionLines(sorted, meta)}>
            <Printer className="h-4 w-4 mr-2" /> Štampa
          </Button>
        </div>

        <div className="border rounded-lg flex-1 min-h-0 flex flex-col">
          <TableScrollContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">
                    <SortableHeader column="code" label="Šifra" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="name" label="Naziv linije" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="w-[220px]">
                    <SortableHeader column="production_type" label="Vrsta proizvodnje" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="w-[120px] text-center">
                    <SortableHeader column="is_active" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-center" />
                  </TableHead>
                  <TableHead className="w-[140px] text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell></TableRow>
                ) : sorted.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nema podataka.</TableCell></TableRow>
                ) : sorted.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.code}</TableCell>
                    <TableCell>{l.name}</TableCell>
                    <TableCell>{l.production_type}</TableCell>
                    <TableCell className="text-center">
                      {l.is_active ? <span className="text-green-600">Aktivna</span> : <span className="text-muted-foreground">Neaktivna</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openHistory(l)} title="Istorija">
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(l)} title="Izmeni">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(l.id)} title="Obriši">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScrollContainer>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Izmena proizvodne linije" : "Nova proizvodna linija"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Šifra (1-99)</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Naziv linije</Label>
              <Input
                maxLength={63}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vrsta proizvodnje</Label>
              <Select value={form.production_type} onValueChange={(v) => setForm({ ...form, production_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRODUCTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Aktivna</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>Sačuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje proizvodne linije</AlertDialogTitle>
            <AlertDialogDescription>Da li ste sigurni? Ova akcija se ne može opozvati.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Obriši</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProductionLineHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        productionLineId={historyTarget?.id ?? null}
        lineLabel={historyTarget ? `${historyTarget.code} — ${historyTarget.name}` : ""}
      />
    </MainLayout>
  );
}
