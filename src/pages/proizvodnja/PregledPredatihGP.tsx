import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfYear } from "date-fns";
import { formatDecimal, formatPrice } from "@/lib/formatting";
import { useTableSort } from "@/hooks/useTableSort";
import {
  exportPregledPredatihGPToExcel,
  exportPregledPredatihGPToPdf,
  printPregledPredatihGP,
  PregledPredatihGPRow,
} from "@/lib/pregledPredatihGPExportUtils";

function wildcardMatch(value: string, pattern: string) {
  if (!pattern) return true;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i").test(value);
}

export default function PregledPredatihGP() {
  const { selectedCompany, selectedYear } = useAuth();
  const companyId = selectedCompany?.id;
  const businessYearId = selectedYear?.id;

  const yearStart = selectedYear
    ? format(startOfYear(new Date(selectedYear.year, 0, 1)), "yyyy-MM-dd")
    : format(startOfYear(new Date()), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const [dateFrom, setDateFrom] = useState(yearStart);
  const [dateTo, setDateTo] = useState(today);
  const [predajnicaFilter, setPredajnicaFilter] = useState("");
  const [rnFilter, setRnFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pregled-predatih-gp", companyId, businessYearId, dateFrom, dateTo],
    enabled: !!companyId && !!businessYearId,
    queryFn: async (): Promise<PregledPredatihGPRow[]> => {
      const { data: notes, error: notesErr } = await supabase
        .from("production_delivery_notes")
        .select("id, delivery_number, delivery_date, production_line, work_order_id")
        .eq("company_id", companyId!)
        .eq("business_year_id", businessYearId!)
        .gte("delivery_date", dateFrom)
        .lte("delivery_date", dateTo)
        .order("delivery_date", { ascending: true });
      if (notesErr) throw notesErr;
      if (!notes || notes.length === 0) return [];

      const noteIds = notes.map((n) => n.id);
      const woIds = Array.from(new Set(notes.map((n) => n.work_order_id).filter(Boolean) as string[]));

      const [{ data: items, error: itemsErr }, { data: workOrders }] = await Promise.all([
        (supabase as any)
          .from("production_delivery_note_items")
          .select("delivery_note_id, article_id, article_code, article_name, unit, kg_per_unit, launched_qty, qty_shift_1, qty_shift_2, qty_shift_3, qty_total, item_order"),
        woIds.length
          ? supabase.from("work_orders").select("id, order_number").in("id", woIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (itemsErr) throw itemsErr;

      const filteredItems = (items || []).filter((it: any) => noteIds.includes(it.delivery_note_id));
      const articleIds = Array.from(new Set(filteredItems.map((i: any) => i.article_id))) as string[];

      const { data: articles } = await supabase
        .from("articles")
        .select("id, code, name, unit, article_group, kg_po_jm, purchase_price")
        .in("id", articleIds);

      const noteMap = new Map(notes.map((n) => [n.id, n]));
      const woMap = new Map((workOrders || []).map((w: any) => [w.id, w.order_number]));
      const artMap = new Map((articles || []).map((a: any) => [a.id, a]));

      const result: PregledPredatihGPRow[] = filteredItems
        .sort((a: any, b: any) => (a.item_order ?? 0) - (b.item_order ?? 0))
        .map((it: any) => {
          const note = noteMap.get(it.delivery_note_id)!;
          const art = artMap.get(it.article_id);
          const kgPerUnit = Number(art?.kg_po_jm ?? it.kg_per_unit ?? 0);
          const purchasePrice = Number(art?.purchase_price ?? 0);
          const qtyTotal = Number(it.qty_total ?? 0);
          return {
            delivery_number: note.delivery_number,
            delivery_date: note.delivery_date,
            work_order_number: note.work_order_id ? (woMap.get(note.work_order_id) ?? "-") : "-",
            production_line: note.production_line,
            classification: art?.article_group ?? "",
            article_code: it.article_code,
            article_name: it.article_name,
            unit: it.unit,
            launched_qty: Number(it.launched_qty ?? 0),
            qty_shift_1: Number(it.qty_shift_1 ?? 0),
            qty_shift_2: Number(it.qty_shift_2 ?? 0),
            qty_shift_3: Number(it.qty_shift_3 ?? 0),
            qty_total: qtyTotal,
            delivered_kg: qtyTotal * kgPerUnit,
            item_value: qtyTotal * purchasePrice,
          };
        });

      return result;
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (predajnicaFilter && !r.delivery_number.toLowerCase().includes(predajnicaFilter.toLowerCase())) return false;
      if (rnFilter && !r.work_order_number.toLowerCase().includes(rnFilter.toLowerCase())) return false;
      if (classFilter && !r.classification.toLowerCase().includes(classFilter.toLowerCase())) return false;
      if (codeFilter && !wildcardMatch(r.article_code, codeFilter)) return false;
      if (nameFilter && !r.article_name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
      if (unitFilter && !r.unit.toLowerCase().includes(unitFilter.toLowerCase())) return false;
      return true;
    });
  }, [rows, predajnicaFilter, rnFilter, classFilter, codeFilter, nameFilter, unitFilter]);

  const sorted = sortItems(filtered, (item, col) => (item as any)[col]);

  const totals = useMemo(() => {
    return sorted.reduce(
      (acc, r) => {
        acc.launched += r.launched_qty;
        acc.s1 += r.qty_shift_1;
        acc.s2 += r.qty_shift_2;
        acc.s3 += r.qty_shift_3;
        acc.qty += r.qty_total;
        acc.kg += r.delivered_kg;
        acc.value += r.item_value;
        return acc;
      },
      { launched: 0, s1: 0, s2: 0, s3: 0, qty: 0, kg: 0, value: 0 }
    );
  }, [sorted]);

  const fmtDate = (d: string) => (d ? format(new Date(d), "dd.MM.yyyy") : "-");
  const fmtQty = (v: number) => (v ? formatDecimal(v, 0) : "-");
  const fmtVal = (v: number) => (v ? formatDecimal(v, 0) : "-");

  const exportMeta = { companyName: selectedCompany?.name ?? "", dateFrom, dateTo };

  return (
    <MainLayout title="Pregled predatih GP">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col h-full min-h-0">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Datum od</Label>
              <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[140px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Datum do</Label>
              <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[140px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Predajnica</Label>
              <Input value={predajnicaFilter} onChange={(e) => setPredajnicaFilter(e.target.value)} className="w-[140px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">RN</Label>
              <Input value={rnFilter} onChange={(e) => setRnFilter(e.target.value)} className="w-[140px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Klasa</Label>
              <Input value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="w-[120px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Šifra (* za wildcard)</Label>
              <Input value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)} placeholder="npr. 100*" className="w-[160px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Naziv</Label>
              <Input value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="w-[180px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">JM</Label>
              <Input value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="w-[80px]" />
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportPregledPredatihGPToExcel(sorted, exportMeta)}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportPregledPredatihGPToPdf(sorted, exportMeta)}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => printPregledPredatihGP(sorted, exportMeta)}>
                <Printer className="w-4 h-4 mr-2" /> Štampa
              </Button>
            </div>
          </div>
        </div>

        <TableScrollContainer className="flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]"><SortableHeader column="delivery_number" label="Predajnica" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[95px]"><SortableHeader column="delivery_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[100px]"><SortableHeader column="work_order_number" label="RN" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[60px]"><SortableHeader column="production_line" label="Linija" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[80px]"><SortableHeader column="classification" label="Klasa" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[100px]"><SortableHeader column="article_code" label="Šifra" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="min-w-[200px]"><SortableHeader column="article_name" label="Naziv artikla" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[60px]"><SortableHeader column="unit" label="JM" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[110px] text-right"><SortableHeader column="launched_qty" label="Lansirano" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                <TableHead className="w-[100px] text-right"><SortableHeader column="qty_shift_1" label="I smena" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                <TableHead className="w-[100px] text-right"><SortableHeader column="qty_shift_2" label="II smena" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                <TableHead className="w-[100px] text-right"><SortableHeader column="qty_shift_3" label="III smena" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                <TableHead className="w-[120px] text-right"><SortableHeader column="qty_total" label="Predato ukupno" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                <TableHead className="w-[110px] text-right"><SortableHeader column="delivered_kg" label="Predato kg" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                <TableHead className="w-[120px] text-right"><SortableHeader column="item_value" label="Vrednost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={15} className="text-center py-8">Učitavanje...</TableCell></TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={15} className="text-center py-8 text-muted-foreground">Nema podataka.</TableCell></TableRow>
              ) : (
                <>
                  {sorted.map((r, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{r.delivery_number}</TableCell>
                      <TableCell>{fmtDate(r.delivery_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.work_order_number}</TableCell>
                      <TableCell className="text-center">{r.production_line}</TableCell>
                      <TableCell>{r.classification || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.article_code}</TableCell>
                      <TableCell className="text-xs">{r.article_name}</TableCell>
                      <TableCell>{r.unit}</TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(r.launched_qty)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(r.qty_shift_1)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(r.qty_shift_2)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(r.qty_shift_3)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{fmtQty(r.qty_total)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(r.delivered_kg)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtVal(r.item_value)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/60 font-semibold">
                    <TableCell colSpan={8} className="text-right">Ukupno:</TableCell>
                    <TableCell className="text-right font-mono">{fmtQty(totals.launched)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtQty(totals.s1)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtQty(totals.s2)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtQty(totals.s3)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtQty(totals.qty)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtQty(totals.kg)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtVal(totals.value)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>
    </MainLayout>
  );
}
