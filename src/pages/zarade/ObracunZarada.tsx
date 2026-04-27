import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2 } from "lucide-react";
import { usePayrollCalculations, usePayrollCalculationMutations, CALCULATION_TYPE_LABELS } from "@/hooks/usePayrollCalculations";
import { useAuth } from "@/contexts/AuthContext";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { toast } from "sonner";
import { formatDate, formatPrice } from "@/lib/formatting";

const MONTH_NAMES = ["Januar", "Februar", "Mart", "April", "Maj", "Jun", "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];

export default function ObracunZarada() {
  const navigate = useNavigate();
  const { data: calculations, isLoading } = usePayrollCalculations();
  const { deleteCalculation, createCalculation } = usePayrollCalculationMutations();
  const { user, selectedYear } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("__all__");

  const filtered = useMemo(() => {
    if (!calculations) return [];
    return calculations.filter((c) => {
      if (typeFilter !== "__all__" && c.calculation_type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return c.calculation_number.toLowerCase().includes(s);
      }
      return true;
    });
  }, [calculations, search, typeFilter]);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("calculation_date", "desc");

  const sortedData = sortItems(filtered, (item: any, col: string) => (item as any)[col]);

  const handleNew = async () => {
    const now = new Date();
    const periodMonth = now.getMonth() + 1;
    const periodYear = selectedYear?.year || now.getFullYear();
    const calcNum = generatePayrollCalcNumber(calculations || [], periodMonth, periodYear);
    try {
      const result = await createCalculation.mutateAsync({
        calculation_number: calcNum,
        calculation_type: "redovna_zarada",
        calculation_date: now.toISOString().slice(0, 10),
        period_month: periodMonth,
        period_year: periodYear,
        created_by: user?.id,
      } as any);
      navigate(`/zarade/obracun/${(result as any).id}`);
    } catch {
      toast.error("Greška pri kreiranju obračuna");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Da li ste sigurni?")) {
      await deleteCalculation.mutateAsync(id);
    }
  };

  const formatAmount = (n: number) => formatPrice(n);

  return (
    <MainLayout title="Obračun zarada">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Obračun zarada</h1>
            <p className="text-sm text-muted-foreground">Bruto/neto kalkulacija, porezi i doprinosi</p>
          </div>
          <Button onClick={handleNew}><Plus className="w-4 h-4 mr-1" /> Novi obračun</Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Pretraži..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tip obračuna" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Svi tipovi</SelectItem>
              {Object.entries(CALCULATION_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TableScrollContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortableHeader label="Broj" column="calculation_number" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader label="Tip" column="calculation_type" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader label="Period" column="period_month" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader label="Datum" column="calculation_date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead className="text-right">Porez</TableHead>
                <TableHead className="text-right">Ukupan trošak</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell></TableRow>
              ) : !sortedData.length ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nema obračuna za izabrani period.</TableCell></TableRow>
              ) : sortedData.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/zarade/obracun/${c.id}`)}>
                  <TableCell className="font-medium">{c.calculation_number}</TableCell>
                  <TableCell>{CALCULATION_TYPE_LABELS[c.calculation_type] || c.calculation_type}</TableCell>
                  <TableCell>{MONTH_NAMES[c.period_month - 1]} {c.period_year}</TableCell>
                  <TableCell>{formatDate(c.calculation_date)}</TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(c.total_gross)}</TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(c.total_net)}</TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(c.total_tax)}</TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(c.total_cost)}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "posted" ? "default" : "secondary"}>
                      {c.status === "posted" ? "Proknjižen" : "Nacrt"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.status === "draft" && (
                      <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, c.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>
    </MainLayout>
  );
}
