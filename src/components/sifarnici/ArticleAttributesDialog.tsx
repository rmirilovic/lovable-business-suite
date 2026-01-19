import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Trash2, Tags } from "lucide-react";
import {
  useArticleAttributes,
  useArticleAssignments,
  usePredefinedValues,
  ArticleAttribute,
  ArticleAttributeAssignment,
  DATA_TYPE_SHORT_LABELS,
} from "@/hooks/useArticleAttributes";
import { Article } from "@/hooks/useArticles";

interface ArticleAttributesDialogProps {
  article: Article | null;
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArticleAttributesDialog({
  article,
  companyId,
  open,
  onOpenChange,
}: ArticleAttributesDialogProps) {
  const { attributes } = useArticleAttributes(companyId);
  const { assignments, refetch: refetchAssignments, isLoading: loadingAssignments } = 
    useArticleAssignments(article?.id);

  const [selectedAttributeId, setSelectedAttributeId] = useState<string>("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Get selected attribute details
  const selectedAttribute = attributes.find(a => a.id === selectedAttributeId);

  // Reset form when dialog opens/closes or article changes
  useEffect(() => {
    if (open && article) {
      setSelectedAttributeId("");
      setNewValue("");
    }
  }, [open, article?.id]);

  const handleAddAssignment = async () => {
    if (!article || !selectedAttributeId || !newValue.trim()) {
      toast.error("Izaberite atribut i unesite vrednost");
      return;
    }

    // Validate value based on data type
    const attr = selectedAttribute;
    if (!attr) return;

    const value = newValue.trim();

    if (attr.data_type === "text" && value.length > 511) {
      toast.error("Tekst ne sme biti duži od 511 karaktera");
      return;
    }
    if ((attr.data_type === "string" || attr.data_type === "predefined") && value.length > 31) {
      toast.error("Tekst ne sme biti duži od 31 karakter");
      return;
    }
    if (attr.data_type === "integer") {
      const num = parseInt(value);
      if (isNaN(num) || num < 0 || num > 65535) {
        toast.error("Broj mora biti između 0 i 65535");
        return;
      }
    }
    if (attr.data_type === "decimal") {
      const num = parseFloat(value.replace(",", "."));
      if (isNaN(num)) {
        toast.error("Unesite validan decimalni broj");
        return;
      }
    }
    if (attr.data_type === "date") {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(value)) {
        toast.error("Datum mora biti u formatu YYYY-MM-DD");
        return;
      }
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("article_attribute_assignments").insert({
        article_id: article.id,
        attribute_id: selectedAttributeId,
        value: value,
        company_id: companyId,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Ova kombinacija atributa i vrednosti već postoji za ovaj artikal");
          return;
        }
        if (error.message.includes("nije ponavljajući")) {
          toast.error("Ovaj atribut nije ponavljajući i već postoji za ovaj artikal");
          return;
        }
        throw error;
      }

      toast.success("Atribut dodat artiklu");
      setNewValue("");
      setSelectedAttributeId("");
      refetchAssignments();
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("article_attribute_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;
      toast.success("Atribut uklonjen");
      refetchAssignments();
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    }
  };

  if (!article) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="w-5 h-5" />
            Atributi artikla
          </DialogTitle>
          <DialogDescription>
            Artikal: {article.code} - {article.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* Add new assignment */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <Label className="text-sm font-medium">Dodaj novi atribut</Label>
            <div className="flex gap-2">
              <Select value={selectedAttributeId} onValueChange={setSelectedAttributeId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Izaberi atribut..." />
                </SelectTrigger>
                <SelectContent>
                  {attributes.map((attr) => (
                    <SelectItem key={attr.id} value={attr.id}>
                      <span className="font-mono text-xs mr-2">{attr.code}</span>
                      {attr.name}
                      <Badge variant="outline" className="ml-2 text-xs">
                        {DATA_TYPE_SHORT_LABELS[attr.data_type]}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex-1">
                <AttributeValueInput
                  attribute={selectedAttribute}
                  value={newValue}
                  onChange={setNewValue}
                  onEnter={handleAddAssignment}
                  existingAssignments={assignments}
                />
              </div>

              <Button onClick={handleAddAssignment} disabled={saving || !selectedAttributeId || !newValue.trim()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
            {selectedAttribute && (
              <p className="text-xs text-muted-foreground">
                {selectedAttribute.is_repeatable 
                  ? "Ovaj atribut može imati više vrednosti za isti artikal"
                  : "Ovaj atribut može imati samo jednu vrednost po artiklu"}
              </p>
            )}
          </div>

          {/* Current assignments */}
          <div className="flex-1 min-h-0">
            <Label className="text-sm font-medium mb-2 block">Dodeljeni atributi</Label>
            <ScrollArea className="h-64 border rounded-lg">
              {loadingAssignments ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Artikal nema dodeljene atribute
                </div>
              ) : (
                <div className="divide-y">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {assignment.attribute?.code}
                          </span>
                          <span className="font-medium truncate">
                            {assignment.attribute?.name}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {assignment.attribute ? DATA_TYPE_SHORT_LABELS[assignment.attribute.data_type] : ''}
                          </Badge>
                        </div>
                        <div className="text-sm text-foreground mt-1">
                          <span className="font-medium">Vrednost:</span>{" "}
                          {formatAttributeValue(assignment.value, assignment.attribute?.data_type)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive shrink-0"
                        onClick={() => handleDeleteAssignment(assignment.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component for attribute value input based on type
function AttributeValueInput({
  attribute,
  value,
  onChange,
  onEnter,
  existingAssignments,
}: {
  attribute: ArticleAttribute | undefined;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  existingAssignments: ArticleAttributeAssignment[];
}) {
  const { values: predefinedValues, isLoading: loadingPredefined } = usePredefinedValues(
    attribute?.data_type === "predefined" ? attribute.id : undefined
  );

  // Track which attribute we've auto-selected for
  const [autoSelectedForAttr, setAutoSelectedForAttr] = useState<string | null>(null);

  // Auto-select first available predefined value when attribute is selected or predefined values load
  useEffect(() => {
    if (
      attribute?.data_type === "predefined" && 
      predefinedValues.length > 0 && 
      !loadingPredefined &&
      autoSelectedForAttr !== attribute.id
    ) {
      // Get already assigned values for this attribute
      const assignedValues = existingAssignments
        .filter(a => a.attribute_id === attribute.id)
        .map(a => a.value);
      
      // Find first predefined value not already assigned
      const firstAvailable = predefinedValues.find(pv => !assignedValues.includes(pv.value));
      
      if (firstAvailable) {
        onChange(firstAvailable.value);
        setAutoSelectedForAttr(attribute.id);
      } else if (attribute.is_repeatable && predefinedValues.length > 0) {
        // If repeatable and all values are used, just select the first one
        onChange(predefinedValues[0].value);
        setAutoSelectedForAttr(attribute.id);
      }
    }
  }, [attribute?.id, attribute?.data_type, attribute?.is_repeatable, predefinedValues, loadingPredefined, existingAssignments, onChange, autoSelectedForAttr]);

  // Reset auto-selected tracking when attribute changes
  useEffect(() => {
    if (!attribute) {
      setAutoSelectedForAttr(null);
    }
  }, [attribute?.id]);

  if (!attribute) {
    return (
      <Input
        placeholder="Prvo izaberite atribut..."
        disabled
      />
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter();
    }
  };

  switch (attribute.data_type) {
    case "predefined":
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Izaberi vrednost..." />
          </SelectTrigger>
          <SelectContent>
            {predefinedValues.map((pv) => (
              <SelectItem key={pv.id} value={pv.value}>
                {pv.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "bit":
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Izaberi..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Da</SelectItem>
            <SelectItem value="0">Ne</SelectItem>
          </SelectContent>
        </Select>
      );

    case "integer":
      return (
        <Input
          type="number"
          min={0}
          max={65535}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Unesite broj (0-65535)..."
          autoComplete="off"
        />
      );

    case "decimal":
      return (
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Unesite decimalni broj..."
          autoComplete="off"
        />
      );

    case "date":
      return (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      );

    case "text":
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Unesite tekst (max 511 znakova)..."
          maxLength={511}
          autoComplete="off"
        />
      );

    case "string":
    default:
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Unesite tekst (max 31 znak)..."
          maxLength={31}
          autoComplete="off"
        />
      );
  }
}

// Format attribute value for display
function formatAttributeValue(value: string, dataType?: string): string {
  if (!dataType) return value;

  switch (dataType) {
    case "bit":
      return value === "1" ? "Da" : "Ne";
    case "date":
      try {
        return new Date(value).toLocaleDateString("sr-Latn-RS");
      } catch {
        return value;
      }
    default:
      return value;
  }
}
