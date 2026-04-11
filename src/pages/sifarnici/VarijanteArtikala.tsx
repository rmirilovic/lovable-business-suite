import { useState, useMemo, useRef, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Plus, Edit2, Trash2, RefreshCw, Search, Loader2, Ruler } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { useArticleVariants, ArticleVariant } from "@/hooks/useArticleVariants";
import { usePermissions } from "@/hooks/usePermissions";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";

interface VariantForm {
  code: string;
  length_value: string;
  description: string;
}

const emptyForm: VariantForm = { code: "", length_value: "0", description: "" };

export default function VarijanteArtikala() {
  const { selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("sifarnici.atributi", "write");

  const { variants, isLoading, isFetching, refetch, createVariant, updateVariant, deleteVariant } =
    useArticleVariants(selectedCompany?.id);

  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ArticleVariant | null>(null);
  const [deletingVariant, setDeletingVariant] = useState<ArticleVariant | null>(null);
  const [formData, setFormData] = useState<VariantForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("code", "asc");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!searchTerm) return variants;
    const q = searchTerm.toLowerCase();
    return variants.filter(
      (v) => v.code.toLowerCase().includes(q) || v.description.toLowerCase().includes(q)
    );
  }, [variants, searchTerm]);

  const sorted = useMemo(() => {
    return sortItems(filtered, (item, col) => {
      switch (col) {
        case "code": return item.code;
        case "length_value": return item.length_value;
        case "description": return item.description;
        default: return null;
      }
    });
  }, [filtered, sortItems]);

  const handleAdd = () => {
    setEditingVariant(null);
    setFormData(emptyForm);
    setIsFormOpen(true);
  };

  const handleEdit = (v: ArticleVariant) => {
    setEditingVariant(v);
    setFormData({ code: v.code, length_value: formatDecimal(v.length_value, 1), description: v.description });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.description.trim()) {
      toast.error("Šifra i opis su obavezni");
      return;
    }
    setSaving(true);
    try {
      const lengthVal = parseLocaleNumber(formData.length_value);
      if (editingVariant) {
        await updateVariant.mutateAsync({ id: editingVariant.id, code: formData.code.trim(), length_value: lengthVal, description: formData.description.trim() });
      } else {
        await createVariant.mutateAsync({ code: formData.code.trim(), length_value: lengthVal, description: formData.description.trim() });
      }
      setIsFormOpen(false);
    } catch { /* handled in hook */ } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingVariant) return;
    try {
      await deleteVariant.mutateAsync(deletingVariant.id);
      setIsDeleteOpen(false);
      setDeletingVariant(null);
    } catch { /* handled */ }
  };

  return (
    <MainLayout title="Varijante artikala">
      <div className="flex flex-col flex-1 min-h-0 space-y-6 animate-fade-in">
        <div className="sticky top-0 z-10 bg-background pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Ruler className="w-6 h-6" />
                Varijante artikala
              </h1>
              <p className="text-muted-foreground mt-1">Šifarnik varijanti (dužina šipki)</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Pretraži..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-64" autoComplete="off" />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Osveži</p></TooltipContent>
              </Tooltip>
              {canEdit && (
                <Button onClick={handleAdd} className="gap-2"><Plus className="w-4 h-4" />Nova varijanta</Button>
              )}
            </div>
          </div>
        </div>

        <div className="erp-card flex-1 min-h-0 flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{searchTerm ? "Nema rezultata" : "Nema varijanti"}</div>
          ) : (
            <TableScrollContainer ref={scrollRef}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32"><SortableHeader column="code" label="Šifra" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                    <TableHead className="w-32 text-right"><SortableHeader column="length_value" label="Dužina" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                    <TableHead><SortableHeader column="description" label="Opis" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                    {canEdit && <TableHead className="w-32 text-right">Akcije</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((v) => (
                    <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => canEdit && handleEdit(v)}>
                      <TableCell className="font-medium">{v.code}</TableCell>
                      <TableCell className="text-right">{formatDecimal(v.length_value, 1)}</TableCell>
                      <TableCell>{v.description}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(v); }}><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeletingVariant(v); setIsDeleteOpen(true); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScrollContainer>
          )}
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingVariant ? "Izmeni varijantu" : "Nova varijanta"}</DialogTitle>
              <DialogDescription>{editingVariant ? "Izmenite podatke o varijanti" : "Unesite podatke za novu varijantu"}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Šifra *</Label>
                <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="npr. 006" disabled={!!editingVariant} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label>Dužina (m)</Label>
                <LocaleNumberInput value={formData.length_value} onChange={(v) => setFormData({ ...formData, length_value: v })} decimals={1} className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Opis *</Label>
                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="npr. šipka 6 m" autoComplete="off" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>Otkaži</Button>
              <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Sačuvaj</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Brisanje varijante</AlertDialogTitle>
              <AlertDialogDescription>Da li ste sigurni da želite da obrišete varijantu "{deletingVariant?.code} - {deletingVariant?.description}"?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Otkaži</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Obriši</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
