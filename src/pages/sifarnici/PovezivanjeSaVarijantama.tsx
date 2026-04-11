import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Plus, Trash2, RefreshCw, Search, Loader2, Link2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { useArticles } from "@/hooks/useArticles";
import { useArticleVariants } from "@/hooks/useArticleVariants";
import { usePermissions } from "@/hooks/usePermissions";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { cn } from "@/lib/utils";

interface AssignmentRow {
  id: string;
  article_id: string;
  variant_id: string;
  company_id: string;
  created_at: string;
  article_code: string;
  article_name: string;
  variant_code: string;
  variant_description: string;
}

export default function PovezivanjeSaVarijantama() {
  const { selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("sifarnici.atributi", "write");
  const queryClient = useQueryClient();

  const { articles } = useArticles(selectedCompany?.id);
  const { variants } = useArticleVariants(selectedCompany?.id);

  const { data: rawAssignments = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["all-variant-assignments", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      let all: any[] = [];
      let from = 0;
      const batch = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("article_variant_assignments")
          .select("*")
          .eq("company_id", selectedCompany.id)
          .order("created_at")
          .range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = [...all, ...data];
        if (data.length < batch) break;
        from += batch;
      }
      return all;
    },
    enabled: !!selectedCompany?.id,
    staleTime: 2 * 60 * 1000,
  });

  const articleMap = useMemo(() => {
    const m = new Map<string, { code: string; name: string }>();
    articles.forEach(a => m.set(a.id, { code: a.code, name: a.name }));
    return m;
  }, [articles]);

  const variantMap = useMemo(() => {
    const m = new Map<string, { code: string; description: string }>();
    variants.forEach(v => m.set(v.id, { code: v.code, description: v.description }));
    return m;
  }, [variants]);

  const assignments: AssignmentRow[] = useMemo(() => {
    return rawAssignments.map((a: any) => {
      const art = articleMap.get(a.article_id);
      const v = variantMap.get(a.variant_id);
      return {
        id: a.id,
        article_id: a.article_id,
        variant_id: a.variant_id,
        company_id: a.company_id,
        created_at: a.created_at,
        article_code: art?.code ?? "?",
        article_name: art?.name ?? "?",
        variant_code: v?.code ?? "?",
        variant_description: v?.description ?? "?",
      };
    });
  }, [rawAssignments, articleMap, variantMap]);

  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [articleSearch, setArticleSearch] = useState("");
  const [variantSearch, setVariantSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return assignments;
    const lower = searchTerm.toLowerCase();
    return assignments.filter(
      a =>
        a.article_code.toLowerCase().includes(lower) ||
        a.article_name.toLowerCase().includes(lower) ||
        a.variant_code.toLowerCase().includes(lower) ||
        a.variant_description.toLowerCase().includes(lower)
    );
  }, [assignments, searchTerm]);

  const { sortedData, sortColumn, sortDirection, handleSort } = useTableSort<AssignmentRow>(filtered, "article_code", "asc");

  const filteredArticles = useMemo(() => {
    if (!articleSearch.trim()) return articles;
    const l = articleSearch.toLowerCase();
    return articles.filter(a => a.code.toLowerCase().includes(l) || a.name.toLowerCase().includes(l));
  }, [articles, articleSearch]);

  const filteredVariants = useMemo(() => {
    if (!variantSearch.trim()) return variants.filter(v => v.is_active);
    const l = variantSearch.toLowerCase();
    return variants.filter(v => v.is_active && (v.code.toLowerCase().includes(l) || v.description.toLowerCase().includes(l)));
  }, [variants, variantSearch]);

  const handleAdd = async () => {
    if (!selectedArticleId || !selectedVariantId || !selectedCompany?.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("article_variant_assignments").insert({
        article_id: selectedArticleId,
        variant_id: selectedVariantId,
        company_id: selectedCompany.id,
      });
      if (error) {
        if (error.code === "23505") toast.error("Ova veza već postoji");
        else throw error;
      } else {
        toast.success("Veza uspešno kreirana");
        queryClient.invalidateQueries({ queryKey: ["all-variant-assignments", selectedCompany.id] });
        setIsAddOpen(false);
        setSelectedArticleId("");
        setSelectedVariantId("");
        setArticleSearch("");
        setVariantSearch("");
      }
    } catch (e: any) {
      toast.error("Greška: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from("article_variant_assignments").delete().eq("id", deletingId);
      if (error) throw error;
      toast.success("Veza obrisana");
      queryClient.invalidateQueries({ queryKey: ["all-variant-assignments", selectedCompany?.id] });
    } catch (e: any) {
      toast.error("Greška: " + e.message);
    } finally {
      setIsDeleteOpen(false);
      setDeletingId(null);
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Povezivanje artikala sa varijantama</h1>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Osveži</TooltipContent>
            </Tooltip>
            {canEdit && (
              <Button onClick={() => setIsAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nova veza
              </Button>
            )}
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pretraži po šifri ili nazivu..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <TableScrollContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader label="Šifra artikla" column="article_code" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                <SortableHeader label="Naziv artikla" column="article_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                <SortableHeader label="Šifra varijante" column="variant_code" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                <SortableHeader label="Opis varijante" column="variant_description" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                {canEdit && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 5 : 4} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 5 : 4} className="text-center py-8 text-muted-foreground">
                    Nema podataka
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.article_code}</TableCell>
                    <TableCell>{row.article_name}</TableCell>
                    <TableCell className="font-mono">{row.variant_code}</TableCell>
                    <TableCell>{row.variant_description}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => { setDeletingId(row.id); setIsDeleteOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Obriši vezu</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>

        <div className="text-sm text-muted-foreground">
          Prikazano: {sortedData.length} / {assignments.length}
        </div>
      </div>

      {/* Add dialog */}
      <Dialog open={isAddOpen} onOpenChange={v => { if (!v) { setIsAddOpen(false); setSelectedArticleId(""); setSelectedVariantId(""); setArticleSearch(""); setVariantSearch(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova veza artikal - varijanta</DialogTitle>
            <DialogDescription>Izaberite artikal i varijantu za povezivanje.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Artikal *</Label>
              <Input
                placeholder="Pretraži artikle po šifri ili nazivu..."
                value={articleSearch}
                onChange={e => { setArticleSearch(e.target.value); setSelectedArticleId(""); }}
              />
              {articleSearch && !selectedArticleId && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {filteredArticles.slice(0, 50).map(a => (
                    <button
                      key={a.id}
                      className="w-full text-left px-3 py-1.5 hover:bg-accent text-sm flex gap-2"
                      onClick={() => { setSelectedArticleId(a.id); setArticleSearch(`${a.code} - ${a.name}`); }}
                    >
                      <span className="font-mono text-muted-foreground">{a.code}</span>
                      <span>{a.name}</span>
                    </button>
                  ))}
                  {filteredArticles.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Nema rezultata</div>}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Varijanta *</Label>
              <Input
                placeholder="Pretraži varijante po šifri ili opisu..."
                value={variantSearch}
                onChange={e => { setVariantSearch(e.target.value); setSelectedVariantId(""); }}
              />
              {variantSearch && !selectedVariantId && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {filteredVariants.slice(0, 50).map(v => (
                    <button
                      key={v.id}
                      className="w-full text-left px-3 py-1.5 hover:bg-accent text-sm flex gap-2"
                      onClick={() => { setSelectedVariantId(v.id); setVariantSearch(`${v.code} - ${v.description}`); }}
                    >
                      <span className="font-mono text-muted-foreground">{v.code}</span>
                      <span>{v.description}</span>
                    </button>
                  ))}
                  {filteredVariants.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Nema rezultata</div>}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Otkaži</Button>
            <Button onClick={handleAdd} disabled={!selectedArticleId || !selectedVariantId || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Poveži
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje veze</AlertDialogTitle>
            <AlertDialogDescription>Da li ste sigurni da želite da obrišete ovu vezu?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Obriši</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
