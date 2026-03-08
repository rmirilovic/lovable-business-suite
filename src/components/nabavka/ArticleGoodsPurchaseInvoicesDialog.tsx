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
  invoice_date: string;
  internal_number: string;
  partner_code: string;
  partner_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discounted_price: number;
  vat_rate: number;
  line_subtotal: number;
  line_value: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: string | null;
  articleCode: string;
  articleName: string;
}

export function ArticleGoodsPurchaseInvoicesDialog({ open, onOpenChange, articleId, articleCode, articleName }: Props) {
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
          .from("goods_purchase_invoice_items")
          .select(`
            quantity, unit_price, discount_percent, vat_rate, line_subtotal, line_total,
            invoice:goods_purchase_invoices!inner(
              invoice_date, internal_number, status,
              partner:partners(code, name),
              supplier_name, company_id
            )
          `)
          .eq("article_id", articleId)
          .eq("invoice.company_id", selectedCompany.id);

        if (dateFrom) query = query.gte("invoice.invoice_date", dateFrom);
        if (dateTo) query = query.lte("invoice.invoice_date", dateTo);

        const { data, error } = await query;
        if (error) throw error;

        const mapped: Row[] = (data || []).map((item: any) => {
          const discount = item.discount_percent ?? 0;
          const discountedPrice = item.unit_price * (1 - discount / 100);
          const subtotal = item.quantity * discountedPrice;
          return {
            invoice_date: item.invoice?.invoice_date ?? "",
            internal_number: item.invoice?.internal_number ?? "",
            partner_code: item.invoice?.partner?.code ?? "",
            partner_name: item.invoice?.supplier_name ?? item.invoice?.partner?.name ?? "",
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: discount,
            discounted_price: discountedPrice,
            vat_rate: item.vat_rate ?? 0,
            line_subtotal: subtotal,
            line_value: item.line_total ?? subtotal,
          };
        });

        mapped.sort((a, b) => a.invoice_date.localeCompare(b.invoice_date) || a.internal_number.localeCompare(b.internal_number));
        setRows(mapped);
      } catch (err) {
        console.error("Error fetching article UFR data:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, articleId, selectedCompany?.id, dateFrom, dateTo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Artikal na UFR: {articleCode} – {articleName}
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
                <TableHead className="w-[120px]">Interni broj</TableHead>
                <TableHead className="min-w-[200px]">Dobavljač</TableHead>
                <TableHead className="text-right w-[100px]">Količina</TableHead>
                <TableHead className="text-right w-[120px]">Nabavna cena</TableHead>
                <TableHead className="text-right w-[120px]">Rabatirana cena</TableHead>
                <TableHead className="text-right w-[80px]">PDV%</TableHead>
                <TableHead className="text-right w-[120px]">Osnovica</TableHead>
                <TableHead className="text-right w-[120px]">Ukupno</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nema UFR za ovaj artikal u izabranom periodu.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row.invoice_date ? format(new Date(row.invoice_date), "dd.MM.yyyy") : "-"}</TableCell>
                    <TableCell className="font-medium">{row.internal_number}</TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{row.partner_code}</span>
                      {row.partner_code && " – "}
                      {row.partner_name}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(row.quantity)}</TableCell>
                    <TableCell className="text-right">{formatDecimal(row.unit_price)}</TableCell>
                    <TableCell className="text-right">{formatDecimal(row.discounted_price)}</TableCell>
                    <TableCell className="text-right font-medium">{formatDecimal(row.line_value)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
