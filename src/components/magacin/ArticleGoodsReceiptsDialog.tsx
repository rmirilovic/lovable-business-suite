import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDecimal } from "@/lib/formatting";
import { format } from "date-fns";

interface Row {
  receipt_date: string;
  receipt_number: string;
  partner_name: string;
  quantity: number;
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

export function ArticleGoodsReceiptsDialog({ open, onOpenChange, articleId, articleCode, articleName }: Props) {
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
        let query = supabase
          .from("goods_receipt_items")
          .select(`
            quantity, unit_price,
            goods_receipt:goods_receipts!inner(
              receipt_date, receipt_number, status, company_id,
              partner:partners(name)
            )
          `)
          .eq("article_id", articleId)
          .eq("goods_receipt.company_id", selectedCompany.id);

        if (dateFrom) query = query.gte("goods_receipt.receipt_date", dateFrom);
        if (dateTo) query = query.lte("goods_receipt.receipt_date", dateTo);

        const { data, error } = await query;
        if (error) throw error;

        const mapped: Row[] = (data || []).map((item: any) => {
          const gr = item.goods_receipt;
          return {
            receipt_date: gr?.receipt_date ?? "",
            receipt_number: gr?.receipt_number ?? "",
            partner_name: gr?.partner?.name ?? "—",
            quantity: item.quantity,
            unit_price: item.unit_price,
            value: item.quantity * item.unit_price,
          };
        });

        mapped.sort((a, b) => a.receipt_date.localeCompare(b.receipt_date) || a.receipt_number.localeCompare(b.receipt_number));
        setRows(mapped);
      } catch (err) {
        console.error("Error fetching article goods receipt data:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, articleId, selectedCompany?.id, dateFrom, dateTo]);

  const totals = rows.reduce(
    (acc, r) => ({
      quantity: acc.quantity + r.quantity,
      value: acc.value + r.value,
    }),
    { quantity: 0, value: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Pregled na prijemnicama: {articleCode} – {articleName}
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
                <TableHead className="w-[130px]">Broj prijemnice</TableHead>
                <TableHead className="min-w-[180px]">Dobavljač</TableHead>
                <TableHead className="text-right w-[100px]">Količina</TableHead>
                <TableHead className="text-right w-[110px]">Cena</TableHead>
                <TableHead className="text-right w-[130px]">Vrednost</TableHead>
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
                    Nema prijemnica za ovaj artikal u izabranom periodu.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.receipt_date ? format(new Date(row.receipt_date), "dd.MM.yyyy") : "-"}</TableCell>
                      <TableCell className="font-medium">{row.receipt_number}</TableCell>
                      <TableCell>{row.partner_name}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.quantity, 3)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.unit_price, 2)}</TableCell>
                      <TableCell className="text-right font-medium">{formatDecimal(row.value, 2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={3} className="text-right">Ukupno:</TableCell>
                    <TableCell className="text-right">{formatDecimal(totals.quantity, 3)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right">{formatDecimal(totals.value, 2)}</TableCell>
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
