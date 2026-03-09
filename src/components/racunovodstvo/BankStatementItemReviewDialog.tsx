import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/lib/formatting";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenterCode: string;
  partnerId: string | null;
  partnerName: string | null;
}

interface ReviewRow {
  id: string;
  statement_date: string;
  statement_number: string;
  account_code: string | null;
  partner_account_number: string | null;
  debit_amount: number;
  credit_amount: number;
}

const fmt2 = (v: number) =>
  v.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function BankStatementItemReviewDialog({ open, onOpenChange, costCenterCode, partnerId, partnerName }: Props) {
  const { selectedCompany, selectedYear } = useAuth();
  const year = selectedYear?.year || new Date().getFullYear();
  
  const [dateFrom, setDateFrom] = useState(`${year}-01-01`);
  const [dateTo, setDateTo] = useState(`${year}-12-31`);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedYear) {
      const y = selectedYear.year;
      setDateFrom(`${y}-01-01`);
      setDateTo(`${y}-12-31`);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (!open || !selectedCompany?.id || !costCenterCode || !dateFrom || !dateTo) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("bank_statement_items")
          .select(`
            id,
            debit_amount,
            credit_amount,
            partner_account_number,
            payment_codes(account_code),
            bank_statements!inner(statement_date, statement_number, company_id)
          `)
          .eq("cost_center_code", costCenterCode)
          .eq("bank_statements.company_id", selectedCompany.id)
          .gte("bank_statements.statement_date", dateFrom)
          .lte("bank_statements.statement_date", dateTo)
          .order("bank_statements(statement_date)", { ascending: true });

        if (partnerId) {
          query = query.eq("partner_id", partnerId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const mapped: ReviewRow[] = (data || []).map((r: any) => ({
          id: r.id,
          statement_date: r.bank_statements?.statement_date || "",
          statement_number: r.bank_statements?.statement_number || "",
          account_code: r.payment_codes?.account_code || null,
          partner_account_number: r.partner_account_number,
          debit_amount: Number(r.debit_amount) || 0,
          credit_amount: Number(r.credit_amount) || 0,
        }));

        setRows(mapped);
      } catch (err) {
        console.error("Error fetching review data:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, selectedCompany?.id, costCenterCode, partnerId, dateFrom, dateTo]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({ debit: acc.debit + r.debit_amount, credit: acc.credit + r.credit_amount }),
      { debit: 0, credit: 0 }
    );
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Pregled po analitici na svim izvodima</DialogTitle>
          <div className="text-sm text-muted-foreground space-y-0.5 mt-1">
            <div><span className="font-medium">Analitika:</span> {costCenterCode}</div>
            {partnerName && <div><span className="font-medium">Partner:</span> {partnerName}</div>}
          </div>
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

        <div className="overflow-auto flex-1 -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Datum</TableHead>
                <TableHead className="w-[140px]">Broj izvoda</TableHead>
                <TableHead className="w-[100px]">Konto</TableHead>
                <TableHead className="w-[160px]">TR partnera</TableHead>
                <TableHead className="w-[120px] text-right">Duguje</TableHead>
                <TableHead className="w-[120px] text-right">Potražuje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nema podataka
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs">{row.statement_date}</TableCell>
                      <TableCell className="text-xs font-mono">{row.statement_number}</TableCell>
                      <TableCell className="text-xs font-mono">{row.account_code || "-"}</TableCell>
                      <TableCell className="text-xs font-mono">{row.partner_account_number || "-"}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {row.debit_amount !== 0 ? fmt2(row.debit_amount) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {row.credit_amount !== 0 ? fmt2(row.credit_amount) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold border-t-2">
                    <TableCell colSpan={4} className="text-xs text-right pr-2">Ukupno:</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums font-semibold">
                      {fmt2(totals.debit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums font-semibold">
                      {fmt2(totals.credit)}
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
