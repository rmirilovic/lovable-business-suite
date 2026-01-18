import { useState, useMemo, Fragment } from "react";
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
import {
  useArticleAttributes,
  usePredefinedValues,
  ArticleAttribute,
  AttributePredefinedValue,
  AttributeDataType,
  DATA_TYPE_LABELS,
  DATA_TYPE_SHORT_LABELS,
} from "@/hooks/useArticleAttributes";

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
  const { selectedCompany, isSuperAdmin, isLocalAdmin } = useAuth();
  const canEdit = isSuperAdmin || isLocalAdmin;

  const {
    attributes,
    isLoading: loading,
    isFetching,
    refetch,
  } = useArticleAttributes(selectedCompany?.id);

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedAttributes, setExpandedAttributes] = useState<Set<string>>(new Set());

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<ArticleAttribute | null>(null);
  const [deletingAttribute, setDeletingAttribute] = useState<ArticleAttribute | null>(null);
  const [formData, setFormData] = useState<AttributeForm>(emptyForm);

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

  // Handlers
  const handleAdd = () => {
    setEditingAttribute(null);
    setFormData(emptyForm);
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
        toast.success("Atribut uspešno kreiran");
      }

      setIsFormOpen(false);
      setEditingAttribute(null);
      setFormData(emptyForm);
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
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

        {/* Table */}
        <div className="erp-card">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-32">Šifra</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead className="w-40">Tip podatka</TableHead>
                  <TableHead className="w-28 text-center">Ponavljanje</TableHead>
                  {canEdit && <TableHead className="w-32 text-right">Akcije</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttributes.map((attr) => (
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
                  {predefinedValues.map((pv) => (
                    <div key={pv.id} className="flex items-center gap-2 group">
                      {editingId === pv.id ? (
                        <>
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            maxLength={31}
                            className="h-8 w-64"
                            autoFocus
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
