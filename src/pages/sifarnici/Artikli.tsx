import { useState, useEffect, useMemo, useRef } from "react";
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
  HelpCircle,
  X,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  History,
  RefreshCw,
  Tags,
  FileJson,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatPrice, formatDecimal, formatInteger, parseLocaleNumber } from "@/lib/formatting";
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
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ExportColumnsDialog } from "@/components/sifarnici/ExportColumnsDialog";
import { ArticleHistoryDialog } from "@/components/sifarnici/ArticleHistoryDialog";
import { InlineEditCell } from "@/components/sifarnici/InlineEditCell";
import { InlineSelectCell } from "@/components/sifarnici/InlineSelectCell";
import { ClassificationTreePicker, getClassificationPath, formatClassificationPath } from "@/components/sifarnici/ClassificationTreePicker";
import { ClassificationBadge } from "@/components/sifarnici/ClassificationBadge";
import { InlineClassificationCell } from "@/components/sifarnici/InlineClassificationCell";
import { useArticles, Article } from "@/hooks/useArticles";
import { useClassifications } from "@/hooks/useClassifications";
import { useArticleAttributeCounts } from "@/hooks/useArticleAttributeCounts";
import { useArticleAttributes } from "@/hooks/useArticleAttributes";
import { ArticleAttributesDialog } from "@/components/sifarnici/ArticleAttributesDialog";
import { ArticleApiDialog } from "@/components/sifarnici/ArticleApiDialog";

type SvkType = '0' | '1' | '2' | '6' | '8' | '9';

const SVK_OPTIONS: { value: SvkType; label: string }[] = [
  { value: '0', label: '0 - Usluge' },
  { value: '1', label: '1 - Roba' },
  { value: '2', label: '2 - Repromaterijal' },
  { value: '6', label: '6 - Rezervni delovi' },
  { value: '8', label: '8 - Potrošni materijal' },
  { value: '9', label: '9 - Gotovi proizvodi' },
];

// Article interface imported from useArticles hook

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
  svk: SvkType;
  kg_po_jm: string;
  kol_mas: string;
}

interface ArticleFilters {
  svk: string;
  articleGroup: string;
  unit: string;
  status: string;
  kgPoJmMin: string;
  kgPoJmMax: string;
  sellingPriceMin: string;
  sellingPriceMax: string;
  attributeId: string;
  attributeValue: string;
}

const emptyFilters: ArticleFilters = {
  svk: "",
  articleGroup: "",
  unit: "",
  status: "",
  kgPoJmMin: "",
  kgPoJmMax: "",
  sellingPriceMin: "",
  sellingPriceMax: "",
  attributeId: "",
  attributeValue: "",
};

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
  svk: "1",
  kg_po_jm: "0",
  kol_mas: "1",
};

export default function Artikli() {
  const { selectedCompany, selectedYear, isSuperAdmin, isLocalAdmin } = useAuth();
  
  // Use cached articles hook
  const {
    articles,
    isLoading: loading,
    isFetching,
    updateArticleInCache,
    addArticleToCache,
    removeArticleFromCache,
    refetch,
  } = useArticles(selectedCompany?.id, selectedYear?.id);

  // Use cached classifications hook
  const { classifications } = useClassifications(selectedCompany?.id);
  
  // Use attribute counts hook
  const { getCount, getAttributes, refetch: refetchAttributeCounts } = useArticleAttributeCounts(selectedCompany?.id);
  
  // Use article attributes hook for filter dropdown
  const { attributes: availableAttributes } = useArticleAttributes(selectedCompany?.id);
  
  const [searchTerm, setSearchTerm] = useState("");
  
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ArticleFilters>(emptyFilters);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const companyId = selectedCompany?.id;
    const yearId = selectedYear?.id;
    if (companyId && yearId) {
      const saved = localStorage.getItem(`artikli-itemsPerPage-${companyId}-${yearId}`);
      if (saved) return parseInt(saved, 10);
    }
    return 20;
  });
  
  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAttributesOpen, setIsAttributesOpen] = useState(false);
  const [isApiOpen, setIsApiOpen] = useState(false);
  const [historyArticle, setHistoryArticle] = useState<Article | null>(null);
  const [attributesArticle, setAttributesArticle] = useState<Article | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [viewingArticle, setViewingArticle] = useState<Article | null>(null);
  const [deletingArticle, setDeletingArticle] = useState<Article | null>(null);
  const [formData, setFormData] = useState<ArticleForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Inline editing navigation state
  const [activeEditCell, setActiveEditCell] = useState<{ articleId: string; field: string } | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollPositionRef = useRef<number | null>(null);

  // Define editable fields order for Tab navigation
  const editableFields = ['name', 'article_group', 'unit', 'purchase_price', 'selling_price'] as const;
  type EditableField = typeof editableFields[number];

  const canEdit = isSuperAdmin || isLocalAdmin;

  // Get unique groups for filter dropdown
  const uniqueGroups = useMemo(() => {
    const groups = articles
      .map(a => a.article_group)
      .filter((g): g is string => !!g);
    return [...new Set(groups)].sort();
  }, [articles]);

  // Get unique units for filter dropdown
  const uniqueUnits = useMemo(() => {
    const units = articles.map(a => a.unit).filter(Boolean);
    return [...new Set(units)].sort();
  }, [articles]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(v => v !== "");
  }, [filters]);

  // Articles are now fetched automatically by useArticles hook with caching

  const filteredArticles = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return articles.filter((article) => {
      // Search filter - includes attributes
      let matchesSearch = 
        article.name.toLowerCase().includes(lowerSearchTerm) ||
        article.code.toLowerCase().includes(lowerSearchTerm);
      
      // Also search in attributes if no match yet
      if (!matchesSearch && searchTerm) {
        const attrs = getAttributes(article.id);
        matchesSearch = attrs.some(
          (attr) =>
            attr.name.toLowerCase().includes(lowerSearchTerm) ||
            attr.value.toLowerCase().includes(lowerSearchTerm)
        );
      }
      
      if (!matchesSearch) return false;

      // SVK filter
      if (filters.svk && article.svk !== filters.svk) return false;

      // Group filter (supports prefix matching with *)
      if (filters.articleGroup) {
        const groupFilter = filters.articleGroup.trim();
        const articleGroup = article.article_group || "";
        
        if (groupFilter.endsWith("*")) {
          // Prefix matching: "011*" matches all groups starting with "011"
          const prefix = groupFilter.slice(0, -1);
          if (!articleGroup.startsWith(prefix)) return false;
        } else {
          // Exact match
          if (articleGroup !== groupFilter) return false;
        }
      }

      // Unit filter
      if (filters.unit && article.unit !== filters.unit) return false;

      // kg po JM filters
      if (filters.kgPoJmMin) {
        const min = parseLocaleNumber(filters.kgPoJmMin);
        if ((article.kg_po_jm ?? 0) < min) return false;
      }
      if (filters.kgPoJmMax) {
        const max = parseLocaleNumber(filters.kgPoJmMax);
        if ((article.kg_po_jm ?? 0) > max) return false;
      }

      // Status filter
      if (filters.status) {
        const isActive = filters.status === 'active';
        if (article.is_active !== isActive) return false;
      }

      // Selling price filters
      if (filters.sellingPriceMin) {
        const min = parseLocaleNumber(filters.sellingPriceMin);
        if (article.selling_price < min) return false;
      }
      if (filters.sellingPriceMax) {
        const max = parseLocaleNumber(filters.sellingPriceMax);
        if (article.selling_price > max) return false;
      }

      // Attribute filter
      if (filters.attributeId) {
        const attrs = getAttributes(article.id);
        const matchingAttrs = attrs.filter(a => {
          // Find attribute by matching the name (since we have name in attrs, we need to match by attributeId)
          const selectedAttr = availableAttributes.find(aa => aa.id === filters.attributeId);
          if (!selectedAttr) return false;
          return a.code === selectedAttr.code;
        });
        
        if (matchingAttrs.length === 0) return false;
        
        // If value filter is also set, check value
        if (filters.attributeValue) {
          const lowerValue = filters.attributeValue.toLowerCase();
          const hasMatchingValue = matchingAttrs.some(a => 
            a.value.toLowerCase().includes(lowerValue)
          );
          if (!hasMatchingValue) return false;
        }
      }

      return true;
    });
  }, [articles, searchTerm, filters, getAttributes, availableAttributes]);

  // Sorted articles
  const sortedArticles = useMemo(() => {
    if (!sortColumn) return filteredArticles;

    return [...filteredArticles].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'code':
          aValue = a.code || '';
          bValue = b.code || '';
          break;
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'article_group':
          aValue = a.article_group || '';
          bValue = b.article_group || '';
          break;
        case 'svk':
          aValue = a.svk || '';
          bValue = b.svk || '';
          break;
        case 'unit':
          aValue = a.unit || '';
          bValue = b.unit || '';
          break;
        case 'purchase_price':
          aValue = a.purchase_price ?? 0;
          bValue = b.purchase_price ?? 0;
          break;
        case 'selling_price':
          aValue = a.selling_price ?? 0;
          bValue = b.selling_price ?? 0;
          break;
        case 'stock':
          aValue = a.stock ?? 0;
          bValue = b.stock ?? 0;
          break;
        case 'is_active':
          aValue = a.is_active ? 1 : 0;
          bValue = b.is_active ? 1 : 0;
          break;
        default:
          return 0;
      }

      // String comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue, 'sr');
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Number comparison
      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  }, [filteredArticles, sortColumn, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction or clear
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort indicator component
  const SortIndicator = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1 text-primary" />
      : <ArrowDown className="w-4 h-4 ml-1 text-primary" />;
  };

  // Pagination calculations
  const totalPages = Math.ceil(sortedArticles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedArticles = sortedArticles.slice(startIndex, endIndex);

  // Reset to first page when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, sortColumn, sortDirection]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
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
      svk: (article.svk as SvkType) || "1",
      kg_po_jm: String(article.kg_po_jm ?? 0),
      kol_mas: String(article.kol_mas ?? 1),
    });
    setIsFormOpen(true);
  };

  const handleView = (article: Article) => {
    setViewingArticle(article);
    setIsViewOpen(true);
  };

  const handleHistory = (article: Article) => {
    setHistoryArticle(article);
    setIsHistoryOpen(true);
  };

  const handleAttributes = (article: Article) => {
    setAttributesArticle(article);
    setIsAttributesOpen(true);
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

    // Save scroll position before updating
    if (tableContainerRef.current) {
      savedScrollPositionRef.current = tableContainerRef.current.scrollTop;
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
        purchase_price: parseLocaleNumber(formData.purchase_price),
        selling_price: parseLocaleNumber(formData.selling_price),
        stock: parseLocaleNumber(formData.stock),
        min_stock: parseLocaleNumber(formData.min_stock),
        is_active: formData.is_active,
        svk: formData.svk,
        kg_po_jm: parseLocaleNumber(formData.kg_po_jm),
        kol_mas: parseLocaleNumber(formData.kol_mas) || 1,
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
      
      // Refetch articles to get updated data with cache update
      await refetch();
      
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (tableContainerRef.current && savedScrollPositionRef.current !== null) {
          tableContainerRef.current.scrollTop = savedScrollPositionRef.current;
          savedScrollPositionRef.current = null;
        }
      });
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Inline edit handler - updates single field without opening dialog
  const handleInlineEdit = async (articleId: string, field: keyof Article, value: string) => {
    // Save scroll position
    if (tableContainerRef.current) {
      savedScrollPositionRef.current = tableContainerRef.current.scrollTop;
    }

    try {
      let updateValue: any = value;
      
      // Parse numeric fields
      if (['purchase_price', 'selling_price', 'stock', 'min_stock', 'kg_po_jm', 'kol_mas'].includes(field)) {
        updateValue = parseLocaleNumber(value);
      }
      
      // Parse boolean fields
      if (field === 'is_active') {
        updateValue = value === 'true';
      }

      const { error } = await supabase
        .from("articles")
        .update({ [field]: updateValue })
        .eq("id", articleId);

      if (error) throw error;
      
      // Update cache immediately for responsiveness
      const article = articles.find(a => a.id === articleId);
      if (article) {
        updateArticleInCache({ ...article, [field]: updateValue });
      }
      
      toast.success("Izmena sačuvana");
      
      // Restore scroll position
      requestAnimationFrame(() => {
        if (tableContainerRef.current && savedScrollPositionRef.current !== null) {
          tableContainerRef.current.scrollTop = savedScrollPositionRef.current;
          savedScrollPositionRef.current = null;
        }
      });
    } catch (error: any) {
      toast.error("Greška pri čuvanju: " + error.message);
      throw error; // Re-throw to keep cell in edit mode
    }
  };

  // Navigation functions for inline editing
  const navigateToCell = (articleId: string, field: string, direction: 'next' | 'prev') => {
    const currentFieldIndex = editableFields.indexOf(field as EditableField);
    const currentArticleIndex = paginatedArticles.findIndex(a => a.id === articleId);
    
    if (currentFieldIndex === -1 || currentArticleIndex === -1) {
      setActiveEditCell(null);
      return;
    }

    let nextFieldIndex = direction === 'next' ? currentFieldIndex + 1 : currentFieldIndex - 1;
    let nextArticleIndex = currentArticleIndex;

    // Handle field overflow
    if (nextFieldIndex >= editableFields.length) {
      nextFieldIndex = 0;
      nextArticleIndex = currentArticleIndex + 1;
    } else if (nextFieldIndex < 0) {
      nextFieldIndex = editableFields.length - 1;
      nextArticleIndex = currentArticleIndex - 1;
    }

    // Check article bounds
    if (nextArticleIndex < 0 || nextArticleIndex >= paginatedArticles.length) {
      setActiveEditCell(null);
      return;
    }

    const nextArticle = paginatedArticles[nextArticleIndex];
    const nextField = editableFields[nextFieldIndex];
    
    setActiveEditCell({ articleId: nextArticle.id, field: nextField });
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
      removeArticleFromCache(deletingArticle.id);
      setDeletingArticle(null);
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
        <div className="flex flex-col gap-4">
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
              <button 
                className={`erp-btn-primary gap-2 ${hasActiveFilters ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden md:inline">Filteri</span>
                {hasActiveFilters && (
                  <span className="bg-primary-foreground text-primary text-xs px-1.5 py-0.5 rounded-full">
                    !
                  </span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <div className="flex gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="erp-btn-primary gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    onClick={() => refetch()}
                    disabled={isFetching}
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                    <span className="hidden md:inline">Osveži</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Osveži listu artikala sa servera</p>
                </TooltipContent>
              </Tooltip>
              <button 
                className="erp-btn-primary gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80"
                onClick={() => setIsExportOpen(true)}
              >
                <Download className="w-4 h-4" />
                <span className="hidden md:inline">Izvoz</span>
              </button>
              {(isSuperAdmin || isLocalAdmin) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      className="erp-btn-primary gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      onClick={() => setIsApiOpen(true)}
                    >
                      <FileJson className="w-4 h-4" />
                      <span className="hidden md:inline">API</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Izvoz/Uvoz putem JSON API-ja</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {canEdit && (
                <button className="erp-btn-accent gap-2" onClick={handleAdd}>
                  <Plus className="w-4 h-4" />
                  <span>Novi artikal</span>
                </button>
              )}
            </div>
          </div>

          {/* Filters Panel */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleContent>
              <div className="pt-4 border-t border-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {/* SVK Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">SVK</Label>
                    <Select
                      value={filters.svk}
                      onValueChange={(value) => setFilters({ ...filters, svk: value === "all" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Svi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Svi</SelectItem>
                        {SVK_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Group Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Klasa (npr. 011*)</Label>
                    <Input
                      placeholder="Unesite klasu ili prefiks*"
                      value={filters.articleGroup}
                      onChange={(e) => setFilters({ ...filters, articleGroup: e.target.value })}
                    />
                  </div>

                  {/* Unit Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">JM</Label>
                    <Select
                      value={filters.unit}
                      onValueChange={(value) => setFilters({ ...filters, unit: value === "all" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sve" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Sve</SelectItem>
                        {uniqueUnits.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* kg po JM Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">kg po JM (od - do)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Od"
                        className="flex-1"
                        value={filters.kgPoJmMin}
                        onChange={(e) => setFilters({ ...filters, kgPoJmMin: e.target.value })}
                      />
                      <Input
                        type="text"
                        placeholder="Do"
                        className="flex-1"
                        value={filters.kgPoJmMax}
                        onChange={(e) => setFilters({ ...filters, kgPoJmMax: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Selling Price Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Prodajna cena (od - do)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Od"
                        className="flex-1"
                        value={filters.sellingPriceMin}
                        onChange={(e) => setFilters({ ...filters, sellingPriceMin: e.target.value })}
                      />
                      <Input
                        type="text"
                        placeholder="Do"
                        className="flex-1"
                        value={filters.sellingPriceMax}
                        onChange={(e) => setFilters({ ...filters, sellingPriceMax: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select
                      value={filters.status}
                      onValueChange={(value) => setFilters({ ...filters, status: value === "all" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Svi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Svi</SelectItem>
                        <SelectItem value="active">Aktivan</SelectItem>
                        <SelectItem value="inactive">Neaktivan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Attribute Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Atribut</Label>
                    <Select
                      value={filters.attributeId}
                      onValueChange={(value) => setFilters({ 
                        ...filters, 
                        attributeId: value === "all" ? "" : value,
                        attributeValue: value === "all" ? "" : filters.attributeValue 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Svi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Svi</SelectItem>
                        {availableAttributes.map((attr) => (
                          <SelectItem key={attr.id} value={attr.id}>
                            {attr.code} - {attr.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Attribute Value Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Vrednost atributa</Label>
                    <Input
                      placeholder={filters.attributeId ? "Pretraži vrednost..." : "Izaberite atribut"}
                      value={filters.attributeValue}
                      onChange={(e) => setFilters({ ...filters, attributeValue: e.target.value })}
                      disabled={!filters.attributeId}
                    />
                  </div>

                  {/* Clear Filters */}
                  <div className="space-y-2 flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      disabled={!hasActiveFilters}
                      className="w-full"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Obriši filtere
                    </Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
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
            <div ref={tableContainerRef} className="overflow-x-auto max-h-[calc(100vh-350px)] overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr className="erp-table-header">
                    <th 
                      className="p-3 text-left font-medium cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('code')}
                    >
                      <div className="flex items-center">
                        Šifra
                        <SortIndicator column="code" />
                      </div>
                    </th>
                    <th 
                      className="p-3 text-left font-medium cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Naziv
                        <SortIndicator column="name" />
                      </div>
                    </th>
                    <th 
                      className="p-3 text-left font-medium cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('article_group')}
                    >
                      <div className="flex items-center">
                        Klasa
                        <SortIndicator column="article_group" />
                      </div>
                    </th>
                    <th 
                      className="p-3 text-center font-medium cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('svk')}
                    >
                      <div className="flex items-center justify-center">
                        SVK
                        <SortIndicator column="svk" />
                      </div>
                    </th>
                    <th 
                      className="p-3 text-left font-medium cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('unit')}
                    >
                      <div className="flex items-center">
                        JM
                        <SortIndicator column="unit" />
                      </div>
                    </th>
                    <th 
                      className="p-3 text-right font-medium cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('purchase_price')}
                    >
                      <div className="flex items-center justify-end">
                        Nabavna cena
                        <SortIndicator column="purchase_price" />
                      </div>
                    </th>
                    <th 
                      className="p-3 text-right font-medium cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('selling_price')}
                    >
                      <div className="flex items-center justify-end">
                        Prodajna cena
                        <SortIndicator column="selling_price" />
                      </div>
                    </th>
                    <th 
                      className="p-3 text-center font-medium cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('is_active')}
                    >
                      <div className="flex items-center justify-center">
                        Status
                        <SortIndicator column="is_active" />
                      </div>
                    </th>
                    <th className="w-12 p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedArticles.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        {searchTerm ? "Nema rezultata pretrage" : "Nema artikala"}
                      </td>
                    </tr>
                  ) : (
                    paginatedArticles.map((article, index) => (
                      <tr
                        key={article.id}
                        className="hover:bg-table-hover transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <td className="p-3">
                          <span className="font-mono text-sm text-primary">
                            {article.code}
                          </span>
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <InlineEditCell
                            value={article.name}
                            onSave={(val) => handleInlineEdit(article.id, 'name', val)}
                            disabled={!canEdit}
                            className="font-medium text-foreground"
                            isEditing={activeEditCell?.articleId === article.id && activeEditCell?.field === 'name'}
                            onStartEdit={() => setActiveEditCell({ articleId: article.id, field: 'name' })}
                            onTabNext={() => navigateToCell(article.id, 'name', 'next')}
                            onTabPrev={() => navigateToCell(article.id, 'name', 'prev')}
                            onCancel={() => setActiveEditCell(null)}
                          />
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <InlineClassificationCell
                            value={article.article_group}
                            classifications={classifications}
                            onSave={(code) => handleInlineEdit(article.id, 'article_group', code || '')}
                            disabled={!canEdit}
                            isEditing={activeEditCell?.articleId === article.id && activeEditCell?.field === 'article_group'}
                            onStartEdit={() => setActiveEditCell({ articleId: article.id, field: 'article_group' })}
                            onTabNext={() => navigateToCell(article.id, 'article_group', 'next')}
                            onTabPrev={() => navigateToCell(article.id, 'article_group', 'prev')}
                            onCancel={() => setActiveEditCell(null)}
                          />
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <InlineSelectCell
                            value={article.svk || "1"}
                            options={SVK_OPTIONS}
                            onSave={(val) => handleInlineEdit(article.id, 'svk', val)}
                            disabled={!canEdit}
                            displayValue={article.svk || "1"}
                            className="inline-flex items-center justify-center w-6 h-6 rounded bg-secondary text-secondary-foreground text-xs font-medium"
                          />
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <InlineEditCell
                            value={article.unit}
                            onSave={(val) => handleInlineEdit(article.id, 'unit', val)}
                            disabled={!canEdit}
                            className="text-muted-foreground"
                            isEditing={activeEditCell?.articleId === article.id && activeEditCell?.field === 'unit'}
                            onStartEdit={() => setActiveEditCell({ articleId: article.id, field: 'unit' })}
                            onTabNext={() => navigateToCell(article.id, 'unit', 'next')}
                            onTabPrev={() => navigateToCell(article.id, 'unit', 'prev')}
                            onCancel={() => setActiveEditCell(null)}
                          />
                        </td>
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <InlineEditCell
                            value={String(article.purchase_price)}
                            onSave={(val) => handleInlineEdit(article.id, 'purchase_price', val)}
                            type="number"
                            decimalPlaces={2}
                            disabled={!canEdit}
                            displayValue={formatPrice(article.purchase_price)}
                            className="font-mono"
                            isEditing={activeEditCell?.articleId === article.id && activeEditCell?.field === 'purchase_price'}
                            onStartEdit={() => setActiveEditCell({ articleId: article.id, field: 'purchase_price' })}
                            onTabNext={() => navigateToCell(article.id, 'purchase_price', 'next')}
                            onTabPrev={() => navigateToCell(article.id, 'purchase_price', 'prev')}
                            onCancel={() => setActiveEditCell(null)}
                          />
                        </td>
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <InlineEditCell
                            value={String(article.selling_price)}
                            onSave={(val) => handleInlineEdit(article.id, 'selling_price', val)}
                            type="number"
                            decimalPlaces={2}
                            disabled={!canEdit}
                            displayValue={formatPrice(article.selling_price)}
                            className="font-mono"
                            isEditing={activeEditCell?.articleId === article.id && activeEditCell?.field === 'selling_price'}
                            onStartEdit={() => setActiveEditCell({ articleId: article.id, field: 'selling_price' })}
                            onTabNext={() => navigateToCell(article.id, 'selling_price', 'next')}
                            onTabPrev={() => navigateToCell(article.id, 'selling_price', 'prev')}
                            onCancel={() => setActiveEditCell(null)}
                          />
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <InlineSelectCell
                            value={article.is_active ? "active" : "inactive"}
                            options={[
                              { value: "active", label: "Aktivan" },
                              { value: "inactive", label: "Neaktivan" },
                            ]}
                            onSave={async (val) => {
                              const isActive = val === "active";
                              await handleInlineEdit(article.id, 'is_active', String(isActive));
                            }}
                            disabled={!canEdit}
                            className={
                              article.is_active
                                ? "erp-badge-success"
                                : "erp-badge-destructive"
                            }
                          />
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end">
                            <button
                              className="p-1.5 rounded hover:bg-secondary transition-colors"
                              onClick={() => handleView(article)}
                              title="Pregled"
                            >
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                              className="p-1.5 rounded hover:bg-secondary transition-colors"
                              onClick={() => handleHistory(article)}
                              title="Istorija izmena"
                            >
                              <History className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="p-1.5 rounded hover:bg-secondary transition-colors relative"
                                  onClick={() => handleAttributes(article)}
                                >
                                  <Tags className="w-4 h-4 text-muted-foreground" />
                                  {getCount(article.id) > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[10px] font-medium bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                                      {getCount(article.id)}
                                    </span>
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                {getCount(article.id) > 0 ? (
                                  <div className="space-y-1">
                                    <p className="font-medium text-xs mb-1">Atributi:</p>
                                    {getAttributes(article.id).map((attr, idx) => (
                                      <div key={idx} className="text-xs">
                                        <span className="text-muted-foreground">{attr.name}:</span>{" "}
                                        <span>{attr.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs">Nema dodeljenih atributa</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                            {canEdit && (
                              <>
                                <button
                                  className="p-1.5 rounded hover:bg-secondary transition-colors"
                                  onClick={() => handleEdit(article)}
                                  title="Izmeni sve"
                                >
                                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                                </button>
                                <button
                                  className="p-1.5 rounded hover:bg-secondary transition-colors"
                                  onClick={() => handleDeleteClick(article)}
                                  title="Obriši"
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

            {/* Pagination */}
            <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Prikazano {startIndex + 1}-{Math.min(endIndex, sortedArticles.length)} od {sortedArticles.length} artikala
                  {sortedArticles.length !== articles.length && ` (ukupno ${articles.length})`}
                </p>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Po stranici:</Label>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      const newValue = Number(value);
                      setItemsPerPage(newValue);
                      setCurrentPage(1);
                      if (selectedCompany?.id && selectedYear?.id) {
                        localStorage.setItem(
                          `artikli-itemsPerPage-${selectedCompany.id}-${selectedYear.id}`,
                          value
                        );
                      }
                    }}
                  >
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1 mx-2">
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => goToPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Idi na stranicu:</Label>
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      className="w-16 h-8 text-center"
                      placeholder="1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const value = parseInt((e.target as HTMLInputElement).value);
                          if (value >= 1 && value <= totalPages) {
                            goToPage(value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">od {totalPages}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
              <Label htmlFor="group">Klasa</Label>
              <ClassificationTreePicker
                classifications={classifications}
                value={formData.article_group || null}
                onChange={(code) => setFormData({ ...formData, article_group: code || "" })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Nabavna cena</Label>
                <LocaleNumberInput
                  id="purchase_price"
                  value={formData.purchase_price}
                  onChange={(value) => setFormData({ ...formData, purchase_price: value })}
                  decimalPlaces={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="selling_price">Prodajna cena</Label>
                <LocaleNumberInput
                  id="selling_price"
                  value={formData.selling_price}
                  onChange={(value) => setFormData({ ...formData, selling_price: value })}
                  decimalPlaces={2}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Stanje zaliha</Label>
                <LocaleNumberInput
                  id="stock"
                  value={formData.stock}
                  onChange={(value) => setFormData({ ...formData, stock: value })}
                  decimalPlaces={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_stock">Minimalno stanje</Label>
                <LocaleNumberInput
                  id="min_stock"
                  value={formData.min_stock}
                  onChange={(value) => setFormData({ ...formData, min_stock: value })}
                  decimalPlaces={0}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="svk">Standardna vrsta knjiženja (SVK)</Label>
              <select
                id="svk"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.svk}
                onChange={(e) => setFormData({ ...formData, svk: e.target.value as SvkType })}
              >
                {SVK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="kg_po_jm">Masa (kg po JM)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-left">
                        <p className="font-medium mb-1">Masa proizvoda u kilogramima</p>
                        <p className="text-xs text-muted-foreground mb-2">Primeri:</p>
                        <ul className="text-xs space-y-1">
                          <li>• JM = kg → kgPoJM = 1, KolMas = 1</li>
                          <li>• JM = m, 1m = 1.321kg → kgPoJM = 1.321, KolMas = 1</li>
                          <li>• JM = m, 1m = 12.3g → kgPoJM = 12.300, KolMas = 1000</li>
                          <li>• JM = m, 1m = 12.5mg → kgPoJM = 12.500, KolMas = 1000000</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <LocaleNumberInput
                  id="kg_po_jm"
                  value={formData.kg_po_jm}
                  onChange={(value) => setFormData({ ...formData, kg_po_jm: value })}
                  decimalPlaces={3}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="kol_mas">Količina za masu</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-left">
                        <p className="font-medium mb-1">Količina za koju važi masa</p>
                        <p className="text-xs text-muted-foreground">
                          Koliko jedinica mere obuhvata navedena masa. Za kg = 1, za grame = 1000, za miligrame = 1000000.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <LocaleNumberInput
                  id="kol_mas"
                  value={formData.kol_mas}
                  onChange={(value) => setFormData({ ...formData, kol_mas: value })}
                  decimalPlaces={0}
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                <p className="text-sm text-muted-foreground">Klasa</p>
                <div className="font-medium">
                  <ClassificationBadge
                    code={viewingArticle.article_group}
                    classifications={classifications}
                    showFullPath
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nabavna cena</p>
                  <p className="font-medium">{formatPrice(viewingArticle.purchase_price)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prodajna cena</p>
                  <p className="font-medium">{formatPrice(viewingArticle.selling_price)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Stanje zaliha</p>
                  <p className="font-medium">{formatInteger(viewingArticle.stock)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Minimalno stanje</p>
                  <p className="font-medium">{formatInteger(viewingArticle.min_stock)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Standardna vrsta knjiženja (SVK)</p>
                <p className="font-medium">
                  {SVK_OPTIONS.find(o => o.value === viewingArticle.svk)?.label || viewingArticle.svk || "1 - Roba"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Masa (kg po JM)</p>
                  <p className="font-medium">{formatDecimal(viewingArticle.kg_po_jm ?? 0, 3)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Količina za masu</p>
                  <p className="font-medium">{formatInteger(viewingArticle.kol_mas ?? 1)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <span className={viewingArticle.is_active ? "erp-badge-success" : "erp-badge-destructive"}>
                  {viewingArticle.is_active ? "Aktivan" : "Neaktivan"}
                </span>
              </div>

              {/* Attributes section */}
              <div className="border-t pt-3 mt-2">
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                  <Tags className="w-4 h-4" />
                  Dodeljeni atributi ({getCount(viewingArticle.id)})
                </p>
                {getCount(viewingArticle.id) > 0 ? (
                  <div className="max-h-48 overflow-y-auto border rounded-md">
                    <table className="w-full text-sm table-fixed">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium w-16">Šifra</th>
                          <th className="text-left px-3 py-2 font-medium w-28">Naziv</th>
                          <th className="text-left px-3 py-2 font-medium">Vrednost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getAttributes(viewingArticle.id).map((attr, idx) => (
                          <tr key={idx} className="border-t align-top">
                            <td className="px-3 py-2 font-mono text-xs">{attr.code}</td>
                            <td className="px-3 py-2">{attr.name}</td>
                            <td className="px-3 py-2 font-medium whitespace-pre-wrap break-words">{attr.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nema dodeljenih atributa</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="ghost" 
              onClick={() => {
                if (viewingArticle) {
                  handleHistory(viewingArticle);
                }
              }}
            >
              <History className="w-4 h-4 mr-2" />
              Istorija
            </Button>
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

      {/* Export Dialog */}
      <ExportColumnsDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        articles={sortedArticles}
        companyName={selectedCompany?.name}
      />

      {/* History Dialog */}
      {historyArticle && (
        <ArticleHistoryDialog
          open={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
          articleId={historyArticle.id}
          articleName={historyArticle.name}
        />
      )}

      {/* Attributes Dialog */}
      {selectedCompany && (
        <ArticleAttributesDialog
          article={attributesArticle}
          companyId={selectedCompany.id}
          open={isAttributesOpen}
          onOpenChange={(open) => {
            setIsAttributesOpen(open);
            if (!open) {
              // Refresh attribute counts when dialog closes
              refetchAttributeCounts();
            }
          }}
        />
      )}

      {/* API Dialog */}
      <ArticleApiDialog
        open={isApiOpen}
        onOpenChange={setIsApiOpen}
      />

    </MainLayout>
  );
}
