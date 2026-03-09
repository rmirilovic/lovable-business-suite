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
  calculation_date: string;
  calculation_number: string;
  partner_name: string;
  warehouse_name: string;
  quantity: number;
  purchase_price: number;
  allocated_costs_per_unit: number;
  gross_price: number;
  gross_value: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: string | null;
  articleCode: string;
  articleName: string;
}

export function ArticleCalculationsDialog({ open, onOpenChange, articleId, articleCode, articleName }: Props) {
  const { selectedCompany, selectedYear } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (open && selectedYear) {
      const y = selectedYear.year;
      setDateFrom(`${y}-01-01`);
      setDateTo(format(new Date(), "yyyy-MM-dd"));
    }
  }, [open, selectedYear]);

  useEffect(() => {
    if (!open || !articleId || !selectedCompany?.id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("calculation_items")
          .select(`
            quantity, purchase_price, allocated_costs,
            calculation:purchase_price_calculations!inner(
              calculation_date, calculation_number, status, company_id,
              goods_receipt:goods_receipts!purchase_price_calculations_goods_receipt_id_fkey(
                partner:partners(name),
                warehouse:warehouses(code, name)
              )
            )
          `)
          .eq("article_id", articleId)
          .eq("calculation.company_id", selectedCompany.id);

        if (dateFrom) query = query.gte("calculation.calculation_date", dateFrom);
        if (dateTo) query = query.lte("calculation.calculation_date", dateTo);

        const { data, error } = await query;
        if (error) throw error;

        const mapped: Row[] = (data || []).map((item: any) => {
          const calc = item.calculation;
          const gr = calc?.goods_receipt;
          const allocPerUnit = item.quantity > 0 ? item.allocated_costs / item.quantity : 0;
          const grossPrice = item.purchase_price + allocPerUnit;
          const grossValue = grossPrice * item.quantity;

          return {
            calculation_date: calc?.calculation_date ?? "",
            calculation_number: calc?.calculation_number ?? "",
            partner_name: gr?.partner?.name ?? "—",
            warehouse_name: gr?.warehouse ? `${gr.warehouse.code} - ${gr.warehouse.name}` : "—",
            quantity: item.quantity,
            purchase_price: item.purchase_price,
            allocated_costs_per_unit: allocPerUnit,
            gross_price: grossPrice,
            gross_value: grossValue,
          };
        });

        mapped.sort((a, b) => a.calculation_date.localeCompare(b.calculation_date) || a.calculation_number.localeCompare(b.calculation_number));
        setRows(mapped);
      } catch (err) {
        console.error("Error fetching article calculation data:", err);
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
      grossValue: acc.grossValue + r.gross_value,
    }),
    { quantity: 0, grossValue: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Po kalkulacijama: {articleCode} – {articleName}
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
                <TableHead className="w-[120px]">Broj kalk.</TableHead>
                <TableHead className="min-w-[160px]">Dobavljač</TableHead>
                <TableHead className="min-w-[140px]">Magacin</TableHead>
                <TableHead className="text-right w-[90px]">Količina</TableHead>
                <TableHead className="text-right w-[110px]">Nabavna cena</TableHead>
                <TableHead className="text-right w-[110px]">Zav. troškovi</TableHead>
                <TableHead className="text-right w-[110px]">Bruto cena</TableHead>
                <TableHead className="text-right w-[130px]">Bruto nab. vred.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nema kalkulacija za ovaj artikal u izabranom periodu.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.calculation_date ? format(new Date(row.calculation_date), "dd.MM.yyyy") : "-"}</TableCell>
                      <TableCell className="font-medium">{row.calculation_number}</TableCell>
                      <TableCell>{row.partner_name}</TableCell>
                      <TableCell className="text-sm">{row.warehouse_name}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.quantity)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.purchase_price)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.allocated_costs_per_unit)}</TableCell>
                      <TableCell className="text-right font-medium">{formatDecimal(row.gross_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatDecimal(row.gross_value)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={4} className="text-right">Ukupno:</TableCell>
                    <TableCell className="text-right">{formatNumber(totals.quantity)}</TableCell>
                    <TableCell colSpan={3} />
                    <TableCell className="text-right">{formatDecimal(totals.grossValue)}</TableCell>
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
