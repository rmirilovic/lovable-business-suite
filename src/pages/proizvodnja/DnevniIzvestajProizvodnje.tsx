import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { formatDecimal } from "@/lib/formatting";
import {
  DnevniLineGroup,
  DnevniReportData,
  DnevniRow,
  exportDnevniIzvestajToExcel,
  exportDnevniIzvestajToPdf,
  printDnevniIzvestaj,
} from "@/lib/dnevniIzvestajProizvodnjeExportUtils";

const fmtQty = (v: number) => (v ? formatDecimal(v, 0) : "-");

export default function DnevniIzvestajProizvodnje() {
  const { selectedCompany, selectedYear } = useAuth();
  const companyId = selectedCompany?.id;
  const businessYearId = selectedYear?.id;

  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    queryKey: ["dnevni-izvestaj-proizvodnje", companyId, businessYearId, date],
    enabled: !!companyId && !!businessYearId && !!date,
    queryFn: async (): Promise<DnevniReportData> => {
      // 1. Notes on the selected day
      const { data: dayNotes, error: dayErr } = await supabase
        .from("production_delivery_notes")
        .select("id, delivery_number, delivery_date, production_line, work_order_id, shift_manager_1_id, shift_manager_2_id, shift_manager_3_id")
        .eq("company_id", companyId!)
        .eq("business_year_id", businessYearId!)
        .eq("delivery_date", date);
      if (dayErr) throw dayErr;
      const notes = dayNotes || [];
      if (notes.length === 0) {
        return { groups: [], totalKgWithoutClass08: 0 };
      }

      const dayNoteIds = notes.map((n) => n.id);
      const woIds = Array.from(new Set(notes.map((n) => n.work_order_id).filter(Boolean) as string[]));

      // 2. Items for day notes
      const { data: dayItems, error: itemsErr } = await (supabase as any)
        .from("production_delivery_note_items")
        .select("delivery_note_id, article_id, article_code, article_name, unit, kg_per_unit, launched_qty, qty_shift_1, qty_shift_2, qty_shift_3, qty_total, scrap_qty")
        .in("delivery_note_id", dayNoteIds);
      if (itemsErr) throw itemsErr;
      const items = (dayItems || []) as any[];

      // 3. All notes for the same work orders with delivery_date <= selected date — for "Ukupno do sada"
      const cumulativeMap = new Map<string, number>(); // key: woId|articleCode -> sum qty_total
      if (woIds.length) {
        const { data: cumNotes } = await supabase
          .from("production_delivery_notes")
          .select("id, work_order_id, delivery_date")
          .eq("company_id", companyId!)
          .eq("business_year_id", businessYearId!)
          .in("work_order_id", woIds)
          .lte("delivery_date", date);
        const cumNoteIds = (cumNotes || []).map((n) => n.id);
        const cumNoteWoMap = new Map((cumNotes || []).map((n: any) => [n.id, n.work_order_id as string]));
        if (cumNoteIds.length) {
          const { data: cumItems } = await (supabase as any)
            .from("production_delivery_note_items")
            .select("delivery_note_id, article_code, qty_total")
            .in("delivery_note_id", cumNoteIds);
          (cumItems || []).forEach((ci: any) => {
            const wo = cumNoteWoMap.get(ci.delivery_note_id);
            if (!wo) return;
            const key = `${wo}|${ci.article_code}`;
            cumulativeMap.set(key, (cumulativeMap.get(key) || 0) + Number(ci.qty_total || 0));
          });
        }
      }

      // 4. Related data
      const articleIds = Array.from(new Set(items.map((i) => i.article_id))) as string[];
      const lineCodes = Array.from(new Set(notes.map((n) => Number(n.production_line)).filter((v) => !isNaN(v))));
      const managerIds = Array.from(
        new Set(
          notes.flatMap((n: any) => [n.shift_manager_1_id, n.shift_manager_2_id, n.shift_manager_3_id]).filter(Boolean)
        )
      ) as string[];

      const [{ data: articles }, { data: lines }, { data: managers }] = await Promise.all([
        articleIds.length
          ? supabase.from("articles").select("id, article_group, kg_po_jm").in("id", articleIds)
          : Promise.resolve({ data: [] as any[] }),
        lineCodes.length
          ? supabase.from("production_lines" as any).select("code, name").eq("company_id", companyId!).in("code", lineCodes)
          : Promise.resolve({ data: [] as any[] }),
        managerIds.length
          ? supabase.from("shift_managers" as any).select("id, first_name, last_name").in("id", managerIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const artMap = new Map((articles || []).map((a: any) => [a.id, a]));
      const lineMap = new Map((lines || []).map((l: any) => [Number(l.code), l.name as string]));
      const managerMap = new Map(
        (managers || []).map((m: any) => [m.id, `${m.first_name || ""} ${m.last_name || ""}`.trim()])
      );

      // 5. Aggregate items: per (delivery_note_id, article_code) — sum across variants
      type AggKey = string;
      const agg = new Map<AggKey, DnevniRow & { _note_id: string; _wo_id: string | null; _line_code: number }>();
      notes.forEach((n: any) => {
        // collect items for this note
        const noteItems = items.filter((it) => it.delivery_note_id === n.id);
        // group by article_code
        const byCode = new Map<string, any[]>();
        noteItems.forEach((it) => {
          const list = byCode.get(it.article_code) || [];
          list.push(it);
          byCode.set(it.article_code, list);
        });
        byCode.forEach((list, code) => {
          const first = list[0];
          const art = artMap.get(first.article_id);
          const kgPerUnit = Number(art?.kg_po_jm ?? first.kg_per_unit ?? 0);
          const classification = (art?.article_group as string) || "";
          const launched = list.reduce((s, x) => s + Number(x.launched_qty ?? 0), 0);
          const s1 = list.reduce((s, x) => s + Number(x.qty_shift_1 ?? 0), 0);
          const s2 = list.reduce((s, x) => s + Number(x.qty_shift_2 ?? 0), 0);
          const s3 = list.reduce((s, x) => s + Number(x.qty_shift_3 ?? 0), 0);
          const qtyDay = list.reduce((s, x) => s + Number(x.qty_total ?? 0), 0);
          const scrapKg = list.reduce((s, x) => s + Number(x.scrap_qty ?? 0), 0);
          const cumKey = `${n.work_order_id}|${code}`;
          const cumulative = cumulativeMap.get(cumKey) || qtyDay;
          const key = `${n.id}|${code}`;
          agg.set(key, {
            _note_id: n.id,
            _wo_id: n.work_order_id,
            _line_code: Number(n.production_line),
            delivery_number: n.delivery_number,
            classification,
            article_code: code,
            article_name: first.article_name,
            unit: first.unit,
            launched_qty: launched,
            qty_shift_1: s1,
            qty_shift_2: s2,
            qty_shift_3: s3,
            qty_day: qtyDay,
            qty_day_kg: qtyDay * kgPerUnit,
            qty_total_to_date: cumulative,
            scrap_kg: scrapKg,
          });
        });
      });

      // 6. Group by line_code
      const groupsMap = new Map<number, DnevniLineGroup>();
      notes.forEach((n: any) => {
        const code = Number(n.production_line);
        if (!groupsMap.has(code)) {
          groupsMap.set(code, {
            line_code: code,
            line_name: lineMap.get(code) || `L-${code}`,
            shift_manager_1: managerMap.get(n.shift_manager_1_id) || "",
            shift_manager_2: managerMap.get(n.shift_manager_2_id) || "",
            shift_manager_3: managerMap.get(n.shift_manager_3_id) || "",
            rows: [],
            totals: { launched: 0, s1: 0, s2: 0, s3: 0, qty_day: 0, qty_day_kg: 0, qty_total_to_date: 0, scrap_kg: 0 },
          });
        }
      });

      // Add aggregated rows sorted by delivery_number then article_code
      const sortedRows = Array.from(agg.values()).sort((a, b) => {
        if (a._line_code !== b._line_code) return a._line_code - b._line_code;
        if (a.delivery_number !== b.delivery_number) return a.delivery_number.localeCompare(b.delivery_number);
        return a.article_code.localeCompare(b.article_code);
      });

      sortedRows.forEach((r) => {
        const g = groupsMap.get(r._line_code);
        if (!g) return;
        const row: DnevniRow = {
          delivery_number: r.delivery_number,
          classification: r.classification,
          article_code: r.article_code,
          article_name: r.article_name,
          unit: r.unit,
          launched_qty: r.launched_qty,
          qty_shift_1: r.qty_shift_1,
          qty_shift_2: r.qty_shift_2,
          qty_shift_3: r.qty_shift_3,
          qty_day: r.qty_day,
          qty_day_kg: r.qty_day_kg,
          qty_total_to_date: r.qty_total_to_date,
          scrap_kg: r.scrap_kg,
        };
        g.rows.push(row);
        g.totals.launched += row.launched_qty;
        g.totals.s1 += row.qty_shift_1;
        g.totals.s2 += row.qty_shift_2;
        g.totals.s3 += row.qty_shift_3;
        g.totals.qty_day += row.qty_day;
        g.totals.qty_day_kg += row.qty_day_kg;
        g.totals.qty_total_to_date += row.qty_total_to_date;
        g.totals.scrap_kg += row.scrap_kg;
      });

      const groups = Array.from(groupsMap.values())
        .filter((g) => g.rows.length > 0)
        .sort((a, b) => a.line_code - b.line_code);

      // Total without class 08
      let totalKgWithoutClass08 = 0;
      groups.forEach((g) => {
        g.rows.forEach((r) => {
          if (!r.classification?.startsWith("08")) {
            totalKgWithoutClass08 += r.qty_day_kg;
          }
        });
      });

      return { groups, totalKgWithoutClass08 };
    },
  });

  const report = data ?? { groups: [], totalKgWithoutClass08: 0 };
  const exportMeta = { companyName: selectedCompany?.name ?? "", date };

  const totalCols = 14;

  return (
    <MainLayout title="Dnevni izveštaj proizvodnje">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col h-full min-h-0">
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Datum</Label>
            <LocaleDateInput value={date} onChange={setDate} className="w-[160px]" />
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportDnevniIzvestajToExcel(report, exportMeta)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportDnevniIzvestajToPdf(report, exportMeta)}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printDnevniIzvestaj(report, exportMeta)}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
          </div>
        </div>

        <TableScrollContainer className="flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Linija</TableHead>
                <TableHead className="w-[110px]">Predajnica</TableHead>
                <TableHead className="w-[70px]">Klasa</TableHead>
                <TableHead className="w-[100px]">Šifra G.P.</TableHead>
                <TableHead className="min-w-[220px]">Naziv G.P.</TableHead>
                <TableHead className="w-[60px]">JM</TableHead>
                <TableHead className="w-[100px] text-right">Lansirano</TableHead>
                <TableHead className="w-[100px] text-right">I smena</TableHead>
                <TableHead className="w-[100px] text-right">II smena</TableHead>
                <TableHead className="w-[100px] text-right">III smena</TableHead>
                <TableHead className="w-[110px] text-right">Predato za dan</TableHead>
                <TableHead className="w-[110px] text-right">Predato u kg</TableHead>
                <TableHead className="w-[130px] text-right">Predato ukupno do sada</TableHead>
                <TableHead className="w-[110px] text-right">Predato škarta (kg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={totalCols} className="text-center py-8">Učitavanje...</TableCell></TableRow>
              ) : report.groups.length === 0 ? (
                <TableRow><TableCell colSpan={totalCols} className="text-center py-8 text-muted-foreground">Nema podataka za izabrani dan.</TableCell></TableRow>
              ) : (
                <>
                  {report.groups.map((g) => (
                    <LineBlock key={g.line_code} g={g} />
                  ))}
                  <TableRow className="bg-primary/15 font-bold">
                    <TableCell colSpan={11} className="text-right">Ukupno za dan bez klase 08 (kg):</TableCell>
                    <TableCell className="text-right font-mono">{fmtQty(report.totalKgWithoutClass08)}</TableCell>
                    <TableCell colSpan={2}></TableCell>
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

function LineBlock({ g }: { g: DnevniLineGroup }) {
  return (
    <>
      <TableRow className="bg-primary/10">
        <TableCell colSpan={14} className="font-semibold">
          Linija {g.line_code} - {g.line_name}
          <span className="ml-4 text-xs text-muted-foreground">
            Šef I sm: <strong className="text-foreground">{g.shift_manager_1 || "-"}</strong>
            {"  |  "}
            Šef II sm: <strong className="text-foreground">{g.shift_manager_2 || "-"}</strong>
            {"  |  "}
            Šef III sm: <strong className="text-foreground">{g.shift_manager_3 || "-"}</strong>
          </span>
        </TableCell>
      </TableRow>
      {g.rows.map((r, idx) => (
        <TableRow key={`${g.line_code}-${idx}`} className="hover:bg-muted/30">
          <TableCell className="text-xs">{g.line_name}</TableCell>
          <TableCell className="font-medium text-xs">{r.delivery_number}</TableCell>
          <TableCell className="text-xs">{r.classification || "-"}</TableCell>
          <TableCell className="font-mono text-xs">{r.article_code}</TableCell>
          <TableCell className="text-xs">{r.article_name}</TableCell>
          <TableCell className="text-xs">{r.unit}</TableCell>
          <TableCell className="text-right font-mono">{fmtQty(r.launched_qty)}</TableCell>
          <TableCell className="text-right font-mono">{fmtQty(r.qty_shift_1)}</TableCell>
          <TableCell className="text-right font-mono">{fmtQty(r.qty_shift_2)}</TableCell>
          <TableCell className="text-right font-mono">{fmtQty(r.qty_shift_3)}</TableCell>
          <TableCell className="text-right font-mono">{fmtQty(r.qty_day)}</TableCell>
          <TableCell className="text-right font-mono">{fmtQty(r.qty_day_kg)}</TableCell>
          <TableCell className="text-right font-mono">{fmtQty(r.qty_total_to_date)}</TableCell>
          <TableCell className="text-right font-mono">{fmtQty(r.scrap_kg)}</TableCell>
        </TableRow>
      ))}
      <TableRow className="bg-muted/60 font-semibold">
        <TableCell colSpan={6} className="text-right">Ukupno za liniju {g.line_name}:</TableCell>
        <TableCell className="text-right font-mono">{fmtQty(g.totals.launched)}</TableCell>
        <TableCell className="text-right font-mono">{fmtQty(g.totals.s1)}</TableCell>
        <TableCell className="text-right font-mono">{fmtQty(g.totals.s2)}</TableCell>
        <TableCell className="text-right font-mono">{fmtQty(g.totals.s3)}</TableCell>
        <TableCell className="text-right font-mono">{fmtQty(g.totals.qty_day)}</TableCell>
        <TableCell className="text-right font-mono">{fmtQty(g.totals.qty_day_kg)}</TableCell>
        <TableCell className="text-right font-mono">{fmtQty(g.totals.qty_total_to_date)}</TableCell>
        <TableCell className="text-right font-mono">{fmtQty(g.totals.scrap_kg)}</TableCell>
      </TableRow>
    </>
  );
}
