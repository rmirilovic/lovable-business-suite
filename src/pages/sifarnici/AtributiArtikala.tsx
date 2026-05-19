import { useState, useMemo, Fragment, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Loader2,
  Tags,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import {
  useArticleAttributes,
  usePredefinedValues,
  ArticleAttribute,
  AttributePredefinedValue,
  AttributeDataType,
  DATA_TYPE_LABELS,
  DATA_TYPE_SHORT_LABELS,
} from "@/hooks/useArticleAttributes";
import { usePermissions } from "@/hooks/usePermissions";

interface AttributeForm {
  code: string;
  name: string;
  data_type: AttributeDataType;
  is_repeatable: boolean;
}

interface PredefinedValueForm {
  value: string;
  sort_order: number;
}

const emptyForm: AttributeForm = {
  code: "",
  name: "",
  data_type: "string",
  is_repeatable: false,
};

export default function AtributiArtikala() {
  const { selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  
  // Check if user has write access to article attributes module
  const canEdit = hasAccess("sifarnici.atributi", "write");

  const {
    attributes,
    isLoading: loading,
    isFetching,
    refetch,
  } = useArticleAttributes(selectedCompany?.id);

  const ATRIBUTI_KEY = "atributi_artikala_view_state";
  const savedAt = (() => { try { const r = sessionStorage.getItem(ATRIBUTI_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; } })();

  const [searchTerm, setSearchTerm] = useState(savedAt.searchTerm ?? "");
  const [expandedAttributes, setExpandedAttributes] = useState<Set<string>>(() => {
    if (savedAt.expandedAttributes) return new Set(savedAt.expandedAttributes);
    return new Set();
  });

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<ArticleAttribute | null>(null);
  const [deletingAttribute, setDeletingAttribute] = useState<ArticleAttribute | null>(null);
  const [formData, setFormData] = useState<AttributeForm>(emptyForm);
  const [predefinedValuesCount, setPredefinedValuesCount] = useState<number | null>(null);
  const [checkingPredefined, setCheckingPredefined] = useState(false);

  // Check predefined values count when editing an attribute with type "predefined"
  useEffect(() => {
    const checkPredefinedValues = async () => {
      if (!editingAttribute || formData.data_type !== "predefined") {
        setPredefinedValuesCount(null);
        return;
      }

      setCheckingPredefined(true);
      try {
        const { count, error } = await supabase
          .from("article_attribute_predefined_values")
          .select("*", { count: "exact", head: true })
          .eq("attribute_id", editingAttribute.id);

        if (!error) {
          setPredefinedValuesCount(count ?? 0);
        }
      } catch {
        // Ignore errors
      } finally {
        setCheckingPredefined(false);
      }
    };

    checkPredefinedValues();
  }, [editingAttribute, formData.data_type]);

  // For new attributes, predefined count is 0 if type is predefined
  const isPredefinedType = formData.data_type === "predefined";
  const isNewAttribute = !editingAttribute;
  const hasPredefinedWarning = isPredefinedType && (
    (isNewAttribute) || 
    (predefinedValuesCount !== null && predefinedValuesCount === 0)
  );
  const canSave = !hasPredefinedWarning || !isNewAttribute;

  // Sorting
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort(savedAt.sortColumn ?? null, savedAt.sortDirection ?? "asc");

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);

  useEffect(() => {
    sessionStorage.setItem(ATRIBUTI_KEY, JSON.stringify({
      searchTerm, expandedAttributes: Array.from(expandedAttributes), sortColumn, sortDirection,
      scrollTop: tableScrollRef.current?.scrollTop ?? 0,
    }));
  }, [searchTerm, expandedAttributes, sortColumn, sortDirection]);

  useEffect(() => {
    if (!loading && !restoredScrollRef.current && tableScrollRef.current && savedAt.scrollTop) {
      restoredScrollRef.current = true;
      requestAnimationFrame(() => { if (tableScrollRef.current) tableScrollRef.current.scrollTop = savedAt.scrollTop; });
    }
  }, [loading]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const h = () => { try { const c = JSON.parse(sessionStorage.getItem(ATRIBUTI_KEY) || "{}"); sessionStorage.setItem(ATRIBUTI_KEY, JSON.stringify({ ...c, scrollTop: el.scrollTop })); } catch {} };
    el.addEventListener("scroll", h, { passive: true });
    return () => el.removeEventListener("scroll", h);
  }, []);

  // Filter attributes
  const filteredAttributes = useMemo(() => {
    if (!searchTerm) return attributes;
    const lower = searchTerm.toLowerCase();
    return attributes.filter(
      (a) =>
        a.code.toLowerCase().includes(lower) ||
        a.name.toLowerCase().includes(lower)
    );
  }, [attributes, searchTerm]);

  // Sort attributes
  const sortedAttributes = useMemo(() => {
    return sortItems(filteredAttributes, (item, column) => {
      switch (column) {
        case 'code': return item.code;
        case 'name': return item.name;
        case 'data_type': return item.data_type;
        case 'is_repeatable': return item.is_repeatable;
        default: return null;
      }
    });
  }, [filteredAttributes, sortItems]);

  // Handlers
  const handleAdd = () => {
    setEditingAttribute(null);
    setFormData(emptyForm);
    setPredefinedValuesCount(null);
    setIsFormOpen(true);
  };

  const handleEdit = (attr: ArticleAttribute) => {
    setEditingAttribute(attr);
    setFormData({
      code: attr.code,
      name: attr.name,
      data_type: attr.data_type,
      is_repeatable: attr.is_repeatable,
    });
    setIsFormOpen(true);
  };

  const handleDeleteClick = (attr: ArticleAttribute) => {
    setDeletingAttribute(attr);
    setIsDeleteOpen(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedAttributes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedCompany || !formData.code.trim() || !formData.name.trim()) {
      toast.error("Šifra i naziv su obavezni");
      return;
    }

    setSaving(true);
    try {
      if (editingAttribute) {
        // Update - don't allow changing code
        const { error } = await supabase
          .from("article_attributes")
          .update({
            name: formData.name.trim(),
            data_type: formData.data_type,
            is_repeatable: formData.is_repeatable,
          })
          .eq("id", editingAttribute.id);

        if (error) throw error;
        toast.success("Atribut uspešno ažuriran");
      } else {
        // Insert
        const { error } = await supabase.from("article_attributes").insert({
          code: formData.code.trim(),
          name: formData.name.trim(),
          data_type: formData.data_type,
          is_repeatable: formData.is_repeatable,
          company_id: selectedCompany.id,
        });

        if (error) {
          if (error.code === "23505") {
            toast.error("Atribut sa ovom šifrom već postoji");
            return;
          }
          throw error;
        }
        toast.success("Atribut uspešno kreiran. Proširite red u tabeli da dodate predefinisane vrednosti.");
        // Auto-expand the new attribute row if it's predefined type
        if (formData.data_type === "predefined") {
          // We need to refetch first to get the new attribute
          await refetch();
          // Find and expand the newly created attribute
          const { data: newAttrs } = await supabase
            .from("article_attributes")
            .select("id")
            .eq("company_id", selectedCompany.id)
            .eq("code", formData.code.trim())
            .single();
          if (newAttrs) {
            setExpandedAttributes((prev) => new Set([...prev, newAttrs.id]));
          }
        }
      }

      setIsFormOpen(false);
      setEditingAttribute(null);
      setFormData(emptyForm);
      setPredefinedValuesCount(null);
      refetch();
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAttribute) return;

    try {
      // Check if attribute has assignments
      const { count, error: countError } = await supabase
        .from("article_attribute_assignments")
        .select("*", { count: "exact", head: true })
        .eq("attribute_id", deletingAttribute.id);

      if (countError) throw countError;

      if (count && count > 0) {
        toast.error(`Ne možete obrisati atribut koji je dodeljen artiklima (${count} dodela)`);
        setIsDeleteOpen(false);
        return;
      }

      const { error } = await supabase
        .from("article_attributes")
        .delete()
        .eq("id", deletingAttribute.id);

      if (error) throw error;
      toast.success("Atribut uspešno obrisan");
      setIsDeleteOpen(false);
      setDeletingAttribute(null);
      refetch();
    } catch (error: any) {
      toast.error("Greška pri brisanju: " + error.message);
    }
  };


  return (
    <MainLayout title="Atributi artikala">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col flex-1 min-h-0 space-y-6 animate-fade-in">
        {/* Header - Sticky */}
        <div className="sticky top-0 z-10 bg-background pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Tags className="w-6 h-6" />
                Atributi artikala
              </h1>
              <p className="text-muted-foreground mt-1">
                Upravljanje atributima koji se mogu dodeliti artiklima
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Pretraži atribute..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                  autoComplete="off"
                />
              </div>

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
                <TooltipContent>
                  <p>Osveži listu atributa</p>
                </TooltipContent>
              </Tooltip>

              {canEdit && (
                <Button onClick={handleAdd} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Novi atribut
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="erp-card flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredAttributes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm
                ? "Nema atributa koji odgovaraju pretrazi"
                : "Nema definisanih atributa"}
            </div>
          ) : (
            <TableScrollContainer ref={tableScrollRef}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-32">
                      <SortableHeader column="code" label="Šifra" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    </TableHead>
                    <TableHead>
                      <SortableHeader column="name" label="Naziv" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    </TableHead>
                    <TableHead className="w-40">
                      <SortableHeader column="data_type" label="Tip podatka" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    </TableHead>
                    <TableHead className="w-28 text-center">
                      <SortableHeader column="is_repeatable" label="Ponavljanje" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-center" />
                    </TableHead>
                    {canEdit && <TableHead className="w-32 text-right">Akcije</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAttributes.map((attr) => (
                    <AttributeRow
                      key={attr.id}
                      attribute={attr}
                      isExpanded={expandedAttributes.has(attr.id)}
                      onToggleExpand={() => toggleExpand(attr.id)}
                      onEdit={() => handleEdit(attr)}
                      onDelete={() => handleDeleteClick(attr)}
                      canEdit={canEdit}
                      companyId={selectedCompany?.id}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableScrollContainer>
          )}
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAttribute ? "Izmeni atribut" : "Novi atribut"}
              </DialogTitle>
              <DialogDescription>
                {editingAttribute
                  ? "Izmenite podatke o atributu"
                  : "Unesite podatke za novi atribut"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Šifra atributa *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="npr. 0101"
                  disabled={!!editingAttribute}
                  autoComplete="off"
                />
                {editingAttribute && (
                  <p className="text-xs text-muted-foreground">
                    Šifra se ne može menjati nakon kreiranja
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Naziv atributa *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="npr. Dužina cevi"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_type">Tip podatka</Label>
                <Select
                  value={formData.data_type}
                  onValueChange={(v) => setFormData({ ...formData, data_type: v as AttributeDataType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DATA_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isPredefinedType && isNewAttribute && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">
                      Za tip "Predefinisana vrednost" morate prvo sačuvati atribut, 
                      a zatim dodati bar jednu predefinisanu vrednost (proširite red u tabeli).
                    </p>
                  </div>
                )}
                {isPredefinedType && !isNewAttribute && predefinedValuesCount === 0 && !checkingPredefined && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">
                      Ovaj atribut nema definisanih vrednosti! Zatvorite dijalog i proširite red 
                      u tabeli da biste dodali predefinisane vrednosti.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_repeatable"
                  checked={formData.is_repeatable}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_repeatable: !!checked })
                  }
                />
                <Label htmlFor="is_repeatable" className="cursor-pointer">
                  Atribut se može ponavljati (više vrednosti za isti artikal)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                Odustani
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingAttribute ? "Sačuvaj" : "Kreiraj"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Obrisati atribut?</AlertDialogTitle>
              <AlertDialogDescription>
                Da li ste sigurni da želite da obrišete atribut "{deletingAttribute?.name}"?
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

      </div>
    </MainLayout>
  );
}

// Separate component for table row with inline editing of predefined values
function AttributeRow({
  attribute,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  canEdit,
  companyId,
}: {
  attribute: ArticleAttribute;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  companyId?: string;
}) {
  const isPredefined = attribute.data_type === "predefined";
  const { values: predefinedValues, refetch: refetchPredefined, isLoading: loadingPredefined } = usePredefinedValues(
    isExpanded && isPredefined ? attribute.id : undefined
  );

  // Inline editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAddValue = async () => {
    if (!newValue.trim() || newValue.length > 31) {
      if (newValue.length > 31) toast.error("Maksimalno 31 karakter");
      return;
    }

    setSaving(true);
    try {
      const maxOrder = Math.max(0, ...predefinedValues.map((v) => v.sort_order));
      const { error } = await supabase.from("article_attribute_predefined_values").insert({
        attribute_id: attribute.id,
        value: newValue.trim(),
        sort_order: maxOrder + 1,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Vrednost već postoji");
          return;
        }
        throw error;
      }

      setNewValue("");
      refetchPredefined();
      toast.success("Vrednost dodana");
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editValue.trim() || editValue.length > 31) {
      if (editValue.length > 31) toast.error("Maksimalno 31 karakter");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("article_attribute_predefined_values")
        .update({ value: editValue.trim() })
        .eq("id", id);

      if (error) throw error;

      setEditingId(null);
      setEditValue("");
      refetchPredefined();
      toast.success("Vrednost ažurirana");
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteValue = async (id: string) => {
    try {
      const { error } = await supabase
        .from("article_attribute_predefined_values")
        .delete()
        .eq("id", id);

      if (error) throw error;
      refetchPredefined();
      toast.success("Vrednost obrisana");
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    }
  };

  const handleMoveValue = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = predefinedValues.findIndex(v => v.id === id);
    if (currentIndex === -1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= predefinedValues.length) return;

    const currentItem = predefinedValues[currentIndex];
    const targetItem = predefinedValues[targetIndex];

    try {
      // Swap sort_order values
      const { error: error1 } = await supabase
        .from("article_attribute_predefined_values")
        .update({ sort_order: targetItem.sort_order })
        .eq("id", currentItem.id);

      if (error1) throw error1;

      const { error: error2 } = await supabase
        .from("article_attribute_predefined_values")
        .update({ sort_order: currentItem.sort_order })
        .eq("id", targetItem.id);

      if (error2) throw error2;

      refetchPredefined();
    } catch (error: any) {
      toast.error("Greška pri sortiranju: " + error.message);
    }
  };

  const startEdit = (pv: AttributePredefinedValue) => {
    setEditingId(pv.id);
    setEditValue(pv.value);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  return (
    <Fragment>
      <TableRow className={cn(isPredefined && isExpanded && "border-b-0")}>
        <TableCell>
          {isPredefined && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggleExpand}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          )}
        </TableCell>
        <TableCell className="font-mono">{attribute.code}</TableCell>
        <TableCell className="font-medium">{attribute.name}</TableCell>
        <TableCell>
          <Badge variant="secondary">{DATA_TYPE_SHORT_LABELS[attribute.data_type]}</Badge>
        </TableCell>
        <TableCell className="text-center">
          {attribute.is_repeatable ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
              Da
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              Ne
            </Badge>
          )}
        </TableCell>
        {canEdit && (
          <TableCell>
            <div className="flex items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
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
                    className="h-8 w-8 text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Obriši</TooltipContent>
              </Tooltip>
            </div>
          </TableCell>
        )}
      </TableRow>

      {/* Expanded predefined values */}
      {isPredefined && isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={canEdit ? 6 : 5} className="py-3">
            <div className="ml-8 space-y-2">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Predefinisane vrednosti:
              </div>
              
              {loadingPredefined ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Učitavanje...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Existing values */}
                  {predefinedValues.map((pv, index) => (
                    <div key={pv.id} className="flex items-center gap-2 group">
                      {editingId === pv.id ? (
                        <>
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            maxLength={31}
                            className="h-8 w-64"
                            autoFocus
                            autoComplete="off"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(pv.id);
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-600"
                            onClick={() => handleSaveEdit(pv.id)}
                            disabled={saving}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={cancelEdit}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {canEdit && (
                            <div className="flex flex-col opacity-0 group-hover:opacity-100">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5"
                                onClick={() => handleMoveValue(pv.id, 'up')}
                                disabled={index === 0}
                              >
                                <ArrowUp className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5"
                                onClick={() => handleMoveValue(pv.id, 'down')}
                                disabled={index === predefinedValues.length - 1}
                              >
                                <ArrowDown className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          <span 
                            className={cn(
                              "px-2 py-1 rounded text-sm bg-background border cursor-default min-w-[100px]",
                              canEdit && "cursor-pointer hover:bg-accent"
                            )}
                            onClick={() => canEdit && startEdit(pv)}
                          >
                            {pv.value}
                          </span>
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                              onClick={() => handleDeleteValue(pv.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add new value inline */}
                  {canEdit && (
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder="Nova vrednost..."
                        maxLength={31}
                        className="h-8 w-64"
                        autoComplete="off"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddValue();
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary"
                        onClick={handleAddValue}
                        disabled={!newValue.trim() || saving}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {predefinedValues.length === 0 && !canEdit && (
                    <span className="text-sm text-muted-foreground italic">
                      Nema predefinisanih vrednosti
                    </span>
                  )}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
