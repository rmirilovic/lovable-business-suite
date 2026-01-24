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
  Building,
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
import { Switch } from "@/components/ui/switch";
import { useOrganizationalUnits, buildOrgTree, flattenOrgTree, OrganizationalUnit, OrganizationalUnitNode } from "@/hooks/useOrganizationalUnits";
import { cn } from "@/lib/utils";

interface OrgUnitForm {
  code: string;
  name: string;
  parent_code: string;
  is_active: boolean;
}

interface ImportRow {
  code: string;
  name: string;
  parent_code?: string | null;
  is_active?: boolean;
}

const emptyForm: OrgUnitForm = {
  code: "",
  name: "",
  parent_code: "",
  is_active: true,
};

export default function OrganizacioneJedinice() {
  const { selectedCompany, isSuperAdmin, isLocalAdmin } = useAuth();
  
  const {
    units,
    isLoading: loading,
    isFetching,
    refetch,
  } = useOrganizationalUnits(selectedCompany?.id);

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<OrganizationalUnit | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<OrganizationalUnit | null>(null);
  const [formData, setFormData] = useState<OrgUnitForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = isSuperAdmin || isLocalAdmin;

  // Build tree structure
  const tree = useMemo(() => buildOrgTree(units), [units]);
  
  // Flatten for display
  const flatList = useMemo(() => flattenOrgTree(tree), [tree]);

  // Filter by search
  const filteredList = useMemo(() => {
    if (!searchTerm) return flatList;
    
    const term = searchTerm.toLowerCase();
    const matchingCodes = new Set<string>();
    
    // Find all matching nodes and their ancestors
    units.forEach((u) => {
      if (u.code.toLowerCase().includes(term) || u.name.toLowerCase().includes(term)) {
        matchingCodes.add(u.code);
        // Add all ancestors
        let parentCode = u.parent_code;
        while (parentCode) {
          matchingCodes.add(parentCode);
          const parent = units.find((p) => p.code === parentCode);
          parentCode = parent?.parent_code || null;
        }
      }
    });

    return flatList.filter((node) => matchingCodes.has(node.code));
  }, [flatList, searchTerm, units]);

  // Get potential parents for dropdown
  const potentialParents = useMemo(() => {
    if (editingUnit) {
      const descendants = new Set<string>();
      const findDescendants = (code: string) => {
        descendants.add(code);
        units
          .filter((u) => u.parent_code === code)
          .forEach((u) => findDescendants(u.code));
      };
      findDescendants(editingUnit.code);
      return units.filter((u) => !descendants.has(u.code));
    }
    return units;
  }, [units, editingUnit]);

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
    const allCodes = units.map((u) => u.code);
    setExpandedNodes(new Set(allCodes));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const hasChildren = (code: string) => {
    return units.some((u) => u.parent_code === code);
  };

  const isVisible = (node: OrganizationalUnitNode) => {
    let parentCode = node.parent_code;
    while (parentCode) {
      if (!expandedNodes.has(parentCode)) return false;
      const parent = units.find((u) => u.code === parentCode);
      parentCode = parent?.parent_code || null;
    }
    return true;
  };

  const handleAdd = (parentCode?: string) => {
    setEditingUnit(null);
    setFormData({
      ...emptyForm,
      parent_code: parentCode || "",
    });
    setIsFormOpen(true);
  };

  const handleEdit = (unit: OrganizationalUnit) => {
    setEditingUnit(unit);
    setFormData({
      code: unit.code,
      name: unit.name,
      parent_code: unit.parent_code || "",
      is_active: unit.is_active,
    });
    setIsFormOpen(true);
  };

  const handleDeleteClick = (unit: OrganizationalUnit) => {
    setDeletingUnit(unit);
    setIsDeleteOpen(true);
  };

  const handleSave = async () => {
    if (!selectedCompany) return;
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Šifra i naziv su obavezni");
      return;
    }

    // Validate parent_code exists if specified
    if (formData.parent_code && !units.some((u) => u.code === formData.parent_code)) {
      toast.error("Nadređena jedinica sa tom šifrom ne postoji");
      return;
    }

    setSaving(true);
    try {
      const data = {
        company_id: selectedCompany.id,
        code: formData.code.trim(),
        name: formData.name.trim(),
        parent_code: formData.parent_code.trim() || null,
        is_active: formData.is_active,
      };

      if (editingUnit) {
        const { error } = await supabase
          .from("organizational_units")
          .update(data)
          .eq("id", editingUnit.id);

        if (error) throw error;
        toast.success("Organizaciona jedinica uspešno ažurirana");
      } else {
        const { error } = await supabase
          .from("organizational_units")
          .insert(data);

        if (error) {
          if (error.code === "23505") {
            toast.error("Organizaciona jedinica sa tom šifrom već postoji");
            return;
          }
          throw error;
        }
        toast.success("Organizaciona jedinica uspešno kreirana");
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
    if (!deletingUnit) return;

    // Check if has children
    if (hasChildren(deletingUnit.code)) {
      toast.error("Ne možete obrisati jedinicu koja ima podjedinice");
      setIsDeleteOpen(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("organizational_units")
        .delete()
        .eq("id", deletingUnit.id);

      if (error) throw error;
      toast.success("Organizaciona jedinica uspešno obrisana");
      setIsDeleteOpen(false);
      setDeletingUnit(null);
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
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!Array.isArray(data)) {
          toast.error("JSON fajl mora sadržati niz objekata");
          return;
        }
        
        const rows: ImportRow[] = data.map((item: any) => ({
          code: String(item.code || item.šifra || item.sifra || "").trim(),
          name: String(item.name || item.naziv || item.ime || "").trim(),
          parent_code: item.parent_code || item.nadšifra || item.nadsifra || item.parent || null,
          is_active: item.is_active !== undefined ? Boolean(item.is_active) : 
                     item.aktivno !== undefined ? (item.aktivno === 1 || item.aktivno === true || item.aktivno === "DA") : true,
        })).filter((r: ImportRow) => r.code && r.name);
        
        setImportPreview(rows);
        
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        
        const rows: ImportRow[] = (jsonData as any[]).map((item) => {
          const code = item.code || item.Code || item.CODE || 
                       item.šifra || item.Šifra || item.ŠIFRA ||
                       item.sifra || item.Sifra || item.SIFRA || "";
          
          const name = item.name || item.Name || item.NAME ||
                       item.naziv || item.Naziv || item.NAZIV ||
                       item.ime || item.Ime || item.IME || "";
          
          const parent_code = item.parent_code || item.Parent_code || item.PARENT_CODE ||
                              item.nadšifra || item.Nadšifra || item.NADŠIFRA ||
                              item.nadsifra || item.Nadsifra || item.NADSIFRA ||
                              item.parent || item.Parent || item.PARENT || null;
          
          const isActiveRaw = item.is_active ?? item.Is_active ?? item.IS_ACTIVE ??
                              item.aktivno ?? item.Aktivno ?? item.AKTIVNO ?? true;
          
          let is_active = true;
          if (typeof isActiveRaw === "boolean") {
            is_active = isActiveRaw;
          } else if (typeof isActiveRaw === "number") {
            is_active = isActiveRaw === 1;
          } else if (typeof isActiveRaw === "string") {
            is_active = isActiveRaw.toUpperCase() === "DA" || isActiveRaw === "1";
          }
          
          return {
            code: String(code).trim(),
            name: String(name).trim(),
            parent_code: parent_code ? String(parent_code).trim() : null,
            is_active,
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
      // Sort by parent_code to insert parents first
      const sortedRows = [...importPreview].sort((a, b) => {
        if (!a.parent_code && b.parent_code) return -1;
        if (a.parent_code && !b.parent_code) return 1;
        return (a.parent_code || "").length - (b.parent_code || "").length;
      });

      const batchSize = 100;
      let inserted = 0;
      let skipped = 0;

      for (let i = 0; i < sortedRows.length; i += batchSize) {
        const batch = sortedRows.slice(i, i + batchSize).map((row) => ({
          company_id: selectedCompany.id,
          code: row.code,
          name: row.name,
          parent_code: row.parent_code || null,
          is_active: row.is_active ?? true,
        }));

        const { error } = await supabase
          .from("organizational_units")
          .upsert(batch, { 
            onConflict: "company_id,code",
            ignoreDuplicates: false
          });

        if (error) {
          console.error("Batch insert error:", error);
          for (const item of batch) {
            const { error: singleError } = await supabase
              .from("organizational_units")
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

      toast.success(`Uvezeno ${inserted} organizacionih jedinica${skipped > 0 ? `, preskočeno ${skipped}` : ""}`);
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

  const getChildCount = (code: string): number => {
    const directChildren = units.filter((u) => u.parent_code === code);
    return directChildren.reduce((acc, child) => acc + 1 + getChildCount(child.code), 0);
  };

  if (!selectedCompany) {
    return (
      <MainLayout title="Organizacione jedinice">
        <div className="erp-card p-8 text-center text-muted-foreground">
          Molimo izaberite firmu
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Organizacione jedinice">
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
                  size="icon"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Osveži</TooltipContent>
            </Tooltip>
            {canEdit && (
              <Button onClick={() => handleAdd()} className="gap-2">
                <Plus className="w-4 h-4" />
                Nova jedinica
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tree View */}
      <div className="erp-card">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {searchTerm ? "Nema rezultata pretrage" : "Nema organizacionih jedinica"}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredList.map((node) => {
              if (!isVisible(node)) return null;
              
              const hasChildNodes = hasChildren(node.code);
              const isExpanded = expandedNodes.has(node.code);
              const childCount = getChildCount(node.code);
              
              return (
                <div
                  key={node.id}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 hover:bg-muted/50 transition-colors",
                    !node.is_active && "opacity-60"
                  )}
                  style={{ paddingLeft: `${node.level * 24 + 16}px` }}
                >
                  {/* Expand/collapse button */}
                  <button
                    className={cn(
                      "w-6 h-6 flex items-center justify-center rounded hover:bg-muted",
                      !hasChildNodes && "invisible"
                    )}
                    onClick={() => toggleExpand(node.code)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  {/* Icon */}
                  {hasChildNodes ? (
                    isExpanded ? (
                      <FolderOpen className="w-5 h-5 text-primary" />
                    ) : (
                      <Building className="w-5 h-5 text-primary" />
                    )
                  ) : (
                    <Building className="w-5 h-5 text-muted-foreground" />
                  )}
                  
                  {/* Code & Name */}
                  <div className="flex-1 flex items-center gap-4 min-w-0">
                    <span className="font-mono text-sm font-medium whitespace-nowrap">
                      {node.code}
                    </span>
                    <span className="truncate">{node.name}</span>
                    {!node.is_active && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">Neaktivno</span>
                    )}
                    {childCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({childCount})
                      </span>
                    )}
                  </div>
                  
                  {/* Actions */}
                  {canEdit && (
                    <div className="flex items-center gap-1">
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
                        <TooltipContent>Dodaj podjedinice</TooltipContent>
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUnit ? "Izmeni organizacionu jedinicu" : "Nova organizaciona jedinica"}
            </DialogTitle>
            <DialogDescription>
              {editingUnit 
                ? "Izmenite podatke organizacione jedinice"
                : "Unesite podatke za novu organizacionu jedinicu"
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Šifra *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                disabled={!!editingUnit}
                placeholder="npr. 01, 0101, ..."
              />
              {editingUnit && (
                <p className="text-xs text-muted-foreground">
                  Šifra se ne može menjati nakon kreiranja
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Naziv *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="npr. Prodaja, Administracija, ..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="parent">Nadređena jedinica</Label>
              <Select
                value={formData.parent_code}
                onValueChange={(value) => setFormData({ ...formData, parent_code: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Bez nadređene (korenski nivo)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Bez nadređene (korenski nivo)</SelectItem>
                  {potentialParents.map((u) => (
                    <SelectItem key={u.id} value={u.code}>
                      {u.code} - {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Aktivno</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Odustani
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sačuvaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obriši organizacionu jedinicu?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete jedinicu "{deletingUnit?.name}"?
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
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Uvoz organizacionih jedinica
            </DialogTitle>
            <DialogDescription>
              Podržani formati: Excel (.xlsx, .xls) i JSON
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {importPreview.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <div className="flex justify-center gap-4 mb-4">
                  <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
                  <FileJson className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Fajl mora sadržati kolone: Šifra, Naziv, Nadšifra (opciono), Aktivno (opciono)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()}>
                  Izaberi fajl
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    Pronađeno {importPreview.length} jedinica
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setImportPreview([]);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Poništi
                  </Button>
                </div>
                <div className="border rounded-lg max-h-64 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">Šifra</th>
                        <th className="text-left p-2">Naziv</th>
                        <th className="text-left p-2">Nadšifra</th>
                        <th className="text-left p-2">Aktivno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-mono">{row.code}</td>
                          <td className="p-2">{row.name}</td>
                          <td className="p-2 text-muted-foreground">
                            {row.parent_code || "-"}
                          </td>
                          <td className="p-2">
                            {row.is_active ? "Da" : "Ne"}
                          </td>
                        </tr>
                      ))}
                      {importPreview.length > 10 && (
                        <tr className="border-t">
                          <td colSpan={4} className="p-2 text-center text-muted-foreground">
                            ... i još {importPreview.length - 10} jedinica
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>
              Zatvori
            </Button>
            {importPreview.length > 0 && (
              <Button onClick={handleImport} disabled={importing}>
                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Uvezi {importPreview.length} jedinica
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
