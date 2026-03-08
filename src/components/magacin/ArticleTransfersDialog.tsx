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
  transfer_date: string;
  transfer_number: string;
  source_warehouse: string;
  dest_warehouse: string;
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

export function ArticleTransfersDialog({ open, onOpenChange, articleId, articleCode, articleName }: Props) {
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
          .from("inter_warehouse_transfer_items")
          .select(`
            quantity, unit_price,
            transfer:inter_warehouse_transfers!inner(
              transfer_date, transfer_number, status, company_id,
              source_warehouse:warehouses!inter_warehouse_transfers_source_warehouse_id_fkey(code, name),
              dest_warehouse:warehouses!inter_warehouse_transfers_dest_warehouse_id_fkey(code, name)
            )
          `)
          .eq("article_id", articleId)
          .eq("transfer.company_id", selectedCompany.id);

        if (dateFrom) query = query.gte("transfer.transfer_date", dateFrom);
        if (dateTo) query = query.lte("transfer.transfer_date", dateTo);

        const { data, error } = await query;
        if (error) throw error;

        const mapped: Row[] = (data || []).map((item: any) => {
          const t = item.transfer;
          return {
            transfer_date: t?.transfer_date ?? "",
            transfer_number: t?.transfer_number ?? "",
            source_warehouse: t?.source_warehouse ? `${t.source_warehouse.code} - ${t.source_warehouse.name}` : "—",
            dest_warehouse: t?.dest_warehouse ? `${t.dest_warehouse.code} - ${t.dest_warehouse.name}` : "—",
            quantity: item.quantity,
            unit_price: item.unit_price,
            value: item.quantity * item.unit_price,
          };
        });

        mapped.sort((a, b) => a.transfer_date.localeCompare(b.transfer_date) || a.transfer_number.localeCompare(b.transfer_number));
        setRows(mapped);
      } catch (err) {
        console.error("Error fetching article transfer data:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, articleId, selectedCompany?.id, dateFrom, dateTo]);

  const totals = rows.reduce(
    (acc, r) => ({ quantity: acc.quantity + r.quantity, value: acc.value + r.value }),
    { quantity: 0, value: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Na međumagacinskim prenosima: {articleCode} – {articleName}
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
                <TableHead className="w-[130px]">Broj prenosa</TableHead>
                <TableHead className="min-w-[150px]">Iz magacina</TableHead>
                <TableHead className="min-w-[150px]">U magacin</TableHead>
                <TableHead className="text-right w-[100px]">Količina</TableHead>
                <TableHead className="text-right w-[110px]">Cena</TableHead>
                <TableHead className="text-right w-[130px]">Vrednost</TableHead>
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
                    Nema međumagacinskih prenosa za ovaj artikal u izabranom periodu.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.transfer_date ? format(new Date(row.transfer_date), "dd.MM.yyyy") : "-"}</TableCell>
                      <TableCell className="font-medium">{row.transfer_number}</TableCell>
                      <TableCell>{row.source_warehouse}</TableCell>
                      <TableCell>{row.dest_warehouse}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.quantity, 3)}</TableCell>
                      <TableCell className="text-right">{formatDecimal(row.unit_price, 2)}</TableCell>
                      <TableCell className="text-right font-medium">{formatDecimal(row.value, 2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={4} className="text-right">Ukupno:</TableCell>
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
