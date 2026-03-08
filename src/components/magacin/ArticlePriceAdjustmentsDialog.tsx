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
  adjustment_date: string;
  adjustment_number: string;
  warehouse_name: string;
  quantity: number;
  old_price: number;
  new_price: number;
  price_difference: number;
  value_difference: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: string | null;
  articleCode: string;
  articleName: string;
}

export function ArticlePriceAdjustmentsDialog({ open, onOpenChange, articleId, articleCode, articleName }: Props) {
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
          .from("price_adjustment_items")
          .select(`
            quantity, old_price, new_price, price_difference, value_difference,
            price_adjustment:price_adjustments!inner(
              adjustment_date, adjustment_number, status, company_id,
              warehouse:warehouses(code, name)
            )
          `)
          .eq("article_id", articleId)
          .eq("price_adjustment.company_id", selectedCompany.id);

        if (dateFrom) query = query.gte("price_adjustment.adjustment_date", dateFrom);
        if (dateTo) query = query.lte("price_adjustment.adjustment_date", dateTo);

        const { data, error } = await query;
        if (error) throw error;

        const mapped: Row[] = (data || []).map((item: any) => {
          const pa = item.price_adjustment;
          return {
            adjustment_date: pa?.adjustment_date ?? "",
            adjustment_number: pa?.adjustment_number ?? "",
            warehouse_name: pa?.warehouse ? `${pa.warehouse.code} - ${pa.warehouse.name}` : "—",
            quantity: item.quantity,
            old_price: item.old_price,
            new_price: item.new_price,
            price_difference: item.price_difference,
            value_difference: item.value_difference,
          };
        });

        mapped.sort((a, b) => a.adjustment_date.localeCompare(b.adjustment_date) || a.adjustment_number.localeCompare(b.adjustment_number));
        setRows(mapped);
      } catch (err) {
        console.error("Error fetching article price adjustment data:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, articleId, selectedCompany?.id, dateFrom, dateTo]);

  const totals = rows.reduce(
    (acc, r) => ({
      increase: acc.increase + (r.value_difference > 0 ? r.value_difference : 0),
      decrease: acc.decrease + (r.value_difference < 0 ? Math.abs(r.value_difference) : 0),
    }),
    { increase: 0, decrease: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Pregled na stavkama nivelacija: {articleCode} – {articleName}
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
                <TableHead className="w-[130px]">Broj nivelacije</TableHead>
                <TableHead className="min-w-[150px]">Magacin</TableHead>
                <TableHead className="text-right w-[90px]">Količina</TableHead>
                <TableHead className="text-right w-[100px]">Stara cena</TableHead>
                <TableHead className="text-right w-[100px]">Nova cena</TableHead>
                <TableHead className="text-right w-[110px]">Razlika/jed.</TableHead>
                <TableHead className="text-right w-[130px]">Razlika ukupno</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nema nivelacija za ovaj artikal u izabranom periodu.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.adjustment_date ? format(new Date(row.adjustment_date), "dd.MM.yyyy") : "-"}</TableCell>
                      <TableCell className="font-medium">{row.adjustment_number}</TableCell>
                      <TableCell>{row.warehouse_name}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.quantity, 2)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.old_price, 2)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.new_price, 2)}</TableCell>
                      <TableCell className="text-right">
                        <span className={row.price_difference > 0 ? "text-green-600" : row.price_difference < 0 ? "text-destructive" : ""}>
                          {formatDecimal(row.price_difference, 2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={row.value_difference > 0 ? "text-green-600" : row.value_difference < 0 ? "text-destructive" : ""}>
                          {formatDecimal(row.value_difference, 2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={7} className="text-right">Ukupno:</TableCell>
                    <TableCell className="text-right">
                      {totals.increase > 0 && <span className="text-green-600">+{formatDecimal(totals.increase, 2)}</span>}
                      {totals.increase > 0 && totals.decrease > 0 && " / "}
                      {totals.decrease > 0 && <span className="text-destructive">-{formatDecimal(totals.decrease, 2)}</span>}
                      {totals.increase === 0 && totals.decrease === 0 && formatDecimal(0, 2)}
                    </TableCell>
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
