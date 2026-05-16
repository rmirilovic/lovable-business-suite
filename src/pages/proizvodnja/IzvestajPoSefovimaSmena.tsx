import { useState } from "react";
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
import { format, startOfYear } from "date-fns";
import { formatDecimal } from "@/lib/formatting";
import {
  SefSmeneReport,
  exportSefoviToExcel,
  exportSefoviToPdf,
  printSefovi,
} from "@/lib/izvestajPoSefovimaSmenaExportUtils";

const fmtQty = (v: number) => (v ? formatDecimal(v, 0) : "-");

export default function IzvestajPoSefovimaSmena() {
  const { selectedCompany, selectedYear } = useAuth();
  const companyId = selectedCompany?.id;
  const businessYearId = selectedYear?.id;

  const [dateFrom, setDateFrom] = useState<string>(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    queryKey: ["izvestaj-sefovi-smena", companyId, businessYearId, dateFrom, dateTo],
    enabled: !!companyId && !!businessYearId && !!dateFrom && !!dateTo,
    queryFn: async (): Promise<SefSmeneReport> => {
      // 1. Shift managers by slot
      const { data: managers } = await (supabase as any)
        .from("shift_managers")
        .select("id, slot_number, first_name, last_name")
        .eq("company_id", companyId!)
        .order("slot_number");
      const slotName = (n: number) => {
        const m = (managers || []).find((x: any) => x.slot_number === n);
        return m ? `${m.first_name || ""} ${m.last_name || ""}`.trim() : "";
      };
      const managerNames = { m1: slotName(1), m2: slotName(2), m3: slotName(3) };
      const slotById = new Map<string, number>(
        (managers || []).map((m: any) => [m.id, m.slot_number as number])
      );

      // 2. Notes in range
      const { data: notes } = await supabase
        .from("production_delivery_notes")
        .select("id, delivery_date, shift_manager_1_id, shift_manager_2_id, shift_manager_3_id")
        .eq("company_id", companyId!)
        .eq("business_year_id", businessYearId!)
        .gte("delivery_date", dateFrom)
        .lte("delivery_date", dateTo);
      const notesList = notes || [];

      const noteIds = notesList.map((n) => n.id);
      const empty: SefSmeneReport = {
        rows: [],
        managerNames,
        totals: { m1: { s1: 0, s2: 0, s3: 0 }, m2: { s1: 0, s2: 0, s3: 0 }, m3: { s1: 0, s2: 0, s3: 0 }, total: 0 },
      };
      if (noteIds.length === 0) return empty;

      // 3. Items
      const { data: items } = await (supabase as any)
        .from("production_delivery_note_items")
        .select("delivery_note_id, article_id, kg_per_unit, qty_shift_1, qty_shift_2, qty_shift_3")
        .in("delivery_note_id", noteIds);
      const itemList = (items || []) as any[];

      // 4. Articles for kg_po_jm fallback
      const articleIds = Array.from(new Set(itemList.map((i) => i.article_id).filter(Boolean))) as string[];
      const { data: articles } = articleIds.length
        ? await supabase.from("articles").select("id, kg_po_jm").in("id", articleIds)
        : { data: [] as any[] };
      const artKg = new Map((articles || []).map((a: any) => [a.id, Number(a.kg_po_jm || 0)]));

      const noteById = new Map(notesList.map((n: any) => [n.id, n]));

      // dateKey -> {m1,m2,m3,total}
      const dayMap = new Map<string, { m1: any; m2: any; m3: any; total: number }>();
      const ensure = (d: string) => {
        let r = dayMap.get(d);
        if (!r) {
          r = {
            m1: { s1: 0, s2: 0, s3: 0 },
            m2: { s1: 0, s2: 0, s3: 0 },
            m3: { s1: 0, s2: 0, s3: 0 },
            total: 0,
          };
          dayMap.set(d, r);
        }
        return r;
      };

      itemList.forEach((it: any) => {
        const note: any = noteById.get(it.delivery_note_id);
        if (!note) return;
        const kg = Number(it.kg_per_unit ?? artKg.get(it.article_id) ?? 0);
        const kg1 = Number(it.qty_shift_1 || 0) * kg;
        const kg2 = Number(it.qty_shift_2 || 0) * kg;
        const kg3 = Number(it.qty_shift_3 || 0) * kg;
        const dayRec = ensure(note.delivery_date);

        const apply = (mgrId: string | null, shiftKg: number, shiftKey: "s1" | "s2" | "s3") => {
          if (!mgrId || !shiftKg) return;
          const slot = slotById.get(mgrId);
          if (!slot) return;
          const slotKey = slot === 1 ? "m1" : slot === 2 ? "m2" : slot === 3 ? "m3" : null;
          if (!slotKey) return;
          dayRec[slotKey][shiftKey] += shiftKg;
          dayRec.total += shiftKg;
        };
        apply(note.shift_manager_1_id, kg1, "s1");
        apply(note.shift_manager_2_id, kg2, "s2");
        apply(note.shift_manager_3_id, kg3, "s3");
      });

      const rows = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v }));

      const totals = {
        m1: { s1: 0, s2: 0, s3: 0 },
        m2: { s1: 0, s2: 0, s3: 0 },
        m3: { s1: 0, s2: 0, s3: 0 },
        total: 0,
      };
      rows.forEach((r) => {
        (["m1", "m2", "m3"] as const).forEach((k) => {
          totals[k].s1 += r[k].s1;
          totals[k].s2 += r[k].s2;
          totals[k].s3 += r[k].s3;
        });
        totals.total += r.total;
      });

      return { rows, managerNames, totals };
    },
  });

  const report: SefSmeneReport = data ?? {
    rows: [],
    managerNames: { m1: "", m2: "", m3: "" },
    totals: { m1: { s1: 0, s2: 0, s3: 0 }, m2: { s1: 0, s2: 0, s3: 0 }, m3: { s1: 0, s2: 0, s3: 0 }, total: 0 },
  };
  const meta = { companyName: selectedCompany?.name ?? "", dateFrom, dateTo };

  return (
    <MainLayout title="Izveštaj po šefovima smena">
      <div className="flex flex-col h-full min-h-0">
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[160px]" />
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportSefoviToExcel(report, meta)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportSefoviToPdf(report, meta)}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printSefovi(report, meta)}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
          </div>
        </div>

        <TableScrollContainer className="flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="align-middle w-[120px]">Datum</TableHead>
                <TableHead colSpan={3} className="text-center border-l">
                  {report.managerNames.m1 || "Šef 1"}
                </TableHead>
                <TableHead colSpan={3} className="text-center border-l">
                  {report.managerNames.m2 || "Šef 2"}
                </TableHead>
                <TableHead colSpan={3} className="text-center border-l">
                  {report.managerNames.m3 || "Šef 3"}
                </TableHead>
                <TableHead rowSpan={2} className="align-middle text-right w-[120px] border-l">
                  Ukupno za dan (kg)
                </TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="text-right border-l">I smena</TableHead>
                <TableHead className="text-right">II smena</TableHead>
                <TableHead className="text-right">III smena</TableHead>
                <TableHead className="text-right border-l">I smena</TableHead>
                <TableHead className="text-right">II smena</TableHead>
                <TableHead className="text-right">III smena</TableHead>
                <TableHead className="text-right border-l">I smena</TableHead>
                <TableHead className="text-right">II smena</TableHead>
                <TableHead className="text-right">III smena</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8">Učitavanje...</TableCell></TableRow>
              ) : report.rows.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nema podataka za izabrani period.</TableCell></TableRow>
              ) : (
                <>
                  {report.rows.map((r) => (
                    <TableRow key={r.date} className="hover:bg-muted/30">
                      <TableCell className="text-sm">{format(new Date(r.date), "dd.MM.yyyy")}</TableCell>
                      <TableCell className="text-right font-mono border-l">{fmtQty(r.m1.s1)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(r.m1.s2)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(r.m1.s3)}</TableCell>
                      <TableCell className="text-right font-mono border-l">{fmtQty(r.m2.s1)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(r.m2.s2)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(r.m2.s3)}</TableCell>
                      <TableCell className="text-right font-mono border-l">{fmtQty(r.m3.s1)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(r.m3.s2)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(r.m3.s3)}</TableCell>
                      <TableCell className="text-right font-mono border-l">{fmtQty(r.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/15 font-bold">
                    <TableCell>UKUPNO</TableCell>
                    <TableCell className="text-right font-mono border-l">{fmtQty(report.totals.m1.s1)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtQty(report.totals.m1.s2)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtQty(report.totals.m1.s3)}</TableCell>
                    <TableCell className="text-right font-mono border-l">{fmtQty(report.totals.m2.s1)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtQty(report.totals.m2.s2)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtQty(report.totals.m2.s3)}</TableCell>
                    <TableCell className="text-right font-mono border-l">{fmtQty(report.totals.m3.s1)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtQty(report.totals.m3.s2)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtQty(report.totals.m3.s3)}</TableCell>
                    <TableCell className="text-right font-mono border-l">{fmtQty(report.totals.total)}</TableCell>
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
