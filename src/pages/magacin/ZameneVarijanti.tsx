import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Loader2, Trash2, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useVariantSwaps, VariantSwap } from "@/hooks/useVariantSwaps";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { format } from "date-fns";
import { formatDecimal } from "@/lib/formatting";
import { exportVariantSwapsToExcel, exportVariantSwapsToPdf, printVariantSwaps } from "@/lib/variantSwapListExportUtils";

export default function ZameneVarijanti() {
  const navigate = useNavigate();
  const { hasAccess } = usePermissions();
  const { selectedCompany } = useAuth();
  const canEdit = hasAccess("robno.prijemnice", "write");

  const { swaps, isLoading } = useVariantSwaps();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<VariantSwap | null>(null);
  const { deleteSwap } = useVariantSwaps();

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("swap_number", "desc");

  const filtered = useMemo(() => {
    if (!search) return swaps;
    const q = search.toLowerCase();
    return swaps.filter((s) =>
      s.swap_number.toLowerCase().includes(q) ||
      s.article?.code?.toLowerCase().includes(q) ||
      s.article?.name?.toLowerCase().includes(q)
    );
  }, [swaps, search]);

  const sorted = useMemo(() => {
    return sortItems(filtered, (item, col) => {
      switch (col) {
        case "swap_number": return item.swap_number;
        case "swap_date": return item.swap_date;
        case "article": return item.article?.code || "";
        case "warehouse": return item.warehouse?.code || "";
        case "quantity": return item.quantity;
        case "status": return item.status;
        default: return "";
      }
    });
  }, [filtered, sortItems]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteSwap.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <MainLayout title="Zamena varijante">
      <div className="flex flex-col h-full min-h-0 gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pretraži..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" autoComplete="off" />
          </div>
          {canEdit && (
            <Button onClick={() => navigate("/magacin/zamene-varijanti/new")} className="gap-2">
              <Plus className="w-4 h-4" />Nova zamena
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <TableScrollContainer className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]"><SortableHeader column="swap_number" label="Broj" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[100px]"><SortableHeader column="swap_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead><SortableHeader column="article" label="Artikal" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[140px]"><SortableHeader column="warehouse" label="Magacin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[120px]">Sa varijante</TableHead>
                  <TableHead className="w-[120px]">Na varijantu</TableHead>
                  <TableHead className="text-right w-[100px]"><SortableHeader column="quantity" label="Količina" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[80px]"><SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  {canEdit && <TableHead className="w-[60px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nema dokumenata.</TableCell></TableRow>
                ) : (
                  sorted.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/magacin/zamene-varijanti/${s.id}`)}>
                      <TableCell className="font-medium">{s.swap_number}</TableCell>
                      <TableCell>{s.swap_date ? format(new Date(s.swap_date), "dd.MM.yyyy") : ""}</TableCell>
                      <TableCell className="truncate">{s.article?.code} — {s.article?.name}</TableCell>
                      <TableCell>{s.warehouse?.code} — {s.warehouse?.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{s.source_variant?.code || "—"}</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{s.target_variant?.code || "—"}</Badge></TableCell>
                      <TableCell className="text-right">{formatDecimal(s.quantity)}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "posted" ? "default" : "outline"}>
                          {s.status === "posted" ? "Proknjižen" : "Priprema"}
                        </Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          {s.status === "draft" && (
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableScrollContainer>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje dokumenta</AlertDialogTitle>
            <AlertDialogDescription>Da li ste sigurni da želite da obrišete zamenu varijante {deleteTarget?.swap_number}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Obriši</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
