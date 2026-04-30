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

interface PartnerHistoryEntry {
  id: string;
  partner_id: string;
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

interface PartnerHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  partnerName: string;
}

const FIELD_LABELS: Record<string, string> = {
  code: "Šifra",
  name: "Naziv",
  legal_status: "Pravni status",
  address: "Adresa",
  postal_code: "Poštanski broj",
  city: "Grad",
  country: "Država",
  email: "Email",
  phone: "Telefon",
  pib: "PIB",
  mb: "Matični broj",
  jbkjs: "JBKJS",
  activity_code: "Šifra delatnosti",
  website: "Web sajt",
  responsible_person: "Odgovorno lice",
  is_customer: "Kupac",
  is_supplier: "Dobavljač",
  is_in_pdv: "U sistemu PDV",
  is_active: "Status",
  group_id: "Grupa",
  assigned_to: "Zadužen",
  note: "Napomena",
  other_data: "Ostali podaci",
  payment_priority: "Prioritet plaćanja",
  created_at: "Datum dodavanja u bazu",
  updated_at: "Datum poslednje izmene",
};

const IGNORED_FIELDS = ["id", "company_id", "updated_at"];

function getChangedFields(
  oldData: Record<string, any> | null,
  newData: Record<string, any> | null
): string[] {
  if (!oldData || !newData) return [];
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  allKeys.forEach((key) => {
    if (IGNORED_FIELDS.includes(key)) return;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changed.push(key);
    }
  });
  return changed;
}

function formatValue(value: any, field: string): string {
  if (value === null || value === undefined) return "-";
  if (field === "is_active" || field === "is_customer" || field === "is_supplier" || field === "is_in_pdv")
    return value ? "Da" : "Ne";
  if (field === "legal_status") {
    const labels: Record<number, string> = { 1: "Pravno lice", 2: "Fizičko lice", 3: "Preduzetnik", 4: "Budžetski korisnik" };
    return labels[value] || String(value);
  }
  if ((field === "created_at" || field === "updated_at") && typeof value === "string") {
    try {
      return format(new Date(value), "dd.MM.yyyy HH:mm:ss", { locale: sr });
    } catch {
      return String(value);
    }
  }
  if (typeof value === "number") return value.toLocaleString("sr-RS");
  return String(value);
}

export function PartnerHistoryDialog({
  open,
  onOpenChange,
  partnerId,
  partnerName,
}: PartnerHistoryDialogProps) {
  const [history, setHistory] = useState<PartnerHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && partnerId) {
      fetchHistory();
    }
  }, [open, partnerId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data: historyData, error } = await supabase
        .from("partner_history")
        .select("*")
        .eq("partner_id", partnerId)
        .order("changed_at", { ascending: false });

      if (error) throw error;

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
      console.error("Error fetching partner history:", error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case "insert": return <Plus className="w-4 h-4 text-green-500" />;
      case "update": return <Edit2 className="w-4 h-4 text-blue-500" />;
      case "delete": return <Trash2 className="w-4 h-4 text-red-500" />;
      default: return <History className="w-4 h-4" />;
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

  const getUserName = (entry: PartnerHistoryEntry) => {
    if (entry.profile) {
      const { first_name, last_name, email } = entry.profile;
      if (first_name || last_name) return `${first_name || ""} ${last_name || ""}`.trim();
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
            Istorija izmena: {partnerName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Nema zabeleženih izmena za ovog partnera.
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {history.map((entry) => {
                const changedFields = getChangedFields(entry.old_data, entry.new_data);

                return (
                  <div key={entry.id} className="border border-border rounded-lg p-4 space-y-3">
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
