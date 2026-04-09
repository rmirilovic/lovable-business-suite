import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Loader2, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useArticles } from "@/hooks/useArticles";
import { useArticleAllWarehousesCard, type AllWarehousesMovementRow } from "@/hooks/useArticleAllWarehousesCard";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { formatPrice, formatDecimal, formatDate } from "@/lib/formatting";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { BarcodeScannerButton } from "@/components/sifarnici/BarcodeScannerButton";
import { toast } from "sonner";

export default function RobnaKarticaSviMagacini() {
  const { selectedCompany, selectedYear } = useAuth();
  const companyId = selectedCompany?.id;

  const defaultFrom = selectedYear ? `${selectedYear.year}-01-01` : "";

  const [articleId, setArticleId] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState("");
  const [barcodeSearch, setBarcodeSearch] = useState("");

  const { data: articles } = useArticles(companyId);

  // Find article by barcode scan
  const handleBarcodeScan = (code: string) => {
    setBarcodeSearch(code);
    const found = articles?.find(a => a.code === code);
    if (found) {
      setArticleId(found.id);
      toast.success(`Artikal pronađen: ${found.name}`);
    } else {
      toast.error(`Artikal sa šifrom "${code}" nije pronađen.`);
    }
  };

  const selectedArticle = articles?.find(a => a.id === articleId);

  const { data: movements, isLoading } = useArticleAllWarehousesCard(
    companyId,
    articleId || undefined,
    dateFrom || undefined,
    dateTo || undefined
  );

  // Compute running balance per warehouse
  const { rows, warehouseTotals, grandTotals } = useMemo(() => {
    if (!movements || movements.length === 0) {
      return { rows: [], warehouseTotals: new Map(), grandTotals: { debit: 0, credit: 0, balanceQty: 0, balanceValue: 0 } };
    }

    const balances = new Map<string, { qty: number; value: number }>();
    let grandDebit = 0, grandCredit = 0;

    const computed = movements.map((m) => {
      const key = m.warehouse_id;
      const prev = balances.get(key) || { qty: 0, value: 0 };
      prev.qty += m.in_quantity - m.out_quantity;
      prev.value += m.debit_value - m.credit_value;
      balances.set(key, { ...prev });
      grandDebit += m.debit_value;
      grandCredit += m.credit_value;

      return {
        ...m,
        running_qty: prev.qty,
        running_value: prev.value,
      };
    });

    // Per-warehouse totals
    const whTotals = new Map<string, { debit: number; credit: number; balanceQty: number; balanceValue: number }>();
    for (const row of computed) {
      const existing = whTotals.get(row.warehouse_id) || { debit: 0, credit: 0, balanceQty: 0, balanceValue: 0 };
      existing.debit += row.debit_value;
      existing.credit += row.credit_value;
      existing.balanceQty = row.running_qty;
      existing.balanceValue = row.running_value;
      whTotals.set(row.warehouse_id, existing);
    }

    return {
      rows: computed,
      warehouseTotals: whTotals,
      grandTotals: {
        debit: grandDebit,
        credit: grandCredit,
        balanceQty: Array.from(balances.values()).reduce((s, b) => s + b.qty, 0),
        balanceValue: Array.from(balances.values()).reduce((s, b) => s + b.value, 0),
      },
    };
  }, [movements]);

  return (
    <MainLayout>
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <h1 className="text-xl font-bold">R.K. u svim magacinima</h1>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[250px] max-w-md">
            <Label className="text-xs mb-1 block">Artikal</Label>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <SearchableArticleSelect
                  companyId={companyId || ""}
                  value={articleId}
                  onChange={setArticleId}
                />
              </div>
              <BarcodeScannerButton onScan={handleBarcodeScan} />
            </div>
          </div>
          <div className="w-[150px]">
            <Label className="text-xs mb-1 block">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} />
          </div>
          <div className="w-[150px]">
            <Label className="text-xs mb-1 block">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} />
          </div>
        </div>

        {selectedArticle && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Artikal:</span>{" "}
            {selectedArticle.code} — {selectedArticle.name} ({selectedArticle.unit})
          </div>
        )}

        {!articleId ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Izaberite artikal za prikaz robne kartice.
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Nema proknjiženih promena za odabrani artikal i period.
          </div>
        ) : (
          <TableScrollContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Magacin</TableHead>
                  <TableHead className="w-[100px]">Datum</TableHead>
                  <TableHead>Dokument</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right w-[80px]">Ulaz</TableHead>
                  <TableHead className="text-right w-[80px]">Izlaz</TableHead>
                  <TableHead className="text-right w-[90px]">Cena</TableHead>
                  <TableHead className="text-right w-[110px]">Duguje</TableHead>
                  <TableHead className="text-right w-[110px]">Potražuje</TableHead>
                  <TableHead className="text-right w-[80px]">Stanje</TableHead>
                  <TableHead className="text-right w-[110px]">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => {
                  const prevWarehouse = idx > 0 ? rows[idx - 1].warehouse_id : null;
                  const isNewWarehouse = row.warehouse_id !== prevWarehouse;
                  return (
                    <TableRow key={idx} className={isNewWarehouse && idx > 0 ? "border-t-2 border-primary/20" : ""}>
                      <TableCell className="font-medium">
                        {isNewWarehouse ? row.warehouse_code : ""}
                      </TableCell>
                      <TableCell>{formatDate(row.movement_date)}</TableCell>
                      <TableCell className="font-medium">{`${row.document_type} ${row.document_number}`}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{row.partner_name}</TableCell>
                      <TableCell className="text-right">
                        {row.in_quantity !== 0 ? formatDecimal(row.in_quantity) : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.out_quantity !== 0 ? formatDecimal(row.out_quantity) : ""}
                      </TableCell>
                      <TableCell className="text-right">{formatPrice(row.unit_price)}</TableCell>
                      <TableCell className="text-right">
                        {row.debit_value !== 0 ? formatPrice(row.debit_value) : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.credit_value !== 0 ? formatPrice(row.credit_value) : ""}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatDecimal(row.running_qty)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(row.running_value)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={7} className="text-right font-semibold">
                    Ukupno:
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatPrice(grandTotals.debit)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatPrice(grandTotals.credit)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatDecimal(grandTotals.balanceQty)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatPrice(grandTotals.balanceValue)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableScrollContainer>
        )}
      </div>
    </MainLayout>
  );
}
