import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Loader2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useArticles } from "@/hooks/useArticles";
import { useArticleAllWarehousesCard } from "@/hooks/useArticleAllWarehousesCard";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { formatPrice, formatDecimal, formatDate } from "@/lib/formatting";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { BarcodeScannerButton } from "@/components/sifarnici/BarcodeScannerButton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function RobnaKarticaSviMagacini() {
  const { selectedCompany, selectedYear } = useAuth();
  const companyId = selectedCompany?.id;
  const isMobile = useIsMobile();

  const defaultFrom = selectedYear ? `${selectedYear.year}-01-01` : "";
  const today = format(new Date(), "yyyy-MM-dd");

  const [articleId, setArticleId] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultFrom);

  const { articles } = useArticles(companyId);

  // Fetch article IDs that have movements from the selected date
  const { data: articleIdsWithMovements } = useQuery({
    queryKey: ["articles-with-movements", companyId, dateFrom],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_articles_with_movements", {
        p_company_id: companyId!,
        p_date_from: dateFrom || null,
      });
      if (error) throw error;
      return new Set((data as { article_id: string }[]).map((r) => r.article_id));
    },
    enabled: !!companyId,
  });

  // Filter articles to only those with movements
  const filteredArticles = useMemo(() => {
    if (!articles) return [];
    if (!articleIdsWithMovements) return articles;
    return articles.filter((a) => articleIdsWithMovements.has(a.id));
  }, [articles, articleIdsWithMovements]);

  // Find article by barcode scan
  const handleBarcodeScan = (code: string) => {
    const found = filteredArticles?.find(a => a.code === code);
    if (found) {
      setArticleId(found.id);
      toast.success(`Artikal pronađen: ${found.name}`);
    } else {
      toast.error(`Artikal sa šifrom "${code}" nije pronađen.`);
    }
  };

  const selectedArticle = filteredArticles?.find(a => a.id === articleId);

  const { data: movements, isLoading } = useArticleAllWarehousesCard(
    companyId,
    articleId || undefined,
    dateFrom || undefined,
    today
  );

  // Compute running balance per warehouse
  const { rows, grandTotals } = useMemo(() => {
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
    <MainLayout title="R.K. u svim magacinima">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-4 p-4 md:p-6">
        <h1 className="text-xl font-bold">R.K. u svim magacinima</h1>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[250px] max-w-md">
            <Label className="text-xs mb-1 block">Artikal</Label>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <SearchableArticleSelect
                  articles={filteredArticles || []}
                  value={articleId}
                  onValueChange={(id) => setArticleId(id)}
                />
              </div>
              {isMobile && articleId && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setArticleId("")}
                  title="Obriši izbor"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <BarcodeScannerButton onScan={handleBarcodeScan} />
            </div>
          </div>
          <div className="w-[150px]">
            <Label className="text-xs mb-1 block">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} />
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
