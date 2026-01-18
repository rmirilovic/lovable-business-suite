import { useState, useMemo } from "react";
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

interface ClassificationForm {
  code: string;
  name: string;
  parent_code: string;
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
  const [editingClassification, setEditingClassification] = useState<Classification | null>(null);
  const [deletingClassification, setDeletingClassification] = useState<Classification | null>(null);
  const [formData, setFormData] = useState<ClassificationForm>(emptyForm);
  const [saving, setSaving] = useState(false);

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
      <div className="erp-card">
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
          <div className="divide-y divide-border">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-muted/50 text-sm font-medium text-muted-foreground">
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
    </MainLayout>
  );
}
