import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History, Loader2, Plus, Edit2, Trash2, User } from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { fetchProductionLineHistory, ProductionLineHistoryEntry } from "@/hooks/useProductionLines";

const FIELD_LABELS: Record<string, string> = {
  code: "Šifra",
  name: "Naziv",
  production_type: "Vrsta proizvodnje",
  is_active: "Status",
};

const IGNORED = ["id", "company_id", "created_at", "updated_at", "created_by", "updated_by"];

function fmtVal(v: any, field: string) {
  if (v === null || v === undefined) return "-";
  if (field === "is_active") return v ? "Aktivna" : "Neaktivna";
  return String(v);
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productionLineId: string | null;
  lineLabel: string;
}

export function ProductionLineHistoryDialog({ open, onOpenChange, productionLineId, lineLabel }: Props) {
  const [entries, setEntries] = useState<ProductionLineHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && productionLineId) {
      setLoading(true);
      fetchProductionLineHistory(productionLineId)
        .then(setEntries)
        .catch(() => setEntries([]))
        .finally(() => setLoading(false));
    }
  }, [open, productionLineId]);

  const userName = (e: ProductionLineHistoryEntry) => {
    if (!e.profile) return "Sistem";
    const { first_name, last_name, email } = e.profile;
    if (first_name || last_name) return `${first_name ?? ""} ${last_name ?? ""}`.trim();
    return email ?? "Nepoznat korisnik";
  };

  const changed = (o: any, n: any) => {
    if (!o || !n) return [];
    const keys = new Set([...Object.keys(o), ...Object.keys(n)]);
    return [...keys].filter((k) => !IGNORED.includes(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" /> Istorija izmena: {lineLabel}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">Nema zabeleženih izmena.</div>
        ) : (
          <ScrollArea className="h-[450px] pr-4">
            <div className="space-y-3">
              {entries.map((e) => {
                const fields = e.action === "UPDATE" ? changed(e.old_data, e.new_data) : [];
                return (
                  <div key={e.id} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {e.action === "INSERT" ? <Plus className="w-3.5 h-3.5 text-green-500" /> :
                         e.action === "UPDATE" ? <Edit2 className="w-3.5 h-3.5 text-blue-500" /> :
                         <Trash2 className="w-3.5 h-3.5 text-red-500" />}
                        <Badge variant="outline" className="text-xs">
                          {e.action === "INSERT" ? "Kreiranje" : e.action === "UPDATE" ? "Izmena" : "Brisanje"}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(e.changed_at), "dd.MM.yyyy HH:mm", { locale: sr })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="w-3 h-3" /> <span>{userName(e)}</span>
                    </div>
                    {e.action === "UPDATE" && fields.length > 0 && (
                      <div className="space-y-1">
                        {fields.map((f) => (
                          <div key={f} className="text-xs flex items-center gap-2 bg-muted/50 rounded px-2 py-0.5">
                            <span className="font-medium min-w-[140px]">{FIELD_LABELS[f] ?? f}:</span>
                            <span className="text-red-500 line-through">{fmtVal(e.old_data?.[f], f)}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-green-600">{fmtVal(e.new_data?.[f], f)}</span>
                          </div>
                        ))}
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
