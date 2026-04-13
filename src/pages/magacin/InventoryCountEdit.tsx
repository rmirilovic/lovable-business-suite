import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Pencil, BookCheck, FileDown, Printer, Undo2, ArrowLeft, RefreshCw, History, Search,
} from "lucide-react";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { InventoryCount, useInventoryCountItems, useInventoryCounts } from "@/hooks/useInventoryCounts";
import { InventoryCountItemsEditor } from "@/components/magacin/InventoryCountItemsEditor";
import { InventoryCountDialog } from "@/components/magacin/InventoryCountDialog";
import { formatDecimal } from "@/lib/formatting";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useDocumentLock } from "@/hooks/useDocumentLock";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportInventoryCountPdf, exportInventoryCountBlankPdf,
  printInventoryCount, printInventoryCountBlank,
  exportInventoryCountToExcel, exportInventoryCountBlankToExcel,
} from "@/lib/inventoryCountExportUtils";
import { FileSpreadsheet, MoreHorizontal } from "lucide-react";

const STORAGE_KEY = "popis_edit_view_state";

function loadViewState(id: string) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id === id ? parsed : null;
  } catch { return null; }
}

function saveViewState(id: string, state: { search: string; sortColumn: string | null; sortDirection: string }) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id, ...state }));
}

export default function InventoryCountEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("robno.prijemnice", "write");
  const canPost = hasAccess("robno.prijemnice", "admin");

  const saved = id ? loadViewState(id) : null;

  const [countDoc, setCountDoc] = useState<InventoryCount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [search, setSearch] = useState(saved?.search || "");

  const { items, isLoading: itemsLoading } = useInventoryCountItems(id || null);
  const { updateCount, postCount, unpostCount } = useInventoryCounts();

  const { sortColumn, sortDirection, handleSort, sortItems, setSort } = useTableSort(
    saved?.sortColumn || "item_code",
    (saved?.sortDirection as "asc" | "desc") || "asc"
  );

  const { checkLock, updateLockTimestamp } = useDocumentLock({
    tableName: "inventory_counts",
    documentId: id || null,
    initialUpdatedAt: countDoc?.updated_at || null,
    onConflict: () => fetchCount(),
  });

  // Persist state
  useEffect(() => {
    if (id) saveViewState(id, { search, sortColumn, sortDirection });
  }, [id, search, sortColumn, sortDirection]);

  const fetchCount = async () => {
    if (!id) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("inventory_counts")
      .select(`*, warehouse:warehouses(id, code, name, warehouse_type)`)
      .eq("id", id)
      .single();
    if (error) {
      toast.error("Greška pri učitavanju dokumenta");
      navigate("/magacin/popisi");
      return;
    }
    setCountDoc(data as InventoryCount);
    updateLockTimestamp(data.updated_at);
    setIsLoading(false);
  };

  useEffect(() => { fetchCount(); }, [id]);

  const handlePostConfirm = async () => {
    if (!countDoc) return;
    const ok = await checkLock();
    if (!ok) return;
    await postCount.mutateAsync(countDoc.id);
    setPostDialogOpen(false);
    fetchCount();
  };

  const handleUnpostConfirm = async () => {
    if (!countDoc) return;
    await unpostCount.mutateAsync(countDoc.id);
    setUnpostDialogOpen(false);
    fetchCount();
  };

  const handleEditSaved = async (data: any) => {
    if (!countDoc) return;
    await updateCount.mutateAsync({ id: countDoc.id, ...data });
    setEditDialogOpen(false);
    fetchCount();
  };

  const totals = items.reduce(
    (acc, item) => ({
      surplusValue: acc.surplusValue + item.surplus_value,
      deficitValue: acc.deficitValue + item.deficit_value,
    }),
    { surplusValue: 0, deficitValue: 0 }
  );

  const exportMeta = countDoc ? {
    countNumber: countDoc.count_number,
    warehouseName: `${countDoc.warehouse?.code} - ${countDoc.warehouse?.name}`,
    countDate: countDoc.count_date,
  } : { countNumber: "", warehouseName: "", countDate: "" };

  // Filtering and sorting for posted (read-only) view
  const getItemValue = useCallback((item: any, column: string) => {
    switch (column) {
      case "item_code": return item.item_code || "";
      case "item_name": return item.item_name;
      case "variant": return item.variant?.code || "";
      case "unit": return item.unit;
      case "book_quantity": return item.book_quantity;
      case "counted_quantity": return item.counted_quantity;
      case "surplus_qty": return item.surplus_qty;
      case "deficit_qty": return item.deficit_qty;
      case "price": return item.price;
      case "surplus_value": return item.surplus_value;
      case "deficit_value": return item.deficit_value;
      default: return "";
    }
  }, []);

  const filteredSortedItems = useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (i) =>
          (i.item_code || "").toLowerCase().includes(q) ||
          i.item_name.toLowerCase().includes(q) ||
          (i.variant?.code || "").toLowerCase().includes(q)
      );
    }
    return sortItems(result, getItemValue);
  }, [items, search, sortItems, getItemValue]);

  const filteredTotals = useMemo(() =>
    filteredSortedItems.reduce(
      (acc, item) => ({
        surplusValue: acc.surplusValue + item.surplus_value,
        deficitValue: acc.deficitValue + item.deficit_value,
      }),
      { surplusValue: 0, deficitValue: 0 }
    ), [filteredSortedItems]);

  if (isLoading || !selectedCompany || !selectedYear) {
    return (
      <MainLayout title="Učitavanje...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!countDoc) {
    return (
      <MainLayout title="Dokument nije pronađen">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Dokument nije pronađen.</p>
          <Button onClick={() => navigate("/magacin/popisi")}>
            <ArrowLeft className="w-4 h-4 mr-2" />Nazad na listu
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isDraft = countDoc.status === "draft";
  const isPosted = countDoc.status === "posted";

  return (
    <MainLayout title={`Popis: ${countDoc.count_number}`}>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/magacin/popisi")}>
              <ArrowLeft className="w-4 h-4 mr-2" />Nazad
            </Button>
            <h1 className="text-xl font-semibold">{countDoc.count_number}</h1>
            {isPosted ? (
              <Badge variant="default">Proknjiženo</Badge>
            ) : (
              <Badge variant="secondary">Nacrt</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchCount} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {items.length > 0 && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />Excel
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => exportInventoryCountToExcel(items, exportMeta, totals)}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />Excel (puni)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportInventoryCountBlankToExcel(items, exportMeta)}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />Excel (prazni za popis)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FileDown className="h-4 w-4 mr-2" />PDF
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => exportInventoryCountPdf(items, exportMeta, totals)}>
                      <FileDown className="h-4 w-4 mr-2" />PDF (puni)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportInventoryCountBlankPdf(items, exportMeta)}>
                      <FileDown className="h-4 w-4 mr-2" />PDF (prazni za popis)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Printer className="h-4 w-4 mr-2" />Štampa
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => printInventoryCount(items, exportMeta, totals)}>
                      <Printer className="h-4 w-4 mr-2" />Štampa (puni)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => printInventoryCountBlank(items, exportMeta)}>
                      <Printer className="h-4 w-4 mr-2" />Štampa (prazni za popis)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {isDraft && canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
              </Button>
            )}
            {isDraft && canPost && (
              <Button size="sm" onClick={() => setPostDialogOpen(true)}>
                <BookCheck className="h-4 w-4 mr-2" />Proknjiži
              </Button>
            )}
            {isPosted && canPost && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => setUnpostDialogOpen(true)}>
                <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm bg-muted/30 p-4 rounded-lg mb-4">
          <div>
            <div className="text-muted-foreground">Datum popisa</div>
            <div className="font-medium">{format(new Date(countDoc.count_date), "dd.MM.yyyy", { locale: sr })}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Magacin</div>
            <div className="font-medium">{countDoc.warehouse?.code} - {countDoc.warehouse?.name}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Razlika</div>
            <div className="font-medium">
              <span className="text-green-600">Višak: {formatDecimal(totals.surplusValue, 2)}</span>
              {" | "}
              <span className="text-destructive">Manjak: {formatDecimal(totals.deficitValue, 2)}</span>
            </div>
          </div>
        </div>

        {countDoc.note && (
          <div className="text-sm mb-4">
            <span className="text-muted-foreground">Napomena: </span>
            <span className="whitespace-pre-wrap">{countDoc.note}</span>
          </div>
        )}

        {/* Search bar */}
        <div className="flex items-center gap-2 mb-2">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po šifri/nazivu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        <Separator className="mb-2" />

        {itemsLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isDraft && canEdit ? (
          <InventoryCountItemsEditor
            countId={countDoc.id}
            warehouseId={countDoc.warehouse_id}
            countDate={countDoc.count_date}
            warehouseType={countDoc.warehouse?.warehouse_type || "1"}
            search={search}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onSave={() => setSort("item_code", "asc")}
          />
        ) : (
          <TableScrollContainer>
            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead className="w-12">#</TableHead>
                   <TableHead><SortableHeader column="item_code" label="Šifra" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                   <TableHead><SortableHeader column="item_name" label="Naziv" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                   <TableHead className="w-[130px]"><SortableHeader column="variant" label="Varijanta" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                   <TableHead><SortableHeader column="unit" label="JM" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                   <TableHead className="text-right"><SortableHeader column="book_quantity" label="Knjižna kol." sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                   <TableHead className="text-right"><SortableHeader column="counted_quantity" label="Popisana kol." sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                   <TableHead className="text-right"><SortableHeader column="surplus_qty" label="Višak" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                   <TableHead className="text-right"><SortableHeader column="deficit_qty" label="Manjak" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                   <TableHead className="text-right"><SortableHeader column="price" label="Cena" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                   <TableHead className="text-right"><SortableHeader column="surplus_value" label="Vr. viška" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                   <TableHead className="text-right"><SortableHeader column="deficit_value" label="Vr. manjka" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {filteredSortedItems.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                       {search ? "Nema rezultata pretrage" : "Nema stavki"}
                     </TableCell>
                   </TableRow>
                 ) : (
                   filteredSortedItems.map((item, i) => (
                     <TableRow key={item.id}>
                       <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                       <TableCell>{item.item_code || "-"}</TableCell>
                       <TableCell>{item.item_name}</TableCell>
                       <TableCell>
                         {item.variant ? (
                           <Badge variant="outline" className="text-xs">{item.variant.code}</Badge>
                         ) : (
                           <span className="text-muted-foreground text-xs">—</span>
                         )}
                       </TableCell>
                       <TableCell>{item.unit}</TableCell>
                       <TableCell className="text-right">{formatDecimal(item.book_quantity, 2)}</TableCell>
                       <TableCell className="text-right">{formatDecimal(item.counted_quantity, 2)}</TableCell>
                       <TableCell className="text-right">{item.surplus_qty > 0 ? <span className="text-green-600">{formatDecimal(item.surplus_qty, 2)}</span> : ""}</TableCell>
                       <TableCell className="text-right">{item.deficit_qty > 0 ? <span className="text-destructive">{formatDecimal(item.deficit_qty, 2)}</span> : ""}</TableCell>
                       <TableCell className="text-right">{formatDecimal(item.price, 2)}</TableCell>
                       <TableCell className="text-right">{item.surplus_value > 0 ? <span className="text-green-600">{formatDecimal(item.surplus_value, 2)}</span> : ""}</TableCell>
                       <TableCell className="text-right">{item.deficit_value > 0 ? <span className="text-destructive">{formatDecimal(item.deficit_value, 2)}</span> : ""}</TableCell>
                     </TableRow>
                   ))
                 )}
                 {filteredSortedItems.length > 0 && (
                   <TableRow className="bg-muted/50 font-medium">
                     <TableCell colSpan={10} className="text-right">Ukupno:</TableCell>
                     <TableCell className="text-right text-green-600">{formatDecimal(filteredTotals.surplusValue, 2)}</TableCell>
                     <TableCell className="text-right text-destructive">{formatDecimal(filteredTotals.deficitValue, 2)}</TableCell>
                   </TableRow>
                 )}
              </TableBody>
            </Table>
          </TableScrollContainer>
        )}
      </div>

      {countDoc && (
        <InventoryCountDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          count={countDoc}
          onSave={handleEditSaved}
        />
      )}

      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjižiti popis?</AlertDialogTitle>
            <AlertDialogDescription>
              Knjiženje popisa <strong>{countDoc.count_number}</strong> će kreirati nalog za knjiženje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={handlePostConfirm}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unpostDialogOpen} onOpenChange={setUnpostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništiti knjiženje?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje popisa <strong>{countDoc.count_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnpostConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Poništi knjiženje
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {countDoc && (
        <DocumentHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          documentId={countDoc.id}
          documentName={countDoc.count_number}
          documentType="inventory_count"
        />
      )}
    </MainLayout>
  );
}
