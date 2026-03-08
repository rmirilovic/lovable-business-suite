import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/formatting";
import { format } from "date-fns";

interface Row {
  delivery_date: string;
  delivery_number: string;
  work_order_number: string;
  warehouse_code: string;
  qty_total: number;
  delivered_kg: number;
  delivered_m: number;
  delivered_pcs: number;
  unit_price: number;
  item_value: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: string | null;
  articleCode: string;
  articleName: string;
}

export function ArticleProductionDeliveryNotesDialog({ open, onOpenChange, articleId, articleCode, articleName }: Props) {
  const { selectedCompany } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !articleId || !selectedCompany?.id) return;
    setLoading(true);

    (async () => {
      const { data: items, error } = await (supabase as any)
        .from("production_delivery_note_items")
        .select("delivery_note_id, qty_total, delivered_kg, delivered_m, delivered_pcs, unit_price, item_value")
        .eq("company_id", selectedCompany.id)
        .eq("article_id", articleId)
        .order("created_at", { ascending: true });

      if (error || !items?.length) { setRows([]); setLoading(false); return; }

      const noteIds = [...new Set(items.map((i: any) => i.delivery_note_id))];
      const { data: notes } = await (supabase as any)
        .from("production_delivery_notes")
        .select("id, delivery_date, delivery_number, work_order_id, warehouse_id")
        .in("id", noteIds);

      if (!notes?.length) { setRows([]); setLoading(false); return; }

      const woIds = [...new Set(notes.map((n: any) => n.work_order_id).filter(Boolean))];
      const woMap: Record<string, string> = {};
      if (woIds.length) {
        const { data: wos } = await (supabase as any)
          .from("work_orders")
          .select("id, order_number")
          .in("id", woIds);
        for (const wo of wos || []) woMap[wo.id] = wo.order_number;
      }

      const whIds = [...new Set(notes.map((n: any) => n.warehouse_id).filter(Boolean))];
      const whMap: Record<string, string> = {};
      if (whIds.length) {
        const { data: whs } = await (supabase as any)
          .from("warehouses")
          .select("id, code")
          .in("id", whIds);
        for (const wh of whs || []) whMap[wh.id] = wh.code;
      }

      const noteMap: Record<string, any> = {};
      for (const n of notes) noteMap[n.id] = n;

      const result: Row[] = items.map((item: any) => {
        const n = noteMap[item.delivery_note_id];
        return {
          delivery_date: n?.delivery_date || "",
          delivery_number: n?.delivery_number || "",
          work_order_number: n?.work_order_id ? (woMap[n.work_order_id] || "") : "",
          warehouse_code: n?.warehouse_id ? (whMap[n.warehouse_id] || "") : "",
          qty_total: Number(item.qty_total) || 0,
          delivered_kg: Number(item.delivered_kg) || 0,
          delivered_m: Number(item.delivered_m) || 0,
          delivered_pcs: Number(item.delivered_pcs) || 0,
          unit_price: Number(item.unit_price) || 0,
          item_value: Number(item.item_value) || 0,
        };
      });

      result.sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));
      setRows(result);
      setLoading(false);
    })();
  }, [open, articleId, selectedCompany?.id]);

  const totals = rows.reduce(
    (acc, r) => ({
      qty_total: acc.qty_total + r.qty_total,
      delivered_kg: acc.delivered_kg + r.delivered_kg,
      delivered_m: acc.delivered_m + r.delivered_m,
      delivered_pcs: acc.delivered_pcs + r.delivered_pcs,
      item_value: acc.item_value + r.item_value,
    }),
    { qty_total: 0, delivered_kg: 0, delivered_m: 0, delivered_pcs: 0, item_value: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pregled na predajnicama — {articleCode} {articleName}</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto flex-1">
          {loading ? (
            <p className="text-center py-6 text-muted-foreground">Učitavanje...</p>
          ) : rows.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">Nema podataka.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Broj predajnice</TableHead>
                  <TableHead>Broj RN</TableHead>
                  <TableHead>Šifra mag.</TableHead>
                  <TableHead className="text-right">Količina</TableHead>
                  <TableHead className="text-right">Pred. kg</TableHead>
                  <TableHead className="text-right">Pred. m</TableHead>
                  <TableHead className="text-right">Pred. kom</TableHead>
                  <TableHead className="text-right">Cena</TableHead>
                  <TableHead className="text-right">Vrednost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.delivery_date ? format(new Date(r.delivery_date), "dd.MM.yyyy") : ""}</TableCell>
                    <TableCell>{r.delivery_number}</TableCell>
                    <TableCell>{r.work_order_number || "-"}</TableCell>
                    <TableCell>{r.warehouse_code || "-"}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.qty_total, { minimumFractionDigits: 3 })}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.delivered_kg, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.delivered_m, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.delivered_pcs, { minimumFractionDigits: 3 })}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.unit_price, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.item_value, { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={4} className="text-right">Ukupno:</TableCell>
                  <TableCell className="text-right">{formatNumber(totals.qty_total, { minimumFractionDigits: 3 })}</TableCell>
                  <TableCell className="text-right">{formatNumber(totals.delivered_kg, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">{formatNumber(totals.delivered_m, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">{formatNumber(totals.delivered_pcs, { minimumFractionDigits: 3 })}</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{formatNumber(totals.item_value, { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
