import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber, formatDecimal } from "@/lib/formatting";
import { format } from "date-fns";

interface ArticleQuoteRow {
  quote_date: string;
  quote_number: string;
  partner_code: string;
  partner_name: string;
  quantity: number;
  unit_price: number;
  warehouse_price: number;
  line_value: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: string | null;
  articleCode: string;
  articleName: string;
}

export function ArticleQuotesDialog({ open, onOpenChange, articleId, articleCode, articleName }: Props) {
  const { selectedCompany, selectedYear } = useAuth();
  const [rows, setRows] = useState<ArticleQuoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Set default dates from business year
  useEffect(() => {
    if (open && selectedYear) {
      const y = selectedYear.year;
      setDateFrom(`${y}-01-01`);
      setDateTo(format(new Date(), "yyyy-MM-dd"));
    }
  }, [open, selectedYear]);

  // Fetch data when dialog opens or dates change
  useEffect(() => {
    if (!open || !articleId || !selectedCompany?.id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch quote items for this article
        let query = supabase
          .from("quote_items")
          .select(`
            quantity, unit_price, line_subtotal,
            quote:quotes!inner(
              quote_date, quote_number, status,
              partner:partners(code, name),
              partner_name, company_id
            )
          `)
          .eq("article_id", articleId)
          .eq("quote.company_id", selectedCompany.id);

        if (dateFrom) {
          query = query.gte("quote.quote_date", dateFrom);
        }
        if (dateTo) {
          query = query.lte("quote.quote_date", dateTo);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Fetch warehouse price for article
        const { data: articleData } = await supabase
          .from("articles")
          .select("purchase_price")
          .eq("id", articleId)
          .single();

        const warehousePrice = articleData?.purchase_price ?? 0;

        const mapped: ArticleQuoteRow[] = (data || []).map((item: any) => ({
          quote_date: item.quote?.quote_date ?? "",
          quote_number: item.quote?.quote_number ?? "",
          partner_code: item.quote?.partner?.code ?? "",
          partner_name: item.quote?.partner_name ?? item.quote?.partner?.name ?? "",
          quantity: item.quantity,
          unit_price: item.unit_price,
          warehouse_price: warehousePrice,
          line_value: item.quantity * item.unit_price,
        }));

        mapped.sort((a, b) => a.quote_date.localeCompare(b.quote_date) || a.quote_number.localeCompare(b.quote_number));
        setRows(mapped);
      } catch (err) {
        console.error("Error fetching article quotes:", err);
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
            Artikal na ponudama: {articleCode} – {articleName}
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
                <TableHead className="w-[120px]">Broj ponude</TableHead>
                <TableHead className="min-w-[200px]">Kupac</TableHead>
                <TableHead className="text-right w-[100px]">Količina</TableHead>
                <TableHead className="text-right w-[120px]">Ponuđena cena</TableHead>
                <TableHead className="text-right w-[120px]">Mag. cena</TableHead>
                <TableHead className="text-right w-[120px]">Vrednost</TableHead>
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
                    Nema ponuda za ovaj artikal u izabranom periodu.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.quote_date ? format(new Date(row.quote_date), "dd.MM.yyyy") : "-"}</TableCell>
                      <TableCell className="font-medium">{row.quote_number}</TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">{row.partner_code}</span>
                        {row.partner_code && " – "}
                        {row.partner_name}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(row.quantity)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.unit_price)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.warehouse_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatDecimal(row.line_value)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={6} className="text-right">Ukupno:</TableCell>
                    <TableCell className="text-right">{formatDecimal(rows.reduce((sum, r) => sum + r.line_value, 0))}</TableCell>
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
