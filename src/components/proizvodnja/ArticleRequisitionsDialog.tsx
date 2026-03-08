import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/formatting";
import { format } from "date-fns";

interface Row {
  requisition_date: string;
  requisition_number: string;
  work_order_number: string;
  warehouse_code: string;
  quantity: number;
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

export function ArticleRequisitionsDialog({ open, onOpenChange, articleId, articleCode, articleName }: Props) {
  const { selectedCompany } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !articleId || !selectedCompany?.id) return;
    setLoading(true);

    (async () => {
      // Get requisition items for this article
      const { data: items, error } = await (supabase as any)
        .from("material_requisition_items")
        .select("requisition_id, quantity, unit_price, item_value")
        .eq("company_id", selectedCompany.id)
        .eq("article_id", articleId)
        .order("created_at", { ascending: true });

      if (error || !items?.length) { setRows([]); setLoading(false); return; }

      const reqIds = [...new Set(items.map((i: any) => i.requisition_id))];
      const { data: reqs } = await (supabase as any)
        .from("material_requisitions")
        .select("id, requisition_date, requisition_number, work_order_id, warehouse_id")
        .in("id", reqIds);

      if (!reqs?.length) { setRows([]); setLoading(false); return; }

      // Get work order numbers
      const woIds = [...new Set(reqs.map((r: any) => r.work_order_id).filter(Boolean))];
      const woMap: Record<string, string> = {};
      if (woIds.length) {
        const { data: wos } = await (supabase as any)
          .from("work_orders")
          .select("id, order_number")
          .in("id", woIds);
        for (const wo of wos || []) woMap[wo.id] = wo.order_number;
      }

      // Get warehouse codes
      const whIds = [...new Set(reqs.map((r: any) => r.warehouse_id).filter(Boolean))];
      const whMap: Record<string, string> = {};
      if (whIds.length) {
        const { data: whs } = await (supabase as any)
          .from("warehouses")
          .select("id, code")
          .in("id", whIds);
        for (const wh of whs || []) whMap[wh.id] = wh.code;
      }

      const reqMap: Record<string, any> = {};
      for (const r of reqs) reqMap[r.id] = r;

      const result: Row[] = items.map((item: any) => {
        const req = reqMap[item.requisition_id];
        return {
          requisition_date: req?.requisition_date || "",
          requisition_number: req?.requisition_number || "",
          work_order_number: req?.work_order_id ? (woMap[req.work_order_id] || "") : "",
          warehouse_code: req?.warehouse_id ? (whMap[req.warehouse_id] || "") : "",
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
          item_value: Number(item.item_value) || 0,
        };
      });

      result.sort((a, b) => a.requisition_date.localeCompare(b.requisition_date));
      setRows(result);
      setLoading(false);
    })();
  }, [open, articleId, selectedCompany?.id]);

  const totalValue = rows.reduce((s, r) => s + r.item_value, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pregled na trebovanjima — {articleCode} {articleName}</DialogTitle>
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
                  <TableHead>Broj trebovanja</TableHead>
                  <TableHead>Broj RN</TableHead>
                  <TableHead>Šifra mag.</TableHead>
                  <TableHead className="text-right">Količina</TableHead>
                  <TableHead className="text-right">Cena</TableHead>
                  <TableHead className="text-right">Vrednost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.requisition_date ? format(new Date(r.requisition_date), "dd.MM.yyyy") : ""}</TableCell>
                    <TableCell>{r.requisition_number}</TableCell>
                    <TableCell>{r.work_order_number || "-"}</TableCell>
                    <TableCell>{r.warehouse_code || "-"}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.quantity, { minimumFractionDigits: 3 })}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.unit_price, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.item_value, { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={6} className="text-right">Ukupno:</TableCell>
                  <TableCell className="text-right">{formatNumber(totalValue, { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
