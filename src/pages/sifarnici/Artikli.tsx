import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Search,
  Plus,
  Filter,
  Download,
  Edit2,
  Trash2,
  Eye,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
}

interface ArticleForm {
  code: string;
  name: string;
  article_group: string;
  unit: string;
  purchase_price: string;
  selling_price: string;
  stock: string;
  min_stock: string;
  is_active: boolean;
}

const emptyForm: ArticleForm = {
  code: "",
  name: "",
  article_group: "",
  unit: "kom",
  purchase_price: "0",
  selling_price: "0",
  stock: "0",
  min_stock: "0",
  is_active: true,
};

export default function Artikli() {
  const { selectedCompany, selectedYear, isSuperAdmin, isLocalAdmin } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [viewingArticle, setViewingArticle] = useState<Article | null>(null);
  const [deletingArticle, setDeletingArticle] = useState<Article | null>(null);
  const [formData, setFormData] = useState<ArticleForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const canEdit = isSuperAdmin || isLocalAdmin;

  useEffect(() => {
    if (selectedCompany && selectedYear) {
      fetchArticles();
    }
  }, [selectedCompany, selectedYear]);

  const fetchArticles = async () => {
    if (!selectedCompany || !selectedYear) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("code");

      if (error) throw error;
      setArticles(data || []);
    } catch (error: any) {
      toast.error("Greška pri učitavanju artikala: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredArticles = articles.filter(
    (article) =>
      article.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredArticles.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredArticles.map((a) => a.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleAdd = () => {
    setEditingArticle(null);
    setFormData(emptyForm);
    setIsFormOpen(true);
  };

  const handleEdit = (article: Article) => {
    setEditingArticle(article);
    setFormData({
      code: article.code,
      name: article.name,
      article_group: article.article_group || "",
      unit: article.unit,
      purchase_price: String(article.purchase_price),
      selling_price: String(article.selling_price),
      stock: String(article.stock),
      min_stock: String(article.min_stock),
      is_active: article.is_active,
    });
    setIsFormOpen(true);
  };

  const handleView = (article: Article) => {
    setViewingArticle(article);
    setIsViewOpen(true);
  };

  const handleDeleteClick = (article: Article) => {
    setDeletingArticle(article);
    setIsDeleteOpen(true);
  };

  const handleSave = async () => {
    if (!selectedCompany || !selectedYear) return;
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Šifra i naziv su obavezni");
      return;
    }

    setSaving(true);
    try {
      const articleData = {
        company_id: selectedCompany.id,
        business_year_id: selectedYear.id,
        code: formData.code.trim(),
        name: formData.name.trim(),
        article_group: formData.article_group.trim() || null,
        unit: formData.unit.trim(),
        purchase_price: parseFloat(formData.purchase_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        stock: parseFloat(formData.stock) || 0,
        min_stock: parseFloat(formData.min_stock) || 0,
        is_active: formData.is_active,
      };

      if (editingArticle) {
        const { error } = await supabase
          .from("articles")
          .update(articleData)
          .eq("id", editingArticle.id);

        if (error) throw error;
        toast.success("Artikal uspešno ažuriran");
      } else {
        const { error } = await supabase
          .from("articles")
          .insert(articleData);

        if (error) throw error;
        toast.success("Artikal uspešno kreiran");
      }

      setIsFormOpen(false);
      fetchArticles();
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingArticle) return;

    try {
      const { error } = await supabase
        .from("articles")
        .delete()
        .eq("id", deletingArticle.id);

      if (error) throw error;
      toast.success("Artikal uspešno obrisan");
      setIsDeleteOpen(false);
      setDeletingArticle(null);
      fetchArticles();
    } catch (error: any) {
      toast.error("Greška pri brisanju: " + error.message);
    }
  };

  if (!selectedCompany || !selectedYear) {
    return (
      <MainLayout title="Šifarnik artikala">
        <div className="erp-card p-8 text-center text-muted-foreground">
          Molimo izaberite firmu i poslovnu godinu
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Šifarnik artikala">
      {/* Toolbar */}
      <div className="erp-card p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-1 gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Pretraži po šifri ili nazivu..."
                className="erp-input w-full pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="erp-btn-primary gap-2 hidden md:inline-flex">
              <Filter className="w-4 h-4" />
              Filteri
            </button>
          </div>
          <div className="flex gap-3">
            <button className="erp-btn-primary gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80">
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Izvoz</span>
            </button>
            {canEdit && (
              <button className="erp-btn-accent gap-2" onClick={handleAdd}>
                <Plus className="w-4 h-4" />
                <span>Novi artikal</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="erp-card overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="erp-table-header">
                    <th className="w-12 p-3 text-left">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={
                          selectedItems.length === filteredArticles.length &&
                          filteredArticles.length > 0
                        }
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="p-3 text-left font-medium">Šifra</th>
                    <th className="p-3 text-left font-medium">Naziv</th>
                    <th className="p-3 text-left font-medium">Grupa</th>
                    <th className="p-3 text-left font-medium">JM</th>
                    <th className="p-3 text-right font-medium">Nabavna cena</th>
                    <th className="p-3 text-right font-medium">Prodajna cena</th>
                    <th className="p-3 text-right font-medium">Stanje</th>
                    <th className="p-3 text-center font-medium">Status</th>
                    <th className="w-12 p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredArticles.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-muted-foreground">
                        {searchTerm ? "Nema rezultata pretrage" : "Nema artikala"}
                      </td>
                    </tr>
                  ) : (
                    filteredArticles.map((article, index) => (
                      <tr
                        key={article.id}
                        className="hover:bg-table-hover transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            className="rounded border-border"
                            checked={selectedItems.includes(article.id)}
                            onChange={() => toggleSelect(article.id)}
                          />
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-sm text-primary">
                            {article.code}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-foreground">
                          {article.name}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {article.article_group || "-"}
                        </td>
                        <td className="p-3 text-muted-foreground">{article.unit}</td>
                        <td className="p-3 text-right font-mono">
                          {Number(article.purchase_price).toLocaleString()} RSD
                        </td>
                        <td className="p-3 text-right font-mono">
                          {Number(article.selling_price).toLocaleString()} RSD
                        </td>
                        <td className="p-3 text-right font-mono">
                          {Number(article.stock).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={
                              article.is_active
                                ? "erp-badge-success"
                                : "erp-badge-destructive"
                            }
                          >
                            {article.is_active ? "Aktivan" : "Neaktivan"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end">
                            <button
                              className="p-1.5 rounded hover:bg-secondary transition-colors"
                              onClick={() => handleView(article)}
                            >
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </button>
                            {canEdit && (
                              <>
                                <button
                                  className="p-1.5 rounded hover:bg-secondary transition-colors"
                                  onClick={() => handleEdit(article)}
                                >
                                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                                </button>
                                <button
                                  className="p-1.5 rounded hover:bg-secondary transition-colors"
                                  onClick={() => handleDeleteClick(article)}
                                >
                                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination info */}
            <div className="p-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Prikazano {filteredArticles.length} od {articles.length} artikala
              </p>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingArticle ? "Izmena artikla" : "Novi artikal"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Šifra *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Jedinica mere</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Naziv *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group">Grupa</Label>
              <Input
                id="group"
                value={formData.article_group}
                onChange={(e) => setFormData({ ...formData, article_group: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Nabavna cena</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="selling_price">Prodajna cena</Label>
                <Input
                  id="selling_price"
                  type="number"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Stanje zaliha</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_stock">Minimalno stanje</Label>
                <Input
                  id="min_stock"
                  type="number"
                  value={formData.min_stock}
                  onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Aktivan</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Otkaži
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingArticle ? "Sačuvaj izmene" : "Dodaj artikal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalji artikla</DialogTitle>
          </DialogHeader>
          {viewingArticle && (
            <div className="grid gap-3 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Šifra</p>
                  <p className="font-medium">{viewingArticle.code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jedinica mere</p>
                  <p className="font-medium">{viewingArticle.unit}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Naziv</p>
                <p className="font-medium">{viewingArticle.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Grupa</p>
                <p className="font-medium">{viewingArticle.article_group || "-"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nabavna cena</p>
                  <p className="font-medium">{Number(viewingArticle.purchase_price).toLocaleString()} RSD</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prodajna cena</p>
                  <p className="font-medium">{Number(viewingArticle.selling_price).toLocaleString()} RSD</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Stanje zaliha</p>
                  <p className="font-medium">{Number(viewingArticle.stock).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Minimalno stanje</p>
                  <p className="font-medium">{Number(viewingArticle.min_stock).toLocaleString()}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <span className={viewingArticle.is_active ? "erp-badge-success" : "erp-badge-destructive"}>
                  {viewingArticle.is_active ? "Aktivan" : "Neaktivan"}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Zatvori
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Da li ste sigurni?</AlertDialogTitle>
            <AlertDialogDescription>
              Ova akcija će trajno obrisati artikal "{deletingArticle?.name}".
              Ova radnja se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
