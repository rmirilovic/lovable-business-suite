import { useState, useMemo, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Search,
  Loader2,
  FolderTree,
  Folder,
  FolderOpen,
  Upload,
  FileSpreadsheet,
  FileJson,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useClassifications, buildTree, flattenTree, Classification, ClassificationNode } from "@/hooks/useClassifications";
import { cn } from "@/lib/utils";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";

interface ClassificationForm {
  code: string;
  name: string;
  parent_code: string;
}

interface ImportRow {
  code: string;
  name: string;
  parent_code?: string | null;
}

const emptyForm: ClassificationForm = {
  code: "",
  name: "",
  parent_code: "",
};

export default function KlasifikacijaArtikala() {
  const { selectedCompany, isSuperAdmin, isLocalAdmin } = useAuth();
  
  const {
    classifications,
    isLoading: loading,
    isFetching,
    refetch,
  } = useClassifications(selectedCompany?.id);

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingClassification, setEditingClassification] = useState<Classification | null>(null);
  const [deletingClassification, setDeletingClassification] = useState<Classification | null>(null);
  const [formData, setFormData] = useState<ClassificationForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = isSuperAdmin || isLocalAdmin;

  // Build tree structure
  const tree = useMemo(() => buildTree(classifications), [classifications]);
  
  // Flatten for display
  const flatList = useMemo(() => flattenTree(tree), [tree]);

  // Filter by search
  const filteredList = useMemo(() => {
    if (!searchTerm) return flatList;
    
    const term = searchTerm.toLowerCase();
    const matchingCodes = new Set<string>();
    
    // Find all matching nodes and their ancestors
    classifications.forEach((c) => {
      if (c.code.toLowerCase().includes(term) || c.name.toLowerCase().includes(term)) {
        matchingCodes.add(c.code);
        // Add all ancestors
        let parentCode = c.parent_code;
        while (parentCode) {
          matchingCodes.add(parentCode);
          const parent = classifications.find((p) => p.code === parentCode);
          parentCode = parent?.parent_code || null;
        }
      }
    });

    return flatList.filter((node) => matchingCodes.has(node.code));
  }, [flatList, searchTerm, classifications]);

  // Get root-level classifications for parent dropdown
  const potentialParents = useMemo(() => {
    // When editing, exclude the current node and its descendants
    if (editingClassification) {
      const descendants = new Set<string>();
      const findDescendants = (code: string) => {
        descendants.add(code);
        classifications
          .filter((c) => c.parent_code === code)
          .forEach((c) => findDescendants(c.code));
      };
      findDescendants(editingClassification.code);
      return classifications.filter((c) => !descendants.has(c.code));
    }
    return classifications;
  }, [classifications, editingClassification]);

  const toggleExpand = (code: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allCodes = classifications.map((c) => c.code);
    setExpandedNodes(new Set(allCodes));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const hasChildren = (code: string) => {
    return classifications.some((c) => c.parent_code === code);
  };

  const isVisible = (node: ClassificationNode) => {
    // Check if all ancestors are expanded
    let parentCode = node.parent_code;
    while (parentCode) {
      if (!expandedNodes.has(parentCode)) return false;
      const parent = classifications.find((c) => c.code === parentCode);
      parentCode = parent?.parent_code || null;
    }
    return true;
  };

  const handleAdd = (parentCode?: string) => {
    setEditingClassification(null);
    setFormData({
      ...emptyForm,
      parent_code: parentCode || "",
    });
    setIsFormOpen(true);
  };

  const handleEdit = (classification: Classification) => {
    setEditingClassification(classification);
    setFormData({
      code: classification.code,
      name: classification.name,
      parent_code: classification.parent_code || "",
    });
    setIsFormOpen(true);
  };

  const handleDeleteClick = (classification: Classification) => {
    setDeletingClassification(classification);
    setIsDeleteOpen(true);
  };

  const handleSave = async () => {
    if (!selectedCompany) return;
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Šifra i naziv su obavezni");
      return;
    }

    // Validate parent_code exists if specified
    if (formData.parent_code && !classifications.some((c) => c.code === formData.parent_code)) {
      toast.error("Nadklasa sa tom šifrom ne postoji");
      return;
    }

    setSaving(true);
    try {
      const data = {
        company_id: selectedCompany.id,
        code: formData.code.trim(),
        name: formData.name.trim(),
        parent_code: formData.parent_code.trim() || null,
      };

      if (editingClassification) {
        const { error } = await supabase
          .from("article_classifications")
          .update(data)
          .eq("id", editingClassification.id);

        if (error) throw error;
        toast.success("Klasifikacija uspešno ažurirana");
      } else {
        const { error } = await supabase
          .from("article_classifications")
          .insert(data);

        if (error) {
          if (error.code === "23505") {
            toast.error("Klasifikacija sa tom šifrom već postoji");
            return;
          }
          throw error;
        }
        toast.success("Klasifikacija uspešno kreirana");
      }

      setIsFormOpen(false);
      refetch();
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingClassification) return;

    // Check if has children
    if (hasChildren(deletingClassification.code)) {
      toast.error("Ne možete obrisati klasifikaciju koja ima podklase");
      setIsDeleteOpen(false);
      return;
    }

    // Check if any articles are assigned to this classification
    try {
      const { count, error: countError } = await supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("company_id", selectedCompany?.id)
        .eq("article_group", deletingClassification.code);

      if (countError) throw countError;

      if (count && count > 0) {
        toast.error(`Ne možete obrisati klasifikaciju kojoj ${count === 1 ? 'je dodeljen 1 artikal' : `su dodeljena ${count} artikla`}`);
        setIsDeleteOpen(false);
        return;
      }
    } catch (error: any) {
      toast.error("Greška pri proveri artikala: " + error.message);
      return;
    }

    try {
      const { error } = await supabase
        .from("article_classifications")
        .delete()
        .eq("id", deletingClassification.id);

      if (error) throw error;
      toast.success("Klasifikacija uspešno obrisana");
      setIsDeleteOpen(false);
      setDeletingClassification(null);
      refetch();
    } catch (error: any) {
      toast.error("Greška pri brisanju: " + error.message);
    }
  };

  // Handle file selection for import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith(".json")) {
        // Parse JSON
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!Array.isArray(data)) {
          toast.error("JSON fajl mora sadržati niz objekata");
          return;
        }
        
        const rows: ImportRow[] = data.map((item: any) => ({
          code: String(item.code || item.šifra || item.sifra || "").trim(),
          name: String(item.name || item.naziv || item.ime || "").trim(),
          parent_code: item.parent_code || item.nadklasa || item.parent || null,
        })).filter((r: ImportRow) => r.code && r.name);
        
        setImportPreview(rows);
        
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        // Parse Excel
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        
        const rows: ImportRow[] = (jsonData as any[]).map((item) => {
          // Find code column
          const code = item.code || item.Code || item.CODE || 
                       item.šifra || item.Šifra || item.ŠIFRA ||
                       item.sifra || item.Sifra || item.SIFRA || "";
          
          // Find name column
          const name = item.name || item.Name || item.NAME ||
                       item.naziv || item.Naziv || item.NAZIV ||
                       item.ime || item.Ime || item.IME || "";
          
          // Find parent_code column
          const parent_code = item.parent_code || item.Parent_code || item.PARENT_CODE ||
                              item.nadklasa || item.Nadklasa || item.NADKLASA ||
                              item.parent || item.Parent || item.PARENT || null;
          
          return {
            code: String(code).trim(),
            name: String(name).trim(),
            parent_code: parent_code ? String(parent_code).trim() : null,
          };
        }).filter((r) => r.code && r.name);
        
        setImportPreview(rows);
        
      } else {
        toast.error("Nepodržan format fajla. Koristite .xlsx, .xls ili .json");
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Greška pri čitanju fajla: " + error.message);
    }
  };

  // Handle import execution
  const handleImport = async () => {
    if (!selectedCompany || importPreview.length === 0) return;

    setImporting(true);
    try {
      // Sort by parent_code to insert parents first (null parents first)
      const sortedRows = [...importPreview].sort((a, b) => {
        if (!a.parent_code && b.parent_code) return -1;
        if (a.parent_code && !b.parent_code) return 1;
        return (a.parent_code || "").length - (b.parent_code || "").length;
      });

      // Insert in batches
      const batchSize = 100;
      let inserted = 0;
      let skipped = 0;

      for (let i = 0; i < sortedRows.length; i += batchSize) {
        const batch = sortedRows.slice(i, i + batchSize).map((row) => ({
          company_id: selectedCompany.id,
          code: row.code,
          name: row.name,
          parent_code: row.parent_code || null,
        }));

        const { error } = await supabase
          .from("article_classifications")
          .upsert(batch, { 
            onConflict: "company_id,code",
            ignoreDuplicates: false
          });

        if (error) {
          console.error("Batch insert error:", error);
          // Try individual inserts for this batch
          for (const item of batch) {
            const { error: singleError } = await supabase
              .from("article_classifications")
              .upsert(item, { onConflict: "company_id,code" });
            
            if (singleError) {
              console.warn(`Skipped ${item.code}:`, singleError.message);
              skipped++;
            } else {
              inserted++;
            }
          }
        } else {
          inserted += batch.length;
        }
      }

      toast.success(`Uvezeno ${inserted} klasifikacija${skipped > 0 ? `, preskočeno ${skipped}` : ""}`);
      setIsImportOpen(false);
      setImportPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      refetch();
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Greška pri uvozu: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  // Count children for a node
  const getChildCount = (code: string): number => {
    const directChildren = classifications.filter((c) => c.parent_code === code);
    return directChildren.reduce((acc, child) => acc + 1 + getChildCount(child.code), 0);
  };

  if (!selectedCompany) {
    return (
      <MainLayout title="Klasifikacija artikala">
        <div className="erp-card p-8 text-center text-muted-foreground">
          Molimo izaberite firmu
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Klasifikacija artikala">
      <div className="flex flex-col flex-1 min-h-0 space-y-6">
        {/* Toolbar */}
        <div className="erp-card p-4">
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
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={expandAll}
              className="gap-2"
            >
              <ChevronDown className="w-4 h-4" />
              Proširi sve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAll}
              className="gap-2"
            >
              <ChevronRight className="w-4 h-4" />
              Skupi sve
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="gap-2"
                >
                  <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
                  <span className="hidden md:inline">Osveži</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Osveži listu klasifikacija</p>
              </TooltipContent>
            </Tooltip>
            {canEdit && (
              <Button onClick={() => handleAdd()} className="gap-2">
                <Plus className="w-4 h-4" />
                Nova klasifikacija
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tree View */}
      <div className="erp-card flex-1 min-h-0 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderTree className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {searchTerm
                ? "Nema rezultata pretrage"
                : "Nema definisanih klasifikacija. Kliknite 'Nova klasifikacija' za dodavanje."}
            </p>
          </div>
        ) : (
          <TableScrollContainer>
            <div className="divide-y divide-border">
              {/* Sticky header */}
              <div className="sticky top-0 z-20 grid grid-cols-12 gap-4 px-4 py-3 bg-table-header text-sm font-medium text-muted-foreground shadow-[0_1px_0_0_hsl(var(--border))]">
                <div className="col-span-6">Naziv klasifikacije</div>
                <div className="col-span-2">Šifra</div>
                <div className="col-span-2">Nadklasa</div>
                <div className="col-span-2 text-right">Akcije</div>
              </div>

              {/* Tree Items */}
              {filteredList.map((node) => {
              if (!isVisible(node)) return null;
              
              const hasChildNodes = hasChildren(node.code);
              const isExpanded = expandedNodes.has(node.code);
              const childCount = getChildCount(node.code);

              return (
                <div
                  key={node.id}
                  className={cn(
                    "grid grid-cols-12 gap-4 px-4 py-3 hover:bg-muted/30 transition-colors items-center",
                    node.level > 0 && "bg-muted/10"
                  )}
                >
                  <div className="col-span-6 flex items-center gap-2">
                    {/* Indentation */}
                    <div style={{ width: node.level * 24 }} />
                    
                    {/* Expand/Collapse button */}
                    {hasChildNodes ? (
                      <button
                        onClick={() => toggleExpand(node.code)}
                        className="p-1 hover:bg-muted rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      <div className="w-6" />
                    )}
                    
                    {/* Folder icon */}
                    {hasChildNodes ? (
                      isExpanded ? (
                        <FolderOpen className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Folder className="w-5 h-5 text-amber-500" />
                      )
                    ) : (
                      <Folder className="w-5 h-5 text-muted-foreground/50" />
                    )}
                    
                    {/* Name */}
                    <span className={cn("font-medium", node.level === 0 && "text-primary")}>
                      {node.name}
                    </span>
                    
                    {/* Child count badge */}
                    {childCount > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                        {childCount}
                      </span>
                    )}
                  </div>
                  
                  <div className="col-span-2 font-mono text-sm">
                    {node.code}
                  </div>
                  
                  <div className="col-span-2 text-sm text-muted-foreground font-mono">
                    {node.parent_code || "-"}
                  </div>
                  
                  <div className="col-span-2 flex justify-end gap-1">
                    {canEdit && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleAdd(node.code)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Dodaj podklasu</TooltipContent>
                        </Tooltip>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(node)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Izmeni</TooltipContent>
                        </Tooltip>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(node)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Obriši</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          </TableScrollContainer>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingClassification ? "Izmeni klasifikaciju" : "Nova klasifikacija"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Šifra klase *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="npr. 021211"
                disabled={!!editingClassification}
              />
              {editingClassification && (
                <p className="text-xs text-muted-foreground">
                  Šifra se ne može menjati nakon kreiranja
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Naziv klase *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="npr. UK PVC Korugovane cevi SN4"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="parent_code">Nadklasa (šifra)</Label>
              <Select
                value={formData.parent_code || "none"}
                onValueChange={(value) => setFormData({ ...formData, parent_code: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Bez nadklase (glavni nivo)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez nadklase (glavni nivo)</SelectItem>
                  {potentialParents.map((c) => (
                    <SelectItem key={c.id} value={c.code}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ostavite prazno ako je ovo glavni nivo klasifikacije
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Odustani
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingClassification ? "Sačuvaj" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potvrda brisanja</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete klasifikaciju{" "}
              <strong>{deletingClassification?.code} - {deletingClassification?.name}</strong>?
              <br />
              <br />
              Ova akcija se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={(open) => {
        setIsImportOpen(open);
        if (!open) {
          setImportPreview([]);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Uvoz klasifikacija</DialogTitle>
            <DialogDescription>
              Uvezite klasifikacije iz Excel (.xlsx, .xls) ili JSON fajla
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
            {/* File input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.json"
              className="hidden"
              onChange={handleFileSelect}
            />
            
            {importPreview.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
                <div className="flex gap-4 mb-6">
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="w-12 h-12 text-green-600" />
                    <span className="text-sm text-muted-foreground">Excel</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <FileJson className="w-12 h-12 text-amber-600" />
                    <span className="text-sm text-muted-foreground">JSON</span>
                  </div>
                </div>
                
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Izaberi fajl
                </Button>
                
                <div className="mt-6 text-sm text-muted-foreground max-w-md text-center">
                  <p className="font-medium mb-2">Format fajla:</p>
                  <p>Excel: Kolone "code" (ili "šifra"), "name" (ili "naziv"), "parent_code" (ili "nadklasa")</p>
                  <p className="mt-2">JSON: Niz objekata sa poljima code, name, parent_code</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Pronađeno {importPreview.length} klasifikacija za uvoz
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setImportPreview([]);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Promeni fajl
                  </Button>
                </div>
                
                {/* Preview table */}
                <div className="flex-1 overflow-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Šifra</th>
                        <th className="text-left px-3 py-2 font-medium">Naziv</th>
                        <th className="text-left px-3 py-2 font-medium">Nadklasa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importPreview.slice(0, 100).map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono">{row.code}</td>
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">
                            {row.parent_code || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.length > 100 && (
                    <p className="text-center py-2 text-sm text-muted-foreground">
                      ... i još {importPreview.length - 100} klasifikacija
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>
              Odustani
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={importing || importPreview.length === 0}
            >
              {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Uvezi {importPreview.length > 0 ? `(${importPreview.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </MainLayout>
  );
}
