import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, History, Plus, Edit2, Trash2, User } from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ArticleHistoryEntry {
  id: string;
  article_id: string;
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

interface ArticleHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: string;
  articleName: string;
}

const FIELD_LABELS: Record<string, string> = {
  code: "Šifra",
  name: "Naziv",
  article_group: "Klasa",
  svk: "SVK",
  unit: "JM",
  purchase_price: "Nabavna cena",
  selling_price: "Prodajna cena",
  stock: "Stanje",
  min_stock: "Min. stanje",
  kg_po_jm: "kg po JM",
  kol_mas: "Kol. u masi",
  is_active: "Status",
};

const IGNORED_FIELDS = ["id", "company_id", "business_year_id", "created_at", "updated_at"];

function getChangedFields(oldData: Record<string, any> | null, newData: Record<string, any> | null): string[] {
  if (!oldData || !newData) return [];
  
  const changedFields: string[] = [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  
  allKeys.forEach((key) => {
    if (IGNORED_FIELDS.includes(key)) return;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changedFields.push(key);
    }
  });
  
  return changedFields;
}

function formatValue(value: any, field: string): string {
  if (value === null || value === undefined) return "-";
  if (field === "is_active") return value ? "Aktivan" : "Neaktivan";
  if (typeof value === "number") return value.toLocaleString("sr-RS");
  return String(value);
}

export function ArticleHistoryDialog({
  open,
  onOpenChange,
  articleId,
  articleName,
}: ArticleHistoryDialogProps) {
  const [history, setHistory] = useState<ArticleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && articleId) {
      fetchHistory();
    }
  }, [open, articleId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Fetch history without join (no FK relationship)
      const { data: historyData, error: historyError } = await supabase
        .from("article_history")
        .select("*")
        .eq("article_id", articleId)
        .order("changed_at", { ascending: false });

      if (historyError) throw historyError;

      // Fetch profiles separately
      const userIds = [...new Set((historyData || []).map((h) => h.changed_by))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      setHistory(
        (historyData || []).map((h) => ({
          ...h,
          change_type: h.change_type as "insert" | "update" | "delete",
          old_data: h.old_data as Record<string, any> | null,
          new_data: h.new_data as Record<string, any> | null,
          profile: profileMap.get(h.changed_by),
        }))
      );
    } catch (error: any) {
      console.error("Error fetching history:", error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case "insert":
        return <Plus className="w-4 h-4 text-green-500" />;
      case "update":
        return <Edit2 className="w-4 h-4 text-blue-500" />;
      case "delete":
        return <Trash2 className="w-4 h-4 text-red-500" />;
      default:
        return <History className="w-4 h-4" />;
    }
  };

  const getChangeBadge = (type: string) => {
    switch (type) {
      case "insert":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Kreiranje</Badge>;
      case "update":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Izmena</Badge>;
      case "delete":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Brisanje</Badge>;
      default:
        return <Badge variant="outline">Nepoznato</Badge>;
    }
  };

  const getUserName = (entry: ArticleHistoryEntry) => {
    if (entry.profile) {
      const { first_name, last_name, email } = entry.profile;
      if (first_name || last_name) {
        return `${first_name || ""} ${last_name || ""}`.trim();
      }
      return email || "Nepoznat korisnik";
    }
    return "Sistem";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Istorija izmena: {articleName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Nema zabeleženih izmena za ovaj artikal.
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {history.map((entry) => {
                const changedFields = getChangedFields(entry.old_data, entry.new_data);
                
                return (
                  <div
                    key={entry.id}
                    className="border border-border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getChangeIcon(entry.change_type)}
                        {getChangeBadge(entry.change_type)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(entry.changed_at), "dd.MM.yyyy HH:mm", { locale: sr })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span>{getUserName(entry)}</span>
                    </div>

                    {entry.change_type === "update" && changedFields.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Promenjeno:
                        </p>
                        <div className="space-y-1">
                          {changedFields.map((field) => (
                            <div
                              key={field}
                              className="text-sm flex items-center gap-2 bg-muted/50 rounded px-2 py-1"
                            >
                              <span className="font-medium min-w-[120px]">
                                {FIELD_LABELS[field] || field}:
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
                        </div>
                      </div>
                    )}

                    {entry.change_type === "insert" && entry.new_data && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Početne vrednosti:
                        </p>
                        <div className="grid grid-cols-2 gap-1 text-sm">
                          {Object.entries(entry.new_data)
                            .filter(([key]) => !IGNORED_FIELDS.includes(key) && FIELD_LABELS[key])
                            .map(([key, value]) => (
                              <div key={key} className="flex gap-2">
                                <span className="text-muted-foreground">{FIELD_LABELS[key]}:</span>
                                <span>{formatValue(value, key)}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
