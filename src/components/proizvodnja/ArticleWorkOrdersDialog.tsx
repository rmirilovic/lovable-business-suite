import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber, formatDecimal } from "@/lib/formatting";
import { format } from "date-fns";

interface Row {
  order_date: string;
  order_number: string;
  launched_qty: number;
  delivered_qty: number;
  unit_price: number;
  value: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: string | null;
  articleCode: string;
  articleName: string;
}

export function ArticleWorkOrdersDialog({ open, onOpenChange, articleId, articleCode, articleName }: Props) {
  const { selectedCompany, selectedYear } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (open && selectedYear) {
      const y = selectedYear.year;
      setDateFrom(`${y}-01-01`);
      setDateTo(`${y}-12-31`);
    }
  }, [open, selectedYear]);

  useEffect(() => {
    if (!open || !articleId || !selectedCompany?.id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch work order items for this article
        let query = supabase
          .from("work_order_items")
          .select(`
            launched_qty, unit_price, launched_value, work_order_id,
            work_order:work_orders!inner(
              order_date, order_number, status, company_id, id
            )
          `)
          .eq("article_id", articleId)
          .eq("work_order.company_id", selectedCompany.id);

        if (dateFrom) query = query.gte("work_order.order_date", dateFrom);
        if (dateTo) query = query.lte("work_order.order_date", dateTo);

        const { data, error } = await query;
        if (error) throw error;

        // Fetch delivered quantities from production delivery note items for this article
        const workOrderIds = [...new Set((data || []).map((d: any) => d.work_order?.id).filter(Boolean))];
        
        let deliveredMap: Record<string, number> = {};
        if (workOrderIds.length > 0) {
          const { data: dnData, error: dnError } = await supabase
            .from("production_delivery_note_items")
            .select(`
              qty_total, article_id,
              delivery_note:production_delivery_notes!inner(
                work_order_id, status, company_id
              )
            `)
            .eq("article_id", articleId)
            .eq("delivery_note.company_id", selectedCompany.id)
            .in("delivery_note.work_order_id", workOrderIds);

          if (!dnError && dnData) {
            for (const item of dnData as any[]) {
              const woId = item.delivery_note?.work_order_id;
              if (woId && item.delivery_note?.status === "posted") {
                deliveredMap[woId] = (deliveredMap[woId] || 0) + (item.qty_total || 0);
              }
            }
          }
        }

        const mapped: Row[] = (data || []).map((item: any) => {
          const woId = item.work_order?.id;
          return {
            order_date: item.work_order?.order_date ?? "",
            order_number: item.work_order?.order_number ?? "",
            launched_qty: item.launched_qty ?? 0,
            delivered_qty: deliveredMap[woId] || 0,
            unit_price: item.unit_price ?? 0,
            value: item.launched_value ?? 0,
          };
        });

        mapped.sort((a, b) => a.order_date.localeCompare(b.order_date) || a.order_number.localeCompare(b.order_number));
        setRows(mapped);
      } catch (err) {
        console.error("Error fetching article work orders data:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, articleId, selectedCompany?.id, dateFrom, dateTo]);

  const totalValue = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Artikal na radnim nalozima: {articleCode} – {articleName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-end gap-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[150px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[150px]" />
          </div>
        </div>

        <div className="border rounded-lg overflow-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Datum</TableHead>
                <TableHead className="w-[120px]">Broj RN</TableHead>
                <TableHead className="text-right w-[120px]">Lans. količina</TableHead>
                <TableHead className="text-right w-[120px]">Predata kol.</TableHead>
                <TableHead className="text-right w-[120px]">Cena</TableHead>
                <TableHead className="text-right w-[120px]">Vrednost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nema radnih naloga za ovaj artikal u izabranom periodu.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.order_date ? format(new Date(row.order_date), "dd.MM.yyyy") : "-"}</TableCell>
                      <TableCell className="font-medium">{row.order_number}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.launched_qty)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.delivered_qty)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatDecimal(row.value)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={5} className="text-right">Ukupno:</TableCell>
                    <TableCell className="text-right">{formatDecimal(totalValue)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
