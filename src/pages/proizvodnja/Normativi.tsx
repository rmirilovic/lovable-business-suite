import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useMaterialNorms } from "@/hooks/useMaterialNorms";
import { useArticles } from "@/hooks/useArticles";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Normativi() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;
  const { norms, isLoading, invalidate } = useMaterialNorms(companyId);
  const { articles } = useArticles(companyId);
  const [search, setSearch] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [creating, setCreating] = useState(false);

  // Only SVK=9 articles for finished products
  const finishedProducts = articles.filter((a) => a.svk === "9" && a.is_active);

  const filtered = norms.filter((n) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      n.article_code?.toLowerCase().includes(s) ||
      n.article_name?.toLowerCase().includes(s)
    );
  });

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

  return (
    <MainLayout title="Normativi utroška materijala">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Normativi utroška materijala</h1>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => exportNormListToExcel(filtered)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportNormListToPdf(filtered)}>
              <FileText className="h-4 w-4 mr-1" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printNormList(filtered)}>
              <Printer className="h-4 w-4 mr-1" />
              Štampa
            </Button>
            <Button onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novi normativ
            </Button>
          </div>
        </div>

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

        <TableScrollContainer className="max-h-[calc(100vh-220px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Šifra GP</TableHead>
                <TableHead>Naziv gotovog proizvoda</TableHead>
                <TableHead>JM</TableHead>
                <TableHead className="text-center">Varijanti</TableHead>
                <TableHead className="text-center">Odobreno</TableHead>
                <TableHead>Kreiran</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nema normativa
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((norm) => (
                  <TableRow
                    key={norm.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/proizvodnja/normativi/${norm.id}`)}
                  >
                    <TableCell className="font-medium">{norm.article_code}</TableCell>
                    <TableCell>{norm.article_name}</TableCell>
                    <TableCell>{norm.article_unit}</TableCell>
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
