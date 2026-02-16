import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useMaterialNorms, MaterialNorm } from "@/hooks/useMaterialNorms";
import { useArticles } from "@/hooks/useArticles";
import { useClassifications } from "@/hooks/useClassifications";
import { ClassificationBadge } from "@/components/sifarnici/ClassificationBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Plus, Search, Trash2, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { formatDate } from "@/lib/formatting";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { exportNormListToExcel, exportNormListToPdf, printNormList } from "@/lib/normListExportUtils";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const STORAGE_KEY = "normativi_filters";

function loadFilters() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveFilters(filters: Record<string, string>) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}

export default function Normativi() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;
  const { norms, isLoading, invalidate } = useMaterialNorms(companyId);
  const { articles } = useArticles(companyId);
  const { classifications } = useClassifications(companyId);

  const saved = useMemo(() => loadFilters(), []);
  const [search, setSearch] = useState(saved.search ?? "");
  const [classFilter, setClassFilter] = useState<string>(saved.classFilter ?? "");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [creating, setCreating] = useState(false);
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort(
    saved.sortColumn ?? "article_code",
    saved.sortDirection ?? "asc"
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastEditedId = saved.lastEditedId as string | undefined;
  const hasScrolled = useRef(false);

  // Persist filters to sessionStorage
  useEffect(() => {
    saveFilters({ search, classFilter, sortColumn: sortColumn ?? "", sortDirection, lastEditedId: lastEditedId ?? "" });
  }, [search, classFilter, sortColumn, sortDirection]);

  // Only SVK=9 articles for finished products
  const finishedProducts = articles.filter((a) => a.svk === "9" && a.is_active);

  // Unique classification codes for filter dropdown
  const classificationOptions = useMemo(() => {
    const codes = new Set<string>();
    norms.forEach((n) => { if (n.article_group) codes.add(n.article_group); });
    return Array.from(codes).sort();
  }, [norms]);

  const filtered = norms.filter((n) => {
    if (classFilter && n.article_group !== classFilter) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      n.article_code?.toLowerCase().includes(s) ||
      n.article_name?.toLowerCase().includes(s)
    );
  });

  const getClassificationName = useCallback((code: string | null | undefined) => {
    if (!code) return "";
    const cls = classifications.find((c) => c.code === code);
    return cls ? cls.name : code;
  }, [classifications]);

  const sorted = sortItems(filtered, (item: MaterialNorm, column: string) => {
    switch (column) {
      case "article_code": return item.article_code ?? "";
      case "article_name": return item.article_name ?? "";
      case "article_unit": return item.article_unit ?? "";
      case "article_group": return getClassificationName(item.article_group);
      case "variant_count": return item.variant_count ?? 0;
      case "approved_variant_count": return item.approved_variant_count ?? 0;
      case "created_at": return item.created_at;
      default: return "";
    }
  });

  // Scroll to last edited row when data loads
  useEffect(() => {
    if (!isLoading && lastEditedId && !hasScrolled.current && sorted.length > 0) {
      hasScrolled.current = true;
      requestAnimationFrame(() => {
        const row = scrollRef.current?.querySelector(`[data-norm-id="${lastEditedId}"]`);
        if (row) {
          row.scrollIntoView({ block: "center", behavior: "auto" });
        }
      });
    }
  }, [isLoading, sorted.length, lastEditedId]);

  const handleCreate = async () => {
    if (!selectedArticleId || !companyId) return;

    const exists = norms.find((n) => n.article_id === selectedArticleId);
    if (exists) {
      toast.error("Normativ za ovaj artikal već postoji");
      return;
    }

    setCreating(true);
    try {
      const { data: norm, error: normError } = await supabase
        .from("material_norms")
        .insert({ company_id: companyId, article_id: selectedArticleId })
        .select("id")
        .single();

      if (normError) throw normError;

      const { error: varError } = await supabase
        .from("material_norm_variants")
        .insert({
          norm_id: norm.id,
          company_id: companyId,
          variant_number: 1,
          variant_name: "Varijanta 1",
          is_default: true,
        });

      if (varError) throw varError;

      toast.success("Normativ kreiran");
      setShowNewDialog(false);
      setSelectedArticleId("");
      navigate(`/proizvodnja/normativi/${norm.id}`);
    } catch (err: any) {
      toast.error("Greška: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Da li ste sigurni da želite da obrišete ovaj normativ?")) return;

    const { error } = await supabase.from("material_norms").delete().eq("id", id);
    if (error) {
      toast.error("Greška: " + error.message);
    } else {
      toast.success("Normativ obrisan");
      invalidate();
    }
  };

  const classNameMap = useMemo(() => {
    const m = new Map<string, string>();
    classifications.forEach((c) => m.set(c.code, c.name));
    return m;
  }, [classifications]);

  return (
    <MainLayout title="Normativi utroška materijala">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Normativi utroška materijala</h1>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => exportNormListToExcel(filtered, classNameMap)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportNormListToPdf(filtered, classNameMap)}>
              <FileText className="h-4 w-4 mr-1" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printNormList(filtered, classNameMap)}>
              <Printer className="h-4 w-4 mr-1" />
              Štampa
            </Button>
            <Button onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novi normativ
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po šifri ili nazivu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoComplete="off"
            />
          </div>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Sve klasifikacije</option>
            {classificationOptions.map((code) => {
              const cls = classifications.find((c) => c.code === code);
              return (
                <option key={code} value={code}>
                  {code} - {cls?.name ?? code}
                </option>
              );
            })}
          </select>
        </div>

        <TableScrollContainer ref={scrollRef} className="max-h-[calc(100vh-220px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortableHeader column="article_code" label="Šifra GP" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader column="article_name" label="Naziv gotovog proizvoda" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader column="article_unit" label="JM" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader column="article_group" label="Klasifikacija" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="text-center"><SortableHeader column="variant_count" label="Varijanti" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-center" /></TableHead>
                <TableHead className="text-center"><SortableHeader column="approved_variant_count" label="Odobreno" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-center" /></TableHead>
                <TableHead><SortableHeader column="created_at" label="Kreiran" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                   <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nema normativa
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((norm) => (
                  <TableRow
                    key={norm.id}
                    data-norm-id={norm.id}
                    className="cursor-pointer"
                    onClick={() => {
                      saveFilters({ search, classFilter, sortColumn: sortColumn ?? "", sortDirection, lastEditedId: norm.id });
                      navigate(`/proizvodnja/normativi/${norm.id}`);
                    }}
                  >
                    <TableCell className="font-medium">{norm.article_code}</TableCell>
                    <TableCell>{norm.article_name}</TableCell>
                    <TableCell>{norm.article_unit}</TableCell>
                    <TableCell>
                      <ClassificationBadge code={norm.article_group} classifications={classifications} />
                    </TableCell>
                    <TableCell className="text-center">{norm.variant_count ?? 0}</TableCell>
                    <TableCell className="text-center">{norm.approved_variant_count ?? 0}</TableCell>
                    <TableCell>{formatDate(norm.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => handleDelete(norm.id, e)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novi normativ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Gotov proizvod (SVK=9)</label>
              <SearchableArticleSelect
                articles={finishedProducts}
                value={selectedArticleId}
                onValueChange={(id) => setSelectedArticleId(id)}
                placeholder="Izaberite gotov proizvod..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Otkaži
            </Button>
            <Button onClick={handleCreate} disabled={!selectedArticleId || creating}>
              {creating ? "Kreiranje..." : "Kreiraj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
