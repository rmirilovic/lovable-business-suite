import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Search, Loader2, MoreHorizontal, Eye, BookCheck, Undo2, Trash2,
} from "lucide-react";
import { useArticleSwaps, ArticleSwap } from "@/hooks/useArticleSwaps";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { formatDecimal } from "@/lib/formatting";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";

const STATUS_OPTIONS = [
  { value: "all", label: "Svi statusi" },
  { value: "draft", label: "Nacrt" },
  { value: "posted", label: "Proknjiženo" },
];

export default function ZameneArtikala() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("robno.prijemnice", "write");
  const canPost = hasAccess("robno.prijemnice", "admin");

  const { swaps, isLoading, deleteSwap, postSwap, unpostSwap } = useArticleSwaps();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<ArticleSwap | null>(null);
  const [postConfirm, setPostConfirm] = useState<ArticleSwap | null>(null);
  const [unpostConfirm, setUnpostConfirm] = useState<ArticleSwap | null>(null);

  const filteredSwaps = useMemo(() => {
    return swaps.filter((s) => {
      const matchesSearch =
        s.swap_number.toLowerCase().includes(search.toLowerCase()) ||
        s.article_1_name.toLowerCase().includes(search.toLowerCase()) ||
        s.article_2_name.toLowerCase().includes(search.toLowerCase()) ||
        s.warehouse?.name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      const matchesDateFrom = !dateFrom || s.swap_date >= dateFrom;
      const matchesDateTo = !dateTo || s.swap_date <= dateTo;
      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [swaps, search, statusFilter]);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("swap_number", "desc");

  const sortedData = useMemo(() => {
    return sortItems(filteredSwaps, (item, column) => {
      switch (column) {
        case "swap_number": return item.swap_number;
        case "swap_date": return item.swap_date;
        case "warehouse": return item.warehouse?.name || "";
        case "article_1": return item.article_1_code;
        case "article_2": return item.article_2_code;
        case "swap_value": return item.swap_value;
        default: return "";
      }
    });
  }, [filteredSwaps, sortItems]);

  if (isLoading) {
    return (
      <MainLayout title="Zamena artikla po šifri">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Zamena artikla po šifri">
      <div className="flex-1 min-h-0 overflow-auto space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po broju, artiklu ili magacinu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              autoComplete="off"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label className="text-xs">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[170px]" />
          </div>
          {canEdit && (
            <Button onClick={() => navigate("/magacin/zamene/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Nova zamena
            </Button>
          )}
        </div>

        <TableScrollContainer>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader label="Broj" column="swap_number" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Datum" column="swap_date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Magacin" column="warehouse" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Artikal 1 (izlaz)" column="article_1" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Artikal 2 (ulaz)" column="article_2" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader label="Vrednost" column="swap_value" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-muted-foreground">
                      {swaps.length === 0
                        ? "Nema zamena. Kliknite 'Nova zamena' da kreirate prvu."
                        : "Nema rezultata za zadati filter."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((swap) => (
                  <TableRow key={swap.id} className="relative cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <a
                        href={`/magacin/zamene/${swap.id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/magacin/zamene/${swap.id}`); }}
                        className="absolute inset-0 z-0"
                        aria-hidden="true"
                      />
                      <span className="relative z-[1]">{swap.swap_number}</span>
                    </TableCell>
                    <TableCell>
                      {format(new Date(swap.swap_date), "dd.MM.yyyy", { locale: sr })}
                    </TableCell>
                    <TableCell>{swap.warehouse?.code} - {swap.warehouse?.name}</TableCell>
                    <TableCell>{swap.article_1_code} - {swap.article_1_name}</TableCell>
                    <TableCell>{swap.article_2_code} - {swap.article_2_name}</TableCell>
                    <TableCell className="text-right font-mono">{formatDecimal(swap.swap_value, 2)}</TableCell>
                    <TableCell>
                      {swap.status === "posted" ? (
                        <Badge variant="default">Proknjiženo</Badge>
                      ) : (
                        <Badge variant="secondary">Nacrt</Badge>
                      )}
                    </TableCell>
                    <TableCell className="relative z-10" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a href={`/magacin/zamene/${swap.id}`} onClick={(e) => { e.preventDefault(); navigate(`/magacin/zamene/${swap.id}`); }}>
                              <Eye className="h-4 w-4 mr-2" />Prikaži
                            </a>
                          </DropdownMenuItem>
                          {swap.status === "draft" && canPost && (
                            <DropdownMenuItem onClick={() => setPostConfirm(swap)}>
                              <BookCheck className="h-4 w-4 mr-2" />Proknjiži
                            </DropdownMenuItem>
                          )}
                          {swap.status === "posted" && canPost && (
                            <DropdownMenuItem onClick={() => setUnpostConfirm(swap)}>
                              <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
                            </DropdownMenuItem>
                          )}
                          {swap.status === "draft" && canEdit && (
                            <DropdownMenuItem onClick={() => setDeleteConfirm(swap)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />Obriši
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisati zamenu?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete zamenu <strong>{deleteConfirm?.swap_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteConfirm) { await deleteSwap.mutateAsync(deleteConfirm.id); setDeleteConfirm(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Obriši</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!postConfirm} onOpenChange={() => setPostConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjižiti zamenu?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da proknjižite zamenu <strong>{postConfirm?.swap_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (postConfirm) { await postSwap.mutateAsync(postConfirm.id); setPostConfirm(null); } }}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!unpostConfirm} onOpenChange={() => setUnpostConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništiti knjiženje?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje zamene <strong>{unpostConfirm?.swap_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (unpostConfirm) { await unpostSwap.mutateAsync(unpostConfirm.id); setUnpostConfirm(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Poništi knjiženje</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
