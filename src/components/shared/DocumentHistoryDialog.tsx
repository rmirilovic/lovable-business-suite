import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, History, Plus, Edit2, Trash2, User, Package, FileText } from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DocumentHistoryEntry {
  id: string;
  document_type: string;
  document_id: string;
  record_id: string;
  changed_by: string;
  changed_at: string;
  change_type: "insert" | "update" | "delete";
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

interface DocumentHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  /** The document_type value used for the header table, e.g. 'invoice' */
  documentType: string;
  /** Optional: field labels for this document type */
  fieldLabels?: Record<string, string>;
  /** Optional: fields to ignore */
  ignoredFields?: string[];
}

const DEFAULT_IGNORED_FIELDS = [
  "id", "company_id", "business_year_id", "created_at", "updated_at",
  "created_by", "posted_by", "posted_at",
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjižen",
  cancelled: "Storniran",
  approved: "Odobren",
  launched: "Lansiran",
  completed: "Završen",
  closed: "Zatvoren",
};

function getChangedFields(
  oldData: Record<string, any> | null,
  newData: Record<string, any> | null,
  ignoredFields: string[]
): string[] {
  if (!oldData || !newData) return [];
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  allKeys.forEach((key) => {
    if (ignoredFields.includes(key)) return;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changed.push(key);
    }
  });
  return changed;
}

function formatValue(value: any, field: string): string {
  if (value === null || value === undefined) return "-";
  if (field === "status") return STATUS_LABELS[value] || value;
  if (field === "is_active") return value ? "Aktivan" : "Neaktivan";
  if (typeof value === "boolean") return value ? "Da" : "Ne";
  if (typeof value === "number") return value.toLocaleString("sr-RS");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      return format(new Date(value), "dd.MM.yyyy", { locale: sr });
    } catch {
      return value;
    }
  }
  return String(value);
}

function getChangeDescription(entry: DocumentHistoryEntry): string {
  const isItem = entry.document_type.includes("_item") || 
                 entry.document_type.includes("_cost") || 
                 entry.document_type.includes("_material");
  
  if (entry.change_type === "insert") {
    if (isItem) {
      const name = entry.new_data?.item_name || entry.new_data?.description || entry.new_data?.article_name || "";
      return name ? `Dodata stavka: ${name}` : "Dodata stavka";
    }
    return "Dokument kreiran";
  }
  if (entry.change_type === "delete") {
    if (isItem) {
      const name = entry.old_data?.item_name || entry.old_data?.description || entry.old_data?.article_name || "";
      return name ? `Obrisana stavka: ${name}` : "Obrisana stavka";
    }
    return "Dokument obrisan";
  }
  // update
  if (!isItem && entry.old_data?.status !== entry.new_data?.status) {
    const oldStatus = STATUS_LABELS[entry.old_data?.status] || entry.old_data?.status;
    const newStatus = STATUS_LABELS[entry.new_data?.status] || entry.new_data?.status;
    return `Status: ${oldStatus} → ${newStatus}`;
  }
  if (isItem) {
    const name = entry.new_data?.item_name || entry.new_data?.description || entry.new_data?.article_name || "";
    return name ? `Izmenjena stavka: ${name}` : "Izmenjena stavka";
  }
  return "Izmena zaglavlja";
}

export function DocumentHistoryDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  documentType,
  fieldLabels = {},
  ignoredFields = DEFAULT_IGNORED_FIELDS,
}: DocumentHistoryDialogProps) {
  const [history, setHistory] = useState<DocumentHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine all related document_types (header + items)
  const relatedTypes = useMemo(() => {
    // Include the header type and all item types that start with the same prefix
    const types = [documentType];
    // Common item suffixes
    const itemSuffixes = ["_item", "_cost", "_material"];
    itemSuffixes.forEach((suffix) => {
      types.push(documentType + suffix);
    });
    return types;
  }, [documentType]);

  useEffect(() => {
    if (open && documentId) {
      fetchHistory();
    }
  }, [open, documentId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data: historyData, error } = await supabase
        .from("document_history")
        .select("*")
        .eq("document_id", documentId)
        .in("document_type", relatedTypes)
        .order("changed_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Fetch profiles
      const userIds = [...new Set((historyData || []).map((h: any) => h.changed_by))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

      setHistory(
        (historyData || []).map((h: any) => ({
          ...h,
          change_type: h.change_type as "insert" | "update" | "delete",
          old_data: h.old_data as Record<string, any> | null,
          new_data: h.new_data as Record<string, any> | null,
          profile: profileMap.get(h.changed_by),
        }))
      );
    } catch (error) {
      console.error("Error fetching document history:", error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (entry: DocumentHistoryEntry) => {
    if (entry.profile) {
      const { first_name, last_name, email } = entry.profile;
      if (first_name || last_name) return `${first_name || ""} ${last_name || ""}`.trim();
      return email || "Nepoznat korisnik";
    }
    return "Sistem";
  };

  const headerEntries = useMemo(() => history.filter((h) => h.document_type === documentType), [history, documentType]);
  const itemEntries = useMemo(() => history.filter((h) => h.document_type !== documentType), [history, documentType]);

  const getChangeBadge = (type: string, isItem: boolean) => {
    if (type === "insert") {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
          {isItem ? "Nova stavka" : "Kreiranje"}
        </Badge>
      );
    }
    if (type === "update") {
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs">
          Izmena
        </Badge>
      );
    }
    if (type === "delete") {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 text-xs">
          {isItem ? "Brisanje stavke" : "Brisanje"}
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs">Nepoznato</Badge>;
  };

  const renderEntry = (entry: DocumentHistoryEntry) => {
    const isItem = entry.document_type !== documentType;
    const changedFields = getChangedFields(entry.old_data, entry.new_data, ignoredFields);

    return (
      <div key={entry.id} className="border border-border rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isItem ? (
              <Package className="w-3.5 h-3.5 text-muted-foreground" />
            ) : entry.change_type === "insert" ? (
              <Plus className="w-3.5 h-3.5 text-green-500" />
            ) : entry.change_type === "update" ? (
              <Edit2 className="w-3.5 h-3.5 text-blue-500" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            )}
            {getChangeBadge(entry.change_type, isItem)}
            <span className="text-xs text-muted-foreground">
              {getChangeDescription(entry)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {format(new Date(entry.changed_at), "dd.MM.yyyy HH:mm", { locale: sr })}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="w-3 h-3" />
          <span>{getUserName(entry)}</span>
        </div>

        {entry.change_type === "update" && changedFields.length > 0 && (
          <div className="space-y-1 mt-1">
            {changedFields.slice(0, 10).map((field) => (
              <div key={field} className="text-xs flex items-center gap-2 bg-muted/50 rounded px-2 py-0.5">
                <span className="font-medium min-w-[100px]">
                  {fieldLabels[field] || field}:
                </span>
                <span className="text-red-500 line-through">
                  {formatValue(entry.old_data?.[field], field)}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="text-green-600">
                  {formatValue(entry.new_data?.[field], field)}
                </span>
              </div>
            ))}
            {changedFields.length > 10 && (
              <span className="text-xs text-muted-foreground">...i još {changedFields.length - 10} polja</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Istorija izmena: {documentName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Nema zabeleženih izmena za ovaj dokument.
          </div>
        ) : (
          <Tabs defaultValue="all">
            <TabsList className="mb-2">
              <TabsTrigger value="all">Sve ({history.length})</TabsTrigger>
              <TabsTrigger value="header">Zaglavlje ({headerEntries.length})</TabsTrigger>
              <TabsTrigger value="items">Stavke ({itemEntries.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <ScrollArea className="h-[450px] pr-4">
                <div className="space-y-3">{history.map(renderEntry)}</div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="header">
              <ScrollArea className="h-[450px] pr-4">
                <div className="space-y-3">
                  {headerEntries.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">Nema izmena zaglavlja.</div>
                  ) : (
                    headerEntries.map(renderEntry)
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="items">
              <ScrollArea className="h-[450px] pr-4">
                <div className="space-y-3">
                  {itemEntries.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">Nema izmena stavki.</div>
                  ) : (
                    itemEntries.map(renderEntry)
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
